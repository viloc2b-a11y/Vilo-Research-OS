import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import { loadProcedureReconciliationById } from './initialize-reconciliation-from-candidates'
import {
  mapProcedureReconciliationRow,
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  type ProtocolProcedureReconciliationRow,
} from './protocol-reconciliation-types'
import { buildProcedureReconciliationStateSnapshot } from './reconciliation-state-hash'

export async function rejectProcedureReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  procedureReconciliationId: string
  actorId: string
  reason?: string
}): Promise<ProtocolProcedureReconciliationRow> {
  const current = await loadProcedureReconciliationById(
    args.supabase,
    args.organizationId,
    args.procedureReconciliationId,
  )
  if (!current) throw new Error('Procedure reconciliation not found')

  const { data, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .update({
      reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.REJECTED,
      metadata: {
        ...current.metadata,
        rejection_reason: args.reason ?? null,
        rejected_at: new Date().toISOString(),
      },
    })
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to reject procedure reconciliation')

  const mapped = mapProcedureReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_REJECTED,
    actorId: args.actorId,
    procedureReconciliationId: mapped.id,
    eventPayload: { reason: args.reason ?? null },
    stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
  })

  return mapped
}
