/**
 * Seed minimal Protocol Intake runtime data for Protocol → VIP smoke tests.
 *
 * Usage:
 *   npm run protocol-runtime:seed-smoke
 *   npm run protocol-runtime:seed-smoke -- --live
 *   npm run protocol-runtime:seed-smoke -- --live --study-id <uuid>
 *
 * Env (live):
 *   PROTOCOL_RUNTIME_SMOKE_ORG_ID
 *   PROTOCOL_RUNTIME_SMOKE_USER_ID   optional actor / created_by
 *   PROTOCOL_RUNTIME_SMOKE_ALLOW_ANY_ORG=true  skip staging org name guard
 */
import { createHash } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { COMPLIANCE_STORAGE_BUCKET } from '../lib/document-intake/upload-document-blob'
import { createComplianceDocument } from '../lib/document-intake/create-compliance-document'
import { createProtocolRuntimeStudy } from '../lib/protocol-intake-runtime/create-protocol-runtime-study'
import { createProtocolVersion } from '../lib/protocol-intake-runtime/create-protocol-version'
import { extractProcedureCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-procedure-candidates'
import { extractProtocolSectionsFromText } from '../lib/protocol-intake-runtime/extract-protocol-sections'
import { extractVisitCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-visit-candidates'
import {
  mapProtocolRuntimeSectionRow,
  mapProtocolRuntimeStudyRow,
  mapProtocolRuntimeVisitCandidateRow,
} from '../lib/protocol-intake-runtime/protocol-intake-types'
import { storeProtocolSections } from '../lib/protocol-intake-runtime/store-protocol-sections'

loadEnv({ path: '.env.local' })
loadEnv()

export const PROTOCOL_RUNTIME_SMOKE_PROTOCOL_NUMBER = 'PARA-OA-012-SMOKE'
export const PROTOCOL_RUNTIME_SMOKE_TITLE = 'PARA_OA_012 Screening Visit'
export const PROTOCOL_RUNTIME_SMOKE_CONTENT =
  'Screening visit includes informed consent, medical history, concomitant medications, inclusion/exclusion criteria, ADP NRS pain score, physical exam, vitals, ECG, labs, knee X-ray, MRI, pregnancy testing if applicable, ophthalmology exam, AE assessment, and eDiary training.'

export const PROTOCOL_RUNTIME_SMOKE_FIXTURE = {
  studyId: '00000000-0000-4000-8001-0000000000a001',
  organizationId: '00000000-0000-4000-8001-0000000000org01',
  protocolRuntimeStudyId: '00000000-0000-4000-8001-0000000000pr01',
  protocolVersionId: '00000000-0000-4000-8001-0000000000pv01',
  sharedDocumentId: '00000000-0000-4000-8001-0000000000dc01',
} as const

const SMOKE_METADATA_KEY = 'protocol_runtime_smoke_v1'

type CliOptions = {
  live: boolean
  studyId: string | null
  organizationId: string | null
}

type SeedResult = {
  organizationId: string
  studyId: string
  protocolRuntimeStudyId: string
  protocolVersionId: string
  sharedDocumentId: string
  mode: 'fixture' | 'live'
  reused: boolean
}

function readOption(name: string): string | null {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length).trim() || null
  const index = process.argv.indexOf(`--${name}`)
  const next = index >= 0 ? process.argv[index + 1] : undefined
  return next && !next.startsWith('--') ? next.trim() || null : null
}

function readCliOptions(): CliOptions {
  return {
    live: process.argv.includes('--live'),
    studyId:
      readOption('study-id') ??
      readOption('study_id') ??
      process.env.PROTOCOL_RUNTIME_SMOKE_STUDY_ID?.trim() ??
      null,
    organizationId:
      readOption('organization-id') ??
      readOption('organization_id') ??
      process.env.PROTOCOL_RUNTIME_SMOKE_ORG_ID?.trim() ??
      null,
  }
}

export function buildProtocolSmokeSourceText(): string {
  return [
    '1 INTRODUCTION',
    PROTOCOL_RUNTIME_SMOKE_TITLE,
    PROTOCOL_RUNTIME_SMOKE_CONTENT,
    '',
    '2 SCHEDULE OF ACTIVITIES',
    'Screening Visit (Day -28 to Day 0)',
    `Screening visit procedures: ${PROTOCOL_RUNTIME_SMOKE_CONTENT}`,
  ].join('\n')
}

function deterministicDocumentId(studyId: string): string {
  const hash = createHash('sha256').update(`protocol-runtime-smoke:${studyId}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4000',
    '8001',
    hash.slice(16, 28),
  ].join('-')
}

function requireSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --live')
  }
  return createClient(url, key)
}

function assertStagingTarget(org: { id: string; name: string | null }) {
  if (process.env.PROTOCOL_RUNTIME_SMOKE_ALLOW_ANY_ORG === 'true') return
  const name = org.name ?? ''
  const looksStaging = /staging|synthetic|smoke|qa|dev/i.test(name)
  if (!looksStaging) {
    throw new Error(
      `Refusing to seed: organization "${name}" (${org.id}) does not look like staging. ` +
        'Set PROTOCOL_RUNTIME_SMOKE_ALLOW_ANY_ORG=true to override.',
    )
  }
}

async function resolveOrganization(supabase: SupabaseClient, organizationId: string | null) {
  if (organizationId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error(`Organization not found: ${organizationId}`)
    assertStagingTarget(data)
    return data
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No organizations found')
  assertStagingTarget(data)
  return data
}

async function resolveActorUserId(supabase: SupabaseClient, organizationId: string): Promise<string> {
  const fromEnv = process.env.PROTOCOL_RUNTIME_SMOKE_USER_ID?.trim()
  if (fromEnv) return fromEnv

  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.user_id) {
    throw new Error(
      'No active organization member found for created_by. Set PROTOCOL_RUNTIME_SMOKE_USER_ID.',
    )
  }
  return String(data.user_id)
}

async function resolveStudy(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string | null,
): Promise<{ id: string; created: boolean }> {
  if (studyId) {
    const { data, error } = await supabase
      .from('studies')
      .select('id, organization_id')
      .eq('id', studyId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error(`Study not found: ${studyId}`)
    if (String(data.organization_id) !== organizationId) {
      throw new Error(`Study ${studyId} does not belong to organization ${organizationId}`)
    }
    return { id: studyId, created: false }
  }

  const smokeSlug = 'para-oa-012-smoke'
  const { data: existing, error: existingError } = await supabase
    .from('studies')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('slug', smokeSlug)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing) return { id: String(existing.id), created: false }

  const { data, error } = await supabase
    .from('studies')
    .insert({
      organization_id: organizationId,
      name: `${PROTOCOL_RUNTIME_SMOKE_TITLE} Smoke Study`,
      status: 'active',
      slug: smokeSlug,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create smoke study: ${error?.message ?? 'Unknown error'}`)
  }
  return { id: String(data.id), created: true }
}

async function findExistingSmokeRuntimeStudy(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
) {
  const { data, error } = await supabase
    .from('protocol_runtime_studies')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('protocol_number', PROTOCOL_RUNTIME_SMOKE_PROTOCOL_NUMBER)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProtocolRuntimeStudyRow(data as Record<string, unknown>)
}

async function ensureSharedDocuments(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  actorId: string
  sharedDocumentId: string
}) {
  const { data: existingCompliance } = await args.supabase
    .from('compliance_runtime_documents')
    .select('id')
    .eq('id', args.sharedDocumentId)
    .maybeSingle()

  if (!existingCompliance) {
    await createComplianceDocument({
      supabase: args.supabase,
      documentId: args.sharedDocumentId,
      organizationId: args.organizationId,
      studyId: args.studyId,
      subjectId: null,
      visitId: null,
      procedureExecutionId: null,
      documentClassification: 'protocol',
      destinationDomain: 'study_documents',
      destinationEntityType: 'study',
      destinationEntityId: args.studyId,
      originalFilename: 'para-oa-012-screening-smoke.txt',
      operationalDisplayName: PROTOCOL_RUNTIME_SMOKE_TITLE,
      mimeType: 'text/plain',
      storageBucket: COMPLIANCE_STORAGE_BUCKET,
      storagePath: `smoke/protocol-runtime/${args.studyId}/${args.sharedDocumentId}.txt`,
      cryptographicHash: createHash('sha256').update(PROTOCOL_RUNTIME_SMOKE_CONTENT).digest('hex'),
      fileSizeBytes: Buffer.byteLength(PROTOCOL_RUNTIME_SMOKE_CONTENT, 'utf8'),
      expirationDate: null,
      certifiedCopyRequired: false,
      tags: ['smoke', 'protocol-runtime'],
      operationalNotes: 'Protocol runtime smoke seed (no storage upload)',
      metadata: { smoke_seed: SMOKE_METADATA_KEY },
      actorId: args.actorId,
      actorRole: 'research_coordinator',
    })
  }

  const { data: existingIntelligence } = await args.supabase
    .from('document_intelligence_documents')
    .select('id')
    .eq('id', args.sharedDocumentId)
    .maybeSingle()

  if (!existingIntelligence) {
    const now = new Date().toISOString()
    const { error: intelligenceError } = await args.supabase
      .from('document_intelligence_documents')
      .insert({
        id: args.sharedDocumentId,
        organization_id: args.organizationId,
        study_id: args.studyId,
        compliance_document_id: args.sharedDocumentId,
        document_classification: 'protocol',
        intelligence_status: 'ready',
        extraction_status: 'extracted',
        embedding_status: 'skipped',
        source_hash: createHash('sha256').update(PROTOCOL_RUNTIME_SMOKE_CONTENT).digest('hex'),
        source_filename: 'para-oa-012-screening-smoke.txt',
        source_mime_type: 'text/plain',
        document_family_id: args.sharedDocumentId,
        version_number: 1,
        version_label: 'v1',
        effective_from: now,
        metadata: { smoke_seed: SMOKE_METADATA_KEY },
        created_by: args.actorId,
        created_at: now,
        updated_at: now,
      })

    if (intelligenceError) {
      throw new Error(`Failed to create intelligence document: ${intelligenceError.message}`)
    }

    const chunkText = buildProtocolSmokeSourceText()
    const { error: chunkError } = await args.supabase.from('document_intelligence_chunks').insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      intelligence_document_id: args.sharedDocumentId,
      compliance_document_id: args.sharedDocumentId,
      chunk_index: 0,
      chunk_text: chunkText,
      clean_chunk_text: chunkText,
      chunk_hash: createHash('sha256').update(`0:${args.sharedDocumentId}:${chunkText}`).digest('hex'),
      token_estimate: Math.ceil(chunkText.length / 4),
      embedding_status: 'skipped',
      metadata: { smoke_seed: SMOKE_METADATA_KEY },
    })

    if (chunkError) {
      throw new Error(`Failed to create intelligence chunk: ${chunkError.message}`)
    }
  }
}

async function seedExtractionArtifacts(args: {
  supabase: SupabaseClient
  protocolVersionId: string
}) {
  const sourceText = buildProtocolSmokeSourceText()
  const extractedSections = extractProtocolSectionsFromText(sourceText)

  await Promise.all([
    args.supabase.from('protocol_runtime_sections').delete().eq('protocol_version_id', args.protocolVersionId),
    args.supabase
      .from('protocol_runtime_visit_candidates')
      .delete()
      .eq('protocol_version_id', args.protocolVersionId),
    args.supabase
      .from('protocol_runtime_procedure_candidates')
      .delete()
      .eq('protocol_version_id', args.protocolVersionId),
  ])

  await storeProtocolSections(args.supabase, args.protocolVersionId, extractedSections)

  const { data: storedSectionRows, error: storedSectionErr } = await args.supabase
    .from('protocol_runtime_sections')
    .select('*')
    .eq('protocol_version_id', args.protocolVersionId)
    .order('sequence_order', { ascending: true })

  if (storedSectionErr) throw new Error(storedSectionErr.message)
  const sections = (storedSectionRows ?? []).map((row) =>
    mapProtocolRuntimeSectionRow(row as Record<string, unknown>),
  )

  const visitCandidates = extractVisitCandidatesFromSections(sections)
  if (visitCandidates.length > 0) {
    const { error } = await args.supabase.from('protocol_runtime_visit_candidates').insert(
      visitCandidates.map((visit) => ({
        protocol_version_id: args.protocolVersionId,
        visit_code: visit.visit_code,
        visit_name: visit.visit_name,
        visit_type: visit.visit_type,
        study_day: visit.study_day,
        window_before_days: visit.window_before_days,
        window_after_days: visit.window_after_days,
        extracted_from_section_id: visit.extracted_from_section_id,
        confidence_score: visit.confidence_score,
        reconciliation_status: 'unreviewed',
        metadata: { ...(visit.metadata ?? {}), smoke_seed: SMOKE_METADATA_KEY },
      })),
    )
    if (error) throw new Error(error.message)
  }

  const { data: visitRows, error: visitErr } = await args.supabase
    .from('protocol_runtime_visit_candidates')
    .select('*')
    .eq('protocol_version_id', args.protocolVersionId)

  if (visitErr) throw new Error(visitErr.message)
  const storedVisits = (visitRows ?? []).map((row) =>
    mapProtocolRuntimeVisitCandidateRow(row as Record<string, unknown>),
  )

  const procedureCandidates = extractProcedureCandidatesFromSections({
    sections,
    visits: storedVisits,
  })

  if (procedureCandidates.length > 0) {
    const { error } = await args.supabase.from('protocol_runtime_procedure_candidates').insert(
      procedureCandidates.map((proc) => ({
        protocol_version_id: args.protocolVersionId,
        visit_candidate_id: proc.visit_candidate_id,
        procedure_name: proc.procedure_name,
        procedure_category: proc.procedure_category,
        extracted_text: proc.extracted_text,
        confidence_score: proc.confidence_score,
        reconciliation_status: 'unreviewed',
        metadata: { ...(proc.metadata ?? {}), smoke_seed: SMOKE_METADATA_KEY },
      })),
    )
    if (error) throw new Error(error.message)
  }

  const { error: versionUpdateError } = await args.supabase
    .from('protocol_runtime_versions')
    .update({
      raw_text: { smoke_seed: SMOKE_METADATA_KEY, excerpt: PROTOCOL_RUNTIME_SMOKE_CONTENT },
      extraction_status: 'ready',
      extraction_metadata: {
        smoke_seed: SMOKE_METADATA_KEY,
        section_count: sections.length,
        visit_candidate_count: visitCandidates.length,
        procedure_candidate_count: procedureCandidates.length,
      },
    })
    .eq('id', args.protocolVersionId)

  if (versionUpdateError) throw new Error(versionUpdateError.message)
}

async function seedLive(options: CliOptions): Promise<SeedResult> {
  const supabase = requireSupabaseClient()
  const organization = await resolveOrganization(supabase, options.organizationId)
  const actorId = await resolveActorUserId(supabase, organization.id)
  const study = await resolveStudy(supabase, organization.id, options.studyId)
  const sharedDocumentId = deterministicDocumentId(study.id)

  await ensureSharedDocuments({
    supabase,
    organizationId: organization.id,
    studyId: study.id,
    actorId,
    sharedDocumentId,
  })

  let runtimeStudy = await findExistingSmokeRuntimeStudy(supabase, organization.id, study.id)
  let reused = Boolean(runtimeStudy)

  if (!runtimeStudy) {
    runtimeStudy = await createProtocolRuntimeStudy({
      supabase,
      createdBy: actorId,
      input: {
        organization_id: organization.id,
        study_id: study.id,
        protocol_number: PROTOCOL_RUNTIME_SMOKE_PROTOCOL_NUMBER,
        protocol_title: PROTOCOL_RUNTIME_SMOKE_TITLE,
        sponsor_name: 'Vilo Research Smoke',
        therapeutic_area: 'Osteoarthritis',
        phase: 'Phase 2',
        indication: 'Knee OA',
        source_document_id: sharedDocumentId,
      },
    })
    reused = false
  }

  let protocolVersionId = runtimeStudy.currentProtocolVersionId
  if (!protocolVersionId) {
    const version = await createProtocolVersion({
      supabase,
      createdBy: actorId,
      input: {
        organization_id: organization.id,
        protocol_runtime_study_id: runtimeStudy.id,
        version_label: 'Protocol v1.0 (Smoke)',
        version_date: new Date().toISOString().slice(0, 10),
        source_document_id: sharedDocumentId,
      },
    })
    protocolVersionId = version.id
  }

  await seedExtractionArtifacts({ supabase, protocolVersionId })

  await supabase
    .from('protocol_runtime_studies')
    .update({
      current_protocol_version_id: protocolVersionId,
      source_document_id: sharedDocumentId,
      protocol_status: 'ready_for_generation',
      metadata: { smoke_seed: SMOKE_METADATA_KEY },
      updated_at: new Date().toISOString(),
    })
    .eq('id', runtimeStudy.id)

  return {
    organizationId: organization.id,
    studyId: study.id,
    protocolRuntimeStudyId: runtimeStudy.id,
    protocolVersionId,
    sharedDocumentId,
    mode: 'live',
    reused,
  }
}

function seedFixture(): SeedResult {
  return {
    organizationId: PROTOCOL_RUNTIME_SMOKE_FIXTURE.organizationId,
    studyId: PROTOCOL_RUNTIME_SMOKE_FIXTURE.studyId,
    protocolRuntimeStudyId: PROTOCOL_RUNTIME_SMOKE_FIXTURE.protocolRuntimeStudyId,
    protocolVersionId: PROTOCOL_RUNTIME_SMOKE_FIXTURE.protocolVersionId,
    sharedDocumentId: PROTOCOL_RUNTIME_SMOKE_FIXTURE.sharedDocumentId,
    mode: 'fixture',
    reused: false,
  }
}

function printResult(result: SeedResult) {
  console.log(`mode=${result.mode}`)
  console.log(`reused=${result.reused}`)
  console.log(`organization_id=${result.organizationId}`)
  console.log(`study_id=${result.studyId}`)
  console.log(`protocolRuntimeStudyId=${result.protocolRuntimeStudyId}`)
  console.log(`protocolVersionId=${result.protocolVersionId}`)
  console.log(`sharedDocumentId=${result.sharedDocumentId}`)
  console.log('')
  if (result.mode === 'fixture') {
    console.log('Fixture mode: no database writes.')
    console.log('Run live seed against staging: npm run protocol-runtime:seed-smoke -- --live')
  } else {
    console.log('Next:')
    console.log(`  npm run protocol-to-vip-smoke -- --study-id ${result.studyId}`)
  }
}

async function main() {
  const options = readCliOptions()
  const result = options.live ? await seedLive(options) : seedFixture()
  printResult(result)
}

main().catch((error) => {
  console.error('Protocol runtime smoke seed failed:', error)
  process.exit(1)
})
