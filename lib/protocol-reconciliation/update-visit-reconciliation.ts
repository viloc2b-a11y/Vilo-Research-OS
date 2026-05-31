import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import { loadVisitReconciliationById } from './initialize-reconciliation-from-candidates'
import {
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  VISIT_RECONCILIATION_STATUS,
  mapVisitReconciliationRow,
  type ProtocolVisitReconciliationRow,
  type UpdateVisitReconciliationInput,
} from './protocol-reconciliation-types'
import { buildVisitReconciliationStateSnapshot } from './reconciliation-state-hash'

const EDITABLE_COLUMNS: Record<string, keyof UpdateVisitReconciliationInput> = {
  visit_code: 'visit_code',
  visit_name: 'visit_name',
  visit_type: 'visit_type',
  study_day: 'study_day',
  window_before_days: 'window_before_days',
  window_after_days: 'window_after_days',
}

/**
 * Coordinator correction of extracted visit fields before approval. Mirrors the
 * updateProcedureMapping pattern: blocks edits once approved, flips a
 * candidate-sourced row to 'modified', moves the row to 'needs_review' so the
 * change is re-reviewed, and appends an auditable event with a state hash.
 *
 * Audit note: protocol_reconciliation_events.event_type has no visit-modified
 * value (CHECK constraint, migration 0118) and migrations are out of scope, so
 * we reuse VISIT_CREATED with an explicit event_payload action describing the
 * modification.
 */
export async function updateVisitReconciliation(args: {
  supabase: SupabaseClient
  visitReconciliationId: string
  input: UpdateVisitReconciliationInput
  actorId: string
}): Promise<ProtocolVisitReconciliationRow> {
  const current = await loadVisitReconciliationById(
    args.supabase,
    args.input.organization_id,
    args.visitReconciliationId,
  )
  if (!current) throw new Error('Visit reconciliation not found')
  if (current.reconciliationStatus === VISIT_RECONCILIATION_STATUS.APPROVED) {
    throw new Error('Approved visit reconciliations cannot be modified')
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
    throw new Error('No editable visit fields were provided')
  }

  patch.reconciliation_status = VISIT_RECONCILIATION_STATUS.NEEDS_REVIEW
  patch.reconciliation_source =
    current.reconciliationSource === RECONCILIATION_SOURCE.CANDIDATE
      ? RECONCILIATION_SOURCE.MODIFIED
      : current.reconciliationSource
  patch.metadata = {
    ...current.metadata,
    last_visit_edit_at: new Date().toISOString(),
  }

  const { data, error } = await args.supabase
    .from('protocol_visit_reconciliations')
    .update(patch)
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update visit reconciliation')

  const mapped = mapVisitReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.input.organization_id,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.VISIT_CREATED,
    actorId: args.actorId,
    visitReconciliationId: mapped.id,
    eventPayload: { action: 'visit_fields_modified', changed_fields: changedFields },
    stateSnapshot: buildVisitReconciliationStateSnapshot(mapped),
  })

  return mapped
}
