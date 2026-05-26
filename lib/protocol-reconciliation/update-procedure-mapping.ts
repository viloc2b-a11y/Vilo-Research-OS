import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProcedureBlueprint } from '@/lib/procedure-library/load-blueprint'
import { appendReconciliationEvent } from './append-reconciliation-event'
import { loadProcedureReconciliationById } from './initialize-reconciliation-from-candidates'
import {
  mapProcedureReconciliationRow,
  MATCHING_METHOD,
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  type ProtocolProcedureReconciliationRow,
  type UpdateProcedureMappingInput,
} from './protocol-reconciliation-types'
import { buildProcedureReconciliationStateSnapshot } from './reconciliation-state-hash'

export async function updateProcedureMapping(args: {
  supabase: SupabaseClient
  procedureReconciliationId: string
  input: UpdateProcedureMappingInput
  actorId: string
}): Promise<ProtocolProcedureReconciliationRow> {
  const current = await loadProcedureReconciliationById(
    args.supabase,
    args.input.organization_id,
    args.procedureReconciliationId,
  )
  if (!current) throw new Error('Procedure reconciliation not found')
  if (current.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.APPROVED) {
    throw new Error('Approved procedure mappings cannot be modified')
  }

  const loaded = await loadProcedureBlueprint(args.supabase, args.input.matched_procedure_library_id)
  if (!loaded?.activeVersion) {
    throw new Error('Selected procedure library entry has no active blueprint version')
  }

  const blueprintVersionId =
    args.input.matched_blueprint_version_id ?? loaded.activeVersion.id

  const patch: Record<string, unknown> = {
    matched_procedure_library_id: args.input.matched_procedure_library_id,
    matched_blueprint_version_id: blueprintVersionId,
    matching_method: MATCHING_METHOD.MANUAL,
    match_confidence: 1,
    reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.MATCHED,
    reconciliation_source:
      current.reconciliationSource === RECONCILIATION_SOURCE.CANDIDATE
        ? RECONCILIATION_SOURCE.MODIFIED
        : current.reconciliationSource,
    metadata: {
      ...current.metadata,
      last_mapping_update_at: new Date().toISOString(),
    },
  }

  if (args.input.procedure_name !== undefined) patch.procedure_name = args.input.procedure_name
  if (args.input.procedure_category !== undefined) patch.procedure_category = args.input.procedure_category
  if (args.input.visit_reconciliation_id !== undefined) {
    patch.visit_reconciliation_id = args.input.visit_reconciliation_id
  }
  if (args.input.required !== undefined) patch.required = args.input.required
  if (args.input.procedure_order !== undefined) patch.procedure_order = args.input.procedure_order
  if (args.input.operational_overrides !== undefined) {
    patch.operational_overrides = args.input.operational_overrides
  }

  const { data, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .update(patch)
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update procedure mapping')

  const mapped = mapProcedureReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.input.organization_id,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_MAPPING_MODIFIED,
    actorId: args.actorId,
    procedureReconciliationId: mapped.id,
    eventPayload: {
      matched_procedure_library_id: mapped.matchedProcedureLibraryId,
      matched_blueprint_version_id: mapped.matchedBlueprintVersionId,
    },
    stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
  })

  return mapped
}
