import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PROCEDURE_RECONCILIATION_STATUS,
  VISIT_RECONCILIATION_STATUS,
} from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import type { LoadedApprovedReconciliation } from './protocol-runtime-generation-types'

export async function loadApprovedReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
}): Promise<LoadedApprovedReconciliation | null> {
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
  if (!versionRow) return null

  const studyJoin = versionRow.protocol_runtime_studies as
    | { id: string; organization_id: string; study_id: string | null }
    | { id: string; organization_id: string; study_id: string | null }[]
    | null

  const runtimeStudy = (Array.isArray(studyJoin) ? studyJoin[0] : studyJoin) ?? null
  if (!runtimeStudy) return null
  if (String(runtimeStudy.organization_id) !== args.organizationId) return null
  if (!runtimeStudy.study_id) return null

  const protocolRuntimeStudyId = String(runtimeStudy.id)
  const studyId = String(runtimeStudy.study_id)

  const [visitRows, procedureRows] = await Promise.all([
    args.supabase
      .from('protocol_visit_reconciliations')
      .select('*')
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('reconciliation_status', VISIT_RECONCILIATION_STATUS.APPROVED)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('protocol_procedure_reconciliations')
      .select('*')
      .eq('organization_id', args.organizationId)
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('reconciliation_status', PROCEDURE_RECONCILIATION_STATUS.APPROVED)
      .order('procedure_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ])

  if (visitRows.error) throw new Error(visitRows.error.message)
  if (procedureRows.error) throw new Error(procedureRows.error.message)

  const visits = (visitRows.data ?? []).map((row) => ({
    id: String(row.id),
    visitCode: String(row.visit_code),
    visitName: String(row.visit_name),
    visitType: row.visit_type ? String(row.visit_type) : null,
    studyDay: row.study_day === null || row.study_day === undefined ? null : Number(row.study_day),
    windowBeforeDays:
      row.window_before_days === null || row.window_before_days === undefined
        ? null
        : Number(row.window_before_days),
    windowAfterDays:
      row.window_after_days === null || row.window_after_days === undefined
        ? null
        : Number(row.window_after_days),
  }))

  const procedures = (procedureRows.data ?? []).map((row) => ({
    id: String(row.id),
    visitReconciliationId: String(row.visit_reconciliation_id),
    procedureName: String(row.procedure_name),
    procedureCategory: row.procedure_category ? String(row.procedure_category) : null,
    procedureOrder:
      row.procedure_order === null || row.procedure_order === undefined ? null : Number(row.procedure_order),
    required: Boolean(row.required),
    matchedProcedureLibraryId: String(row.matched_procedure_library_id),
    matchedBlueprintVersionId: String(row.matched_blueprint_version_id),
    matchConfidence:
      row.match_confidence === null || row.match_confidence === undefined
        ? null
        : Number(row.match_confidence),
    operationalOverrides: (row.operational_overrides ?? {}) as Record<string, unknown>,
  }))

  return {
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
    protocolRuntimeStudyId,
    studyId,
    visits,
    procedures,
  }
}

