/**
 * Protocol Intake -> VIP draft smoke.
 *
 * Usage:
 *   npm run protocol-to-vip-smoke -- --study-id <study_id>
 *   PROTOCOL_TO_VIP_SMOKE_STUDY_ID=<study_id> npm run protocol-to-vip-smoke
 */
import crypto from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadIntelligenceDocument } from '../lib/document-intelligence/load-intelligence-document'
import { loadProtocolRuntimeStudy } from '../lib/protocol-intake-runtime/load-protocol-runtime-study'
import { loadProtocolVersion } from '../lib/protocol-intake-runtime/load-protocol-version'
import {
  mapProtocolRuntimeStudyRow,
  type ProtocolRuntimeStudyRow,
} from '../lib/protocol-intake-runtime/protocol-intake-types'
import { generateVipDraft } from '../lib/vip-adapter'
import type { GenerateVipDraftResult } from '../lib/vip-adapter/types'

loadEnv({ path: '.env.local' })
loadEnv()

type CliOptions = {
  studyId: string | null
  organizationId: string | null
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
  const studyId =
    readOption('study-id') ??
    readOption('study_id') ??
    process.env.PROTOCOL_TO_VIP_SMOKE_STUDY_ID?.trim() ??
    process.env.VIP_SMOKE_STUDY_ID?.trim() ??
    ''

  const organizationId =
    readOption('organization-id') ??
    readOption('organization_id') ??
    process.env.PROTOCOL_TO_VIP_SMOKE_ORG_ID?.trim() ??
    process.env.VIP_SMOKE_ORG_ID?.trim() ??
    null

  return { studyId: studyId || null, organizationId }
}

function requireSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(url, key)
}

async function resolveProtocolRuntimeStudy(
  supabase: SupabaseClient,
  args: CliOptions,
): Promise<ProtocolRuntimeStudyRow> {
  let query = supabase
    .from('protocol_runtime_studies')
    .select('*')
    .not('study_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(2)

  if (args.studyId) query = query.eq('study_id', args.studyId)
  if (args.organizationId) query = query.eq('organization_id', args.organizationId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  if (rows.length === 0) {
    const scope = args.studyId ? `study_id=${args.studyId}` : 'a linked study_id'
    throw new Error(`No protocol runtime study found for ${scope}`)
  }
  if (rows.length > 1 && args.studyId && !args.organizationId) {
    throw new Error(
      `Multiple protocol runtime studies found for study_id=${args.studyId}; pass --organization-id to disambiguate.`,
    )
  }

  return mapProtocolRuntimeStudyRow(rows[0] as Record<string, unknown>)
}

function makeTraceId(studyId: string) {
  const cleanStudyId = studyId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'study'
  return `protocol_to_vip_${cleanStudyId}_${Date.now().toString(36)}`
}

function makeArtifactId() {
  return `vipdraft_${crypto.randomUUID()}`
}

async function saveDraft(args: {
  artifactId: string
  result: GenerateVipDraftResult
  documentIntelligence: {
    documentId: string
    sourceFilename: string
    chunkCount: number
  }
}) {
  const outputDir = path.join(process.cwd(), 'tmp', 'vip-generated-drafts')
  const outputPath = path.join(outputDir, `${args.artifactId}.json`)
  await mkdir(outputDir, { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        artifact_id: args.artifactId,
        draft_only: true,
        generated_at: new Date().toISOString(),
        trace_id: args.result.traceId,
        fallback: args.result.fallback,
        vip: args.result.vip,
        document_intelligence: args.documentIntelligence,
        artifact: args.result.artifact,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  return outputPath
}

async function main() {
  const options = readCliOptions()
  const supabase = requireSupabaseClient()
  const runtimeStudy = await resolveProtocolRuntimeStudy(supabase, options)
  const organizationId = runtimeStudy.organizationId

  if (!runtimeStudy.studyId) {
    throw new Error(`Protocol runtime study ${runtimeStudy.id} is not linked to a study_id`)
  }

  const loadedRuntimeStudy = await loadProtocolRuntimeStudy(supabase, organizationId, runtimeStudy.id)
  const activeVersionId =
    loadedRuntimeStudy?.study.currentProtocolVersionId ?? loadedRuntimeStudy?.latestVersion?.id ?? null

  if (!activeVersionId) {
    throw new Error(`Protocol runtime study ${runtimeStudy.id} does not have an active protocol version`)
  }

  const loadedVersion = await loadProtocolVersion(supabase, organizationId, activeVersionId)
  if (!loadedVersion) {
    throw new Error(`Active protocol version ${activeVersionId} was not found for organization`)
  }

  const protocolDocument = await loadIntelligenceDocument(
    supabase,
    organizationId,
    loadedVersion.version.sourceDocumentId,
    runtimeStudy.studyId,
  )
  if (!protocolDocument) {
    throw new Error(
      `Document Intelligence protocol context not found for source_document_id=${loadedVersion.version.sourceDocumentId}`,
    )
  }

  const traceId = process.env.PROTOCOL_TO_VIP_SMOKE_TRACE_ID?.trim() || makeTraceId(runtimeStudy.studyId)
  const result = await generateVipDraft({
    supabase,
    organizationId,
    studyId: runtimeStudy.studyId,
    protocolRuntimeStudyId: runtimeStudy.id,
    protocolVersionId: loadedVersion.version.id,
    traceId,
    useCase: 'protocol_intake.screening_visit_source_draft',
  })

  const artifactId = makeArtifactId()
  await saveDraft({
    artifactId,
    result,
    documentIntelligence: {
      documentId: protocolDocument.document.id,
      sourceFilename: protocolDocument.document.sourceFilename,
      chunkCount: protocolDocument.chunkCount,
    },
  })

  console.log(`study_id=${runtimeStudy.studyId}`)
  console.log(`protocol_version=${loadedVersion.version.id}`)
  console.log(`trace_id=${result.traceId}`)
  console.log(`artifact_id=${artifactId}`)
  console.log(`fallback=${result.fallback}`)
}

main().catch((error) => {
  console.error('Protocol to VIP smoke failed:', error)
  process.exit(1)
})
