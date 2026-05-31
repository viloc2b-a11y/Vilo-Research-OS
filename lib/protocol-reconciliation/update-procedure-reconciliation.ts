import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import { loadProcedureReconciliationById } from './initialize-reconciliation-from-candidates'
import {
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  mapProcedureReconciliationRow,
  type ProtocolProcedureReconciliationRow,
  type UpdateProcedureReconciliationInput,
} from './protocol-reconciliation-types'
import { buildProcedureReconciliationStateSnapshot } from './reconciliation-state-hash'

const EDITABLE_COLUMNS: Record<string, keyof UpdateProcedureReconciliationInput> = {
  procedure_name: 'procedure_name',
  procedure_category: 'procedure_category',
  required: 'required',
  procedure_order: 'procedure_order',
  visit_reconciliation_id: 'visit_reconciliation_id',
}

/**
 * Coordinator correction of extracted procedure fields before approval. Separate
 * from updateProcedureMapping (which requires a library match and forces a
 * 'matched' state) — this edits descriptive fields only and never touches the
 * library mapping or matching_method. Mirrors updateVisitReconciliation: blocks
 * approved rows, flips a candidate-sourced row to 'modified', moves the row back
 * to a review state, and appends an auditable event with a state hash.
 *
 * Audit note: protocol_reconciliation_events.event_type has no procedure-fields
 * value (CHECK constraint, migration 0118) and migrations are out of scope, so we
 * reuse PROCEDURE_MAPPING_MODIFIED with an explicit event_payload action.
 */
export async function updateProcedureReconciliation(args: {
  supabase: SupabaseClient
  procedureReconciliationId: string
  input: UpdateProcedureReconciliationInput
  actorId: string
}): Promise<ProtocolProcedureReconciliationRow> {
  const current = await loadProcedureReconciliationById(
    args.supabase,
    args.input.organization_id,
    args.procedureReconciliationId,
  )
  if (!current) throw new Error('Procedure reconciliation not found')
  if (current.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.APPROVED) {
    throw new Error('Approved procedure reconciliations cannot be modified')
  }

  const patch: Record<string, unknown> = {}
  const changedFields: string[] = []
  for (const [column, key] of Object.entries(EDITABLE_COLUMNS)) {
    const value = args.input[key]
    if (value !== undefined) {
      patch[column] = value
      changedFields.push(column)
    }
  }

  if (changedFields.length === 0) {
    throw new Error('No editable procedure fields were provided')
  }

  // Field edits do not change the library mapping, so matching_method/matched ids
  // are left untouched. Status reflects current mapping state: an unmapped row
  // still requires a mapping, a mapped row just needs re-review.
  patch.reconciliation_status = current.matchedProcedureLibraryId
    ? PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW
    : PROCEDURE_RECONCILIATION_STATUS.MANUAL_MAPPING_REQUIRED
  patch.reconciliation_source =
    current.reconciliationSource === RECONCILIATION_SOURCE.CANDIDATE
      ? RECONCILIATION_SOURCE.MODIFIED
      : current.reconciliationSource
  patch.metadata = {
    ...current.metadata,
    last_procedure_edit_at: new Date().toISOString(),
  }

  const { data, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .update(patch)
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update procedure reconciliation')

  const mapped = mapProcedureReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.input.organization_id,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_MAPPING_MODIFIED,
    actorId: args.actorId,
    procedureReconciliationId: mapped.id,
    eventPayload: { action: 'procedure_fields_modified', changed_fields: changedFields },
    stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
  })

  return mapped
}
