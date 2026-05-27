import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PROCEDURE_RECONCILIATION_STATUS,
  VISIT_RECONCILIATION_STATUS,
} from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import type { ValidateGenerationReadinessResult, ValidationError } from './protocol-runtime-generation-types'

export async function validateRuntimeGenerationReadiness(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
}): Promise<ValidateGenerationReadinessResult> {
  const errors: ValidationError[] = []

  const { data: versionRow, error: versionError } = await args.supabase
    .from('protocol_runtime_versions')
    .select(
      `
      id,
      protocol_runtime_study_id,
      protocol_runtime_studies!inner (
        id,
        organization_id,
        study_id
      )
    `,
    )
    .eq('id', args.protocolVersionId)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!versionRow) {
    return { ok: false, errors: [{ code: 'version_not_found', message: 'Protocol version not found.' }], summary: {} }
  }

  const join = versionRow.protocol_runtime_studies as
    | { id: string; organization_id: string; study_id: string | null }
    | { id: string; organization_id: string; study_id: string | null }[]
    | null
  const runtimeStudy = (Array.isArray(join) ? join[0] : join) ?? null
  if (!runtimeStudy || String(runtimeStudy.organization_id) !== args.organizationId) {
    return { ok: false, errors: [{ code: 'org_mismatch', message: 'Protocol version not found.' }], summary: {} }
  }

  if (!runtimeStudy.study_id) {
    errors.push({
      code: 'missing_study_id',
      scope: 'study',
      message: 'Protocol runtime study must be linked to a study_id before runtime generation.',
      record_id: String(runtimeStudy.id),
    })
  }

  const [visitCounts, procCounts, approvedProcMissingBlueprint] = await Promise.all([
    args.supabase
      .from('protocol_visit_reconciliations')
      .select('reconciliation_status', { count: 'exact', head: true })
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .not(
        'reconciliation_status',
        'in',
        `("${VISIT_RECONCILIATION_STATUS.APPROVED}","${VISIT_RECONCILIATION_STATUS.REJECTED}")`,
      ),
    args.supabase
      .from('protocol_procedure_reconciliations')
      .select('reconciliation_status', { count: 'exact', head: true })
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .not(
        'reconciliation_status',
        'in',
        `("${PROCEDURE_RECONCILIATION_STATUS.APPROVED}","${PROCEDURE_RECONCILIATION_STATUS.REJECTED}")`,
      ),
    args.supabase
      .from('protocol_procedure_reconciliations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('reconciliation_status', PROCEDURE_RECONCILIATION_STATUS.APPROVED)
      .or('matched_blueprint_version_id.is.null,matched_procedure_library_id.is.null'),
  ])

  if (visitCounts.error) throw new Error(visitCounts.error.message)
  if (procCounts.error) throw new Error(procCounts.error.message)
  if (approvedProcMissingBlueprint.error) throw new Error(approvedProcMissingBlueprint.error.message)

  const unresolvedVisits = visitCounts.count ?? 0
  const unresolvedProcedures = procCounts.count ?? 0
  const approvedMissingBlueprint = approvedProcMissingBlueprint.count ?? 0

  const [approvedVisitsResult, approvedProceduresResult] = await Promise.all([
    args.supabase
      .from('protocol_visit_reconciliations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('reconciliation_status', VISIT_RECONCILIATION_STATUS.APPROVED),
    args.supabase
      .from('protocol_procedure_reconciliations')
      .select('matched_procedure_library_id, matched_blueprint_version_id', { count: 'exact' })
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('reconciliation_status', PROCEDURE_RECONCILIATION_STATUS.APPROVED),
  ])

  if (approvedVisitsResult.error) throw new Error(approvedVisitsResult.error.message)
  if (approvedProceduresResult.error) throw new Error(approvedProceduresResult.error.message)

  const approvedVisits = approvedVisitsResult.count ?? 0
  const approvedProcedures = approvedProceduresResult.count ?? 0
  const distinctMappings = new Set(
    (approvedProceduresResult.data ?? [])
      .map((row) => `${row.matched_procedure_library_id}:${row.matched_blueprint_version_id}`),
  ).size

  if (unresolvedVisits > 0) {
    errors.push({
      code: 'unresolved_visits',
      scope: 'visit',
      message: `Protocol version has ${unresolvedVisits} unresolved visit reconciliations.`,
      metadata: { unresolved_count: unresolvedVisits },
    })
  }
  if (unresolvedProcedures > 0) {
    errors.push({
      code: 'unresolved_procedures',
      scope: 'procedure',
      message: `Protocol version has ${unresolvedProcedures} unresolved procedure reconciliations.`,
      metadata: { unresolved_count: unresolvedProcedures },
    })
  }
  if (approvedMissingBlueprint > 0) {
    errors.push({
      code: 'approved_missing_blueprint',
      scope: 'procedure',
      message: `Approved procedures missing matched blueprint version: ${approvedMissingBlueprint}.`,
      metadata: { count: approvedMissingBlueprint },
    })
  }

  const summary = {
    protocol_runtime_study_id: String(runtimeStudy.id),
    study_id: runtimeStudy.study_id ? String(runtimeStudy.study_id) : null,
    approved_visits: approvedVisits,
    approved_procedures: approvedProcedures,
    distinct_mappings: distinctMappings,
    unresolved_visits: unresolvedVisits,
    unresolved_procedures: unresolvedProcedures,
    approved_missing_blueprint: approvedMissingBlueprint,
  }

  return { ok: errors.length === 0, errors, summary }
}

