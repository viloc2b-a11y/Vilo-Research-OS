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

export class ProcedureMappingNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcedureMappingNotReadyError'
  }
}

export async function approveProcedureReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  procedureReconciliationId: string
  actorId: string
}): Promise<ProtocolProcedureReconciliationRow> {
  const current = await loadProcedureReconciliationById(
    args.supabase,
    args.organizationId,
    args.procedureReconciliationId,
  )
  if (!current) throw new Error('Procedure reconciliation not found')
  if (current.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.APPROVED) return current

  if (!current.matchedProcedureLibraryId || !current.matchedBlueprintVersionId) {
    throw new ProcedureMappingNotReadyError(
      'Procedure must be mapped to a blueprint version before approval.',
    )
  }

  const approvedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .update({
      reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.APPROVED,
      approved_by: args.actorId,
      approved_at: approvedAt,
    })
    .eq('id', current.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to approve procedure reconciliation')

  const mapped = mapProcedureReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: mapped.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_APPROVED,
    actorId: args.actorId,
    procedureReconciliationId: mapped.id,
    stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
  })

  return mapped
}
