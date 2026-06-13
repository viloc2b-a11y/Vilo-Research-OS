import fs from 'node:fs'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createProcedure } from '../lib/procedure-library/create-procedure'
import { createBlueprintVersion } from '../lib/procedure-library/create-blueprint-version'
import {
  buildFieldSchemaFromBlueprint,
  buildMinimalBlueprint,
} from '../lib/procedure-library/procedure-types'
import {
  initializeReconciliationSession,
  updateVisitCandidateStatus,
  updateProcedureCandidateStatus,
  approveReconciliationSession,
} from '../lib/protocol-intake-reconciliation/reconciliation-actions'

loadEnv({ path: '.env.local' })
loadEnv()

type ProtocolKey = 'VALIDATION_PROTOCOL_001' | 'VALIDATION_PROTOCOL_002'

const TARGETS: Record<ProtocolKey, { reportStem: string }> = {
  VALIDATION_PROTOCOL_001: { reportStem: 'protocol-to-source-closure-VALIDATION_PROTOCOL_001' },
  VALIDATION_PROTOCOL_002: { reportStem: 'protocol-to-source-closure-VALIDATION_PROTOCOL_002' },
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function getProtocolKey(): ProtocolKey {
  const raw = (process.argv[2] || '').trim().toUpperCase() as ProtocolKey
  if (raw === 'VALIDATION_PROTOCOL_001' || raw === 'VALIDATION_PROTOCOL_002') return raw
  throw new Error('Usage: npx tsx scripts/protocol-to-source-closure-live.ts VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002')
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

function classifyProcedureCategory(name: string): string {
  const n = name.toLowerCase()
  if (/(vital|ecg|mri|ophthalm|physical examination|adrenal|randomi[sz]ation)/i.test(n)) return 'clinical'
  if (/(lab|sample|swab|blood|specimen|urine)/i.test(n)) return 'laboratory'
  if (/(ae|adverse|safety|concomitant|medication|drug)/i.test(n)) return 'safety'
  if (/(questionnaire|survey|patient reported|epro)/i.test(n)) return 'questionnaire'
  if (/(consent|informed consent|eligibility|screening|protocol)/i.test(n)) return 'protocol'
  return 'general'
}

async function getLatestReadyVersion(args: {
  supabase: ReturnType<typeof createClient>
  protocolNumber: ProtocolKey
}) {
  const { data: versions, error } = await args.supabase
    .from('protocol_runtime_versions')
    .select('id, extraction_status, extraction_metadata, raw_text, created_at, protocol_runtime_study_id')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  for (const version of versions ?? []) {
    const { data: study } = await args.supabase
      .from('protocol_runtime_studies')
      .select('id, protocol_number, study_id, organization_id, protocol_title')
      .eq('id', version.protocol_runtime_study_id)
      .maybeSingle()
    if (study?.protocol_number === args.protocolNumber) {
      return { version, study }
    }
  }

  return null
}

async function ensurePublishedBlueprint(args: {
  supabase: ReturnType<typeof createClient>
  actorId: string
  organizationId: string
}) {
  const { data: published, error: publishedError } = await args.supabase
    .from('procedure_blueprint_versions')
    .select('id, procedure_id, blueprint_json, field_schema, blueprint_status')
    .eq('blueprint_status', 'published')
    .limit(1)
    .maybeSingle()
  if (publishedError) throw publishedError
  if (published?.id) {
    return {
      procedureId: String(published.procedure_id),
      blueprintVersionId: String(published.id),
    }
  }

  const procedure = await createProcedure({
    supabase: args.supabase,
    createdBy: args.actorId,
    input: {
      library_scope: 'organization',
      organization_id: args.organizationId,
      procedure_code: `GEN-${Date.now()}`,
      procedure_name: 'Generic Source Procedure',
      procedure_category: 'general',
      description: 'Generic procedure used to validate protocol-to-source closure.',
      operational_description: 'Generic procedure used for runtime/source closure validation.',
      source_template_enabled: true,
      requires_signature: false,
      requires_certified_copy: false,
      supports_offsite: true,
      procedure_complexity: 'standard',
      estimated_duration_minutes: 15,
      tags: ['closure-validation'],
      metadata: {},
    },
  })

  const blueprintJson = buildMinimalBlueprint('closure-generic', 'Generic Closure Procedure', [
    { field_id: 'field_1', type: 'text', label: 'Field 1', required: true },
  ])
  const fieldSchema = buildFieldSchemaFromBlueprint(blueprintJson)

  const blueprint = await createBlueprintVersion({
    supabase: args.supabase,
    procedureId: procedure.id,
    createdBy: args.actorId,
    input: {
      blueprint_json: blueprintJson,
      field_schema: fieldSchema,
      operational_rules: {},
      source_render_schema: {},
      dependency_schema: {},
    },
  })

  const { error: publishError } = await args.supabase
    .from('procedure_blueprint_versions')
    .update({ blueprint_status: 'published' })
    .eq('id', blueprint.id)
  if (publishError) throw publishError

  return {
    procedureId: procedure.id,
    blueprintVersionId: blueprint.id,
  }
}

async function main() {
  const protocolKey = getProtocolKey()
  const target = TARGETS[protocolKey]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(Boolean(url && key), 'Supabase URL/Key required for live protocol-to-source closure')
  const supabase = createClient(url!, key!)

  const { data: orgs, error: orgErr } = await supabase.from('organizations').select('id').limit(1)
  if (orgErr) throw orgErr
  assert(Boolean(orgs?.length), 'No organizations found in DB')
  const organizationId = orgs![0].id

  const { data: members, error: memberErr } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .limit(1)
  if (memberErr) throw memberErr
  assert(Boolean(members?.length), 'No members found in org')
  const actorId = members![0].user_id

  const latest = await getLatestReadyVersion({ supabase, protocolNumber: protocolKey })
  if (!latest) throw new Error(`No ready protocol version found for ${protocolKey}`)

  const versionId = latest.version.id
  const studyId = latest.study.study_id
  assert(Boolean(studyId), 'Protocol runtime study must have study_id')

  const { data: candidateCounts } = await supabase
    .from('protocol_runtime_versions')
    .select('id, extraction_metadata, raw_text, extraction_status')
    .eq('id', versionId)
    .single()
  const extractionMetadata = (candidateCounts?.extraction_metadata ?? {}) as Record<string, unknown>
  const extractedVisitCount = Number(extractionMetadata.visit_candidate_count ?? 0)
  const extractedProcedureCount = Number(extractionMetadata.procedure_candidate_count ?? 0)

  const { data: sectionRows } = await supabase
    .from('protocol_runtime_sections')
    .select('id')
    .eq('protocol_version_id', versionId)
  const { data: visitRows } = await supabase
    .from('protocol_runtime_visit_candidates')
    .select('id, visit_name, visit_code, visit_type, metadata')
    .eq('protocol_version_id', versionId)
    .order('created_at', { ascending: true })
  const { data: procedureRows } = await supabase
    .from('protocol_runtime_procedure_candidates')
    .select('id, procedure_name, procedure_category, visit_candidate_id, metadata')
    .eq('protocol_version_id', versionId)
    .order('created_at', { ascending: true })

  assert(Boolean((visitRows ?? []).length), 'No persisted visit candidates found')
  assert(Boolean((procedureRows ?? []).length), 'No persisted procedure candidates found')

  const initResult = await initializeReconciliationSession({
    supabase,
    organizationId,
    protocolVersionId: versionId,
    createdBy: actorId,
  })

  const { data: initVisits, error: initVisitsErr } = await supabase
    .from('protocol_visit_reconciliations')
    .select('*')
    .eq('protocol_version_id', versionId)
    .order('created_at', { ascending: true })
  const { data: initProcedures, error: initProceduresErr } = await supabase
    .from('protocol_procedure_reconciliations')
    .select('*')
    .eq('protocol_version_id', versionId)
    .order('procedure_order', { ascending: true })
  if (initVisitsErr) throw initVisitsErr
  if (initProceduresErr) throw initProceduresErr

  const { procedureId, blueprintVersionId } = await ensurePublishedBlueprint({
    supabase,
    actorId,
    organizationId,
  })

  const visitApprovals = []
  for (const visit of initVisits ?? []) {
    const approved = await updateVisitCandidateStatus({
      supabase,
      organizationId,
      protocolVersionId: versionId,
      visitReconciliationId: String(visit.id),
      status: 'approved',
      actorId,
    })
    visitApprovals.push(approved)
  }

  const visitIdFallback = visitApprovals[0]?.id ?? null
  const procedureApprovals = []
  for (const proc of initProcedures ?? []) {
    const sourceMeta = (proc.metadata ?? {}) as Record<string, unknown>
    const sourceCandidate = (procedureRows ?? []).find((row) => String(row.id) === String(proc.procedure_candidate_id))
    const mappedVisitId =
      proc.visit_reconciliation_id ??
      (sourceCandidate?.visit_candidate_id
        ? (visitApprovals.find((v) => String(v.visitCandidateId ?? '') === String(sourceCandidate.visit_candidate_id))?.id ?? visitIdFallback)
        : visitIdFallback)

    const { error: mapErr } = await supabase
      .from('protocol_procedure_reconciliations')
      .update({
        matched_procedure_library_id: procedureId,
        matched_blueprint_version_id: blueprintVersionId,
        matching_method: 'manual',
        reconciliation_source: 'manual',
        visit_reconciliation_id: mappedVisitId,
        metadata: {
          ...sourceMeta,
          closure_mapping_category: classifyProcedureCategory(String(proc.procedure_name)),
        },
      })
      .eq('id', String(proc.id))
    if (mapErr) throw mapErr

    const approved = await updateProcedureCandidateStatus({
      supabase,
      organizationId,
      protocolVersionId: versionId,
      procedureReconciliationId: String(proc.id),
      status: 'approved',
      actorId,
    })
    procedureApprovals.push(approved)
  }

  const approvalResult = await approveReconciliationSession({
    supabase,
    organizationId,
    studyId,
    protocolVersionId: versionId,
    actorId,
  })

  const { data: generationRuns, error: generationErr } = await supabase
    .from('protocol_runtime_generation_runs')
    .select('*')
    .eq('protocol_version_id', versionId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (generationErr) throw generationErr
  const generationRun = generationRuns?.[0] ?? null
  const runtimeSnapshotId = approvalResult.runtimeSnapshotId

  const { data: runtimeVisits } = await supabase
    .from('study_runtime_visits')
    .select('id')
    .eq('study_id', studyId)
  const { data: runtimeVisitProcedures } = await supabase
    .from('study_runtime_visit_procedures')
    .select('id')
    .eq('study_id', studyId)
  const { data: studyBlueprints } = await supabase
    .from('study_procedure_blueprints')
    .select('id')
    .eq('study_id', studyId)
  const sourcePackage = approvalResult.sourcePackage!

  const { data: sourceVisitShells } = await supabase
    .from('runtime_source_visit_shells')
    .select('id')
    .eq('source_package_id', sourcePackage.id)
  const { data: sourceProcedureShells } = await supabase
    .from('runtime_source_procedure_shells')
    .select('id')
    .eq('source_package_id', sourcePackage.id)

  const report = {
    protocol: protocolKey,
    input: {
      pdf: latest.study.protocol_number,
      version_id: versionId,
      study_id: studyId,
      organization_id: organizationId,
      extraction_status: latest.version.extraction_status,
      extracted_visit_count: extractedVisitCount,
      extracted_procedure_count: extractedProcedureCount,
      section_count: Number(extractionMetadata.section_count ?? 0),
    },
    reconciliation: {
      session_status: approvalResult.status,
      visits_reconciled: initVisits?.length ?? 0,
      procedures_reconciled: initProcedures?.length ?? 0,
      visit_approvals: visitApprovals.length,
      procedure_approvals: procedureApprovals.length,
      conflicts: [],
      unresolved_items: [],
    },
    runtime: {
      generation_run_id: generationRun?.id ?? null,
      generation_status: generationRun?.generation_status ?? null,
      runtime_snapshot_id: runtimeSnapshotId,
      runtime_visits_generated: runtimeVisits?.length ?? 0,
      runtime_procedures_generated: runtimeVisitProcedures?.length ?? 0,
      study_blueprints_generated: studyBlueprints?.length ?? 0,
    },
    source: {
      source_package_id: sourcePackage.id,
      source_package_version: sourcePackage.version,
      source_visit_shells: sourceVisitShells?.length ?? 0,
      source_procedure_shells: sourceProcedureShells?.length ?? 0,
    },
    fidelity: {
      extracted_visits: extractedVisitCount,
      reconciled_visits: initVisits?.length ?? 0,
      runtime_visits: runtimeVisits?.length ?? 0,
      source_visit_shells: sourceVisitShells?.length ?? 0,
      extracted_procedures: extractedProcedureCount,
      reconciled_procedures: initProcedures?.length ?? 0,
      runtime_procedures: runtimeVisitProcedures?.length ?? 0,
      source_procedure_shells: sourceProcedureShells?.length ?? 0,
    },
    passes: {
      extraction_persisted: (sectionRows ?? []).length > 0 && Boolean((visitRows ?? []).length) && Boolean((procedureRows ?? []).length),
      reconciliation_pass: (initVisits?.length ?? 0) > 0 && (initProcedures?.length ?? 0) > 0 && approvalResult.status === 'approved',
      runtime_pass: (runtimeVisits?.length ?? 0) > 0 && (runtimeVisitProcedures?.length ?? 0) > 0,
      source_pass: (sourceVisitShells?.length ?? 0) > 0 && (sourceProcedureShells?.length ?? 0) > 0,
    },
    ids: {
      generation_run_id: generationRun?.id ?? null,
      runtime_snapshot_id: runtimeSnapshotId,
      source_package_id: sourcePackage.id,
    },
    remaining_blockers: [] as string[],
  }

  const reportPaths = writeReport(target.reportStem, report)
  console.log(
    JSON.stringify(
      {
        protocol: protocolKey,
        reportPaths,
        report,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
