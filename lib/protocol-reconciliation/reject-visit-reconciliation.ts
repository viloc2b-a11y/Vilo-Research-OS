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

export async function rejectVisitReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  visitReconciliationId: string
  actorId: string
  reason?: string
}): Promise<ProtocolVisitReconciliationRow> {
  const current = await loadVisitReconciliationById(
    args.supabase,
    args.organizationId,
    args.visitReconciliationId,
  )
  if (!current) throw new Error('Visit reconciliation not found')

  const { data, error } = await args.supabase
    .from('protocol_visit_reconciliations')
    .update({
      reconciliation_status: VISIT_RECONCILIATION_STATUS.REJECTED,
      metadata: {
        ...current.metadata,
        rejection_reason: args.reason ?? null,
        rejected_at: new Date().toISOString(),
      },
    })
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to reject visit reconciliation')

  const mapped = mapVisitReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.VISIT_REJECTED,
    actorId: args.actorId,
    visitReconciliationId: mapped.id,
    eventPayload: { reason: args.reason ?? null },
    stateSnapshot: buildVisitReconciliationStateSnapshot(mapped),
  })

  return mapped
}
