import fs from 'node:fs'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import { createProtocolRuntimeStudy } from '../lib/protocol-intake-runtime/create-protocol-runtime-study'
import { createProtocolVersion } from '../lib/protocol-intake-runtime/create-protocol-version'
import { extractProtocolVersion } from '../lib/protocol-intake-runtime/run-extraction-pipeline'
import { assertProductionSeedAllowed } from './lib/production-seed-guard.mjs'

loadEnv({ path: '.env.local' })
loadEnv()

type ProtocolKey = 'VALIDATION_PROTOCOL_001' | 'VALIDATION_PROTOCOL_002'

const TARGETS: Record<ProtocolKey, { file: string; reportStem: string; studyPrefix: string }> = {
  VALIDATION_PROTOCOL_001: {
    file: path.resolve(
      __dirname,
      '..',
      'validation-corpus',
      'raw',
      'processed-originals',
      '01. VALIDATION_PROTOCOL_001_Protocol v4.0_Amendment 3_24Feb2026_redline.pdf',
    ),
    reportStem: 'reader-closure-validation-protocol-001',
    studyPrefix: 'VALIDATION_READER_001',
  },
  VALIDATION_PROTOCOL_002: {
    file: path.resolve(
      __dirname,
      '..',
      'validation-corpus',
      'inbox',
      'VALIDATION_PROTOCOL_002_eCRF Completion Guidelines_9.0_16Jun2022.pdf',
    ),
    reportStem: 'reader-closure-validation-protocol-002',
    studyPrefix: 'VALIDATION_READER_002',
  },
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function getProtocolKey(): ProtocolKey {
  const raw = (process.argv[2] || '').trim().toUpperCase() as ProtocolKey
  if (raw === 'VALIDATION_PROTOCOL_001' || raw === 'VALIDATION_PROTOCOL_002') return raw
  throw new Error('Usage: npx tsx scripts/reader-closure-live.ts VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002')
}

function writeReport(reportStem: string, payload: unknown) {
  const outDir = path.resolve(__dirname, '..', '.runtime-validation')
  fs.mkdirSync(outDir, { recursive: true })
  const mdPath = path.join(outDir, `${reportStem}.md`)
  const jsonPath = path.join(outDir, `${reportStem}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8')
  fs.writeFileSync(mdPath, `# ${reportStem}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`, 'utf8')
  return { mdPath, jsonPath }
}

async function main() {
  assertProductionSeedAllowed('reader-closure-live')
  const protocolKey = getProtocolKey()
  const target = TARGETS[protocolKey]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(Boolean(url && key), 'Supabase URL/Key required for live reader closure')
  const supabase = createClient(url!, key!)

  const { data: orgs, error: orgErr } = await supabase.from('organizations').select('id').limit(1)
  if (orgErr) throw orgErr
  assert(Boolean(orgs?.length), 'No organizations found in DB')
  const orgId = orgs![0].id

  const { data: members, error: memberErr } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .limit(1)
  if (memberErr) throw memberErr
  assert(Boolean(members?.length), 'No members found in org')
  const actorId = members![0].user_id

  assert(fs.existsSync(target.file), `Corpus file not found: ${target.file}`)
  const fileStat = fs.statSync(target.file)

  const studySlug = `${target.studyPrefix.toLowerCase()}-${Date.now()}`
  const { data: studyInsert, error: studyErr } = await supabase
    .from('studies')
    .insert({
      organization_id: orgId,
      name: `${target.studyPrefix} Reader Closure Study`,
      status: 'active',
      slug: studySlug,
      created_source: 'test_seed',
    })
    .select('id')
    .single()
  if (studyErr) throw new Error(`Study creation failed: ${studyErr.message}`)

  const fileBuffer = fs.readFileSync(target.file)
  const file = new File([fileBuffer], path.basename(target.file), { type: 'application/pdf' })

  const ingestResult = await ingestComplianceDocument({
    supabase,
    file,
    fileBuffer,
    organizationId: orgId,
    studyId: studyInsert.id,
    subjectId: null,
    visitId: null,
    procedureExecutionId: null,
    documentClassification: 'protocol',
    destinationDomain: 'study_documents',
    destinationEntityType: 'study',
    destinationEntityId: studyInsert.id,
    operationalDisplayName: `${protocolKey} Reader Closure`,
    expirationDate: null,
    certifiedCopyAttested: false,
    operationalNotes: 'Reader closure live validation',
    actorId,
    actorRole: 'research_coordinator',
  })
  if (!ingestResult.ok) throw new Error(`Upload failed: ${ingestResult.message}`)

  const runtimeStudy = await createProtocolRuntimeStudy({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyInsert.id,
      protocol_number: protocolKey,
      protocol_title: `${protocolKey} Reader Closure Protocol`,
      source_document_id: ingestResult.documentId,
    },
  })

  const version = await createProtocolVersion({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      protocol_runtime_study_id: runtimeStudy.id,
      version_label: 'v1.0',
      version_date: new Date().toISOString().slice(0, 10),
      source_document_id: ingestResult.documentId,
    },
  })

  const extraction = await extractProtocolVersion({
    supabase,
    organizationId: orgId,
    versionId: version.id,
    actorId,
  })

  const { data: versionRow } = await supabase
    .from('protocol_runtime_versions')
    .select('id, extraction_status, extraction_metadata, raw_text, source_document_id')
    .eq('id', version.id)
    .single()
  const { data: sections } = await supabase
    .from('protocol_runtime_sections')
    .select('id, section_title, section_type, sequence_order')
    .eq('protocol_version_id', version.id)
    .order('sequence_order')
  const { data: visits } = await supabase
    .from('protocol_runtime_visit_candidates')
    .select('id, visit_code, visit_name, visit_type')
    .eq('protocol_version_id', version.id)
  const { data: procedures } = await supabase
    .from('protocol_runtime_procedure_candidates')
    .select('id, procedure_name, procedure_category, extracted_text')
    .eq('protocol_version_id', version.id)

  const rawText = (versionRow?.raw_text as { text?: string; extraction_note?: string; partial_text?: string }) ?? {}
  const extractionMetadata = (versionRow?.extraction_metadata ?? {}) as Record<string, unknown>
  const report = {
    protocol: protocolKey,
    pdf: {
      path: target.file,
      size_bytes: fileStat.size,
      page_count: extractionMetadata.page_count ?? null,
      extraction_method: extractionMetadata.extraction_method ?? null,
      attempted_reader: extractionMetadata.attempted_reader ?? null,
      fallback_used:
        extractionMetadata.attempted_reader && extractionMetadata.attempted_reader !== 'text'
          ? extractionMetadata.attempted_reader
          : null,
    },
    extraction: {
      status: versionRow?.extraction_status ?? null,
      raw_text_length: String(rawText.text ?? rawText.partial_text ?? rawText.extraction_note ?? '').length,
      section_count: extraction.sectionCount,
      visit_candidate_count: extraction.visitCandidateCount,
      procedure_candidate_count: extraction.procedureCandidateCount,
      raw_text_preview: String(rawText.text ?? rawText.partial_text ?? rawText.extraction_note ?? '').slice(0, 2000),
      failure_stage: extractionMetadata.failure_stage ?? null,
      error_message: extractionMetadata.error_message ?? null,
    },
    sections: (sections ?? []).map((row) => ({
      id: row.id,
      title: row.section_title,
      type: row.section_type,
      sequence_order: row.sequence_order,
    })),
    visits: (visits ?? []).map((row) => ({
      id: row.id,
      code: row.visit_code,
      name: row.visit_name,
      type: row.visit_type,
    })),
    procedures: (procedures ?? []).map((row) => ({
      id: row.id,
      name: row.procedure_name,
      category: row.procedure_category,
      extracted_text: row.extracted_text,
    })),
    passes: {
      raw_text_useful: String(rawText.text ?? rawText.partial_text ?? '').length > 10000,
      section_count_gt_5: extraction.sectionCount > 5,
      visit_candidates_gt_0: extraction.visitCandidateCount > 0,
      procedure_candidates_gt_0: extraction.procedureCandidateCount > 0,
    },
  }

  const reportPaths = writeReport(target.reportStem, report)
  console.log(JSON.stringify({ protocol: protocolKey, reportPaths, report }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
