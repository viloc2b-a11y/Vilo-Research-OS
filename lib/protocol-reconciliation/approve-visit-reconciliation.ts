import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import { loadVisitReconciliationById } from './initialize-reconciliation-from-candidates'
import {
  RECONCILIATION_EVENT_TYPE,
  VISIT_RECONCILIATION_STATUS,
  mapVisitReconciliationRow,
  type ProtocolVisitReconciliationRow,
} from './protocol-reconciliation-types'
import { buildVisitReconciliationStateSnapshot } from './reconciliation-state-hash'

export async function approveVisitReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  visitReconciliationId: string
  actorId: string
}): Promise<ProtocolVisitReconciliationRow> {
  const current = await loadVisitReconciliationById(
    args.supabase,
    args.organizationId,
    args.visitReconciliationId,
  )
  if (!current) throw new Error('Visit reconciliation not found')
  if (current.reconciliationStatus === VISIT_RECONCILIATION_STATUS.APPROVED) return current

  const approvedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('protocol_visit_reconciliations')
    .update({
      reconciliation_status: VISIT_RECONCILIATION_STATUS.APPROVED,
      approved_by: args.actorId,
      approved_at: approvedAt,
    })
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to approve visit reconciliation')

  const mapped = mapVisitReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.VISIT_APPROVED,
    actorId: args.actorId,
    visitReconciliationId: mapped.id,
    stateSnapshot: buildVisitReconciliationStateSnapshot(mapped),
  })

  return mapped
}
