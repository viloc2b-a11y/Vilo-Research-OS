import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapReconciliationEventRow,
  type ProtocolReconciliationEventRow,
  type ReconciliationEventType,
} from './protocol-reconciliation-types'
import { computeReconciliationStateHash } from './reconciliation-state-hash'

export type AppendReconciliationEventArgs = {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  eventType: ReconciliationEventType
  actorId?: string | null
  visitReconciliationId?: string | null
  procedureReconciliationId?: string | null
  eventPayload?: Record<string, unknown>
  stateSnapshot: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function appendReconciliationEvent(
  args: AppendReconciliationEventArgs,
): Promise<ProtocolReconciliationEventRow> {
  const stateHash = computeReconciliationStateHash(args.stateSnapshot)

  const { data, error } = await args.supabase
    .from('protocol_reconciliation_events')
    .insert({
      organization_id: args.organizationId,
      protocol_version_id: args.protocolVersionId,
      visit_reconciliation_id: args.visitReconciliationId ?? null,
      procedure_reconciliation_id: args.procedureReconciliationId ?? null,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      event_timestamp: new Date().toISOString(),
      event_payload: args.eventPayload ?? {},
      state_hash: stateHash,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to append reconciliation event: ${error?.message ?? 'Unknown error'}`)
  }

  return mapReconciliationEventRow(data as Record<string, unknown>)
}
