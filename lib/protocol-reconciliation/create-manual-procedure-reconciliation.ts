import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import {
  mapProcedureReconciliationRow,
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  MATCHING_METHOD,
  type CreateManualProcedureInput,
  type ProtocolProcedureReconciliationRow,
} from './protocol-reconciliation-types'
import { resolveProtocolVersionOrg } from './resolve-protocol-version-org'
import { buildProcedureReconciliationStateSnapshot } from './reconciliation-state-hash'

export async function createManualProcedureReconciliation(args: {
  supabase: SupabaseClient
  input: CreateManualProcedureInput
  createdBy: string
}): Promise<ProtocolProcedureReconciliationRow> {
  const context = await resolveProtocolVersionOrg(
    args.supabase,
    args.input.organization_id,
    args.input.protocol_version_id,
  )
  if (!context) throw new Error('Protocol version not found')

  const { data, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .insert({
      organization_id: args.input.organization_id,
      protocol_version_id: args.input.protocol_version_id,
      procedure_candidate_id: null,
      visit_reconciliation_id: args.input.visit_reconciliation_id ?? null,
      procedure_name: args.input.procedure_name,
      procedure_category: args.input.procedure_category ?? null,
      reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.MANUAL_MAPPING_REQUIRED,
      reconciliation_source: RECONCILIATION_SOURCE.MANUAL,
      matching_method: MATCHING_METHOD.NONE,
      required: args.input.required ?? true,
      procedure_order: args.input.procedure_order ?? null,
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create manual procedure reconciliation')

  const mapped = mapProcedureReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.input.organization_id,
    protocolVersionId: args.input.protocol_version_id,
    eventType: RECONCILIATION_EVENT_TYPE.MANUAL_MAPPING_CREATED,
    actorId: args.createdBy,
    procedureReconciliationId: mapped.id,
    eventPayload: { source: RECONCILIATION_SOURCE.MANUAL },
    stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
  })

  return mapped
}
