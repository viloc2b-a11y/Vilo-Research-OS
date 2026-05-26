import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import {
  mapVisitReconciliationRow,
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  VISIT_RECONCILIATION_STATUS,
  type CreateManualVisitInput,
  type ProtocolVisitReconciliationRow,
} from './protocol-reconciliation-types'
import { resolveProtocolVersionOrg } from './resolve-protocol-version-org'
import { buildVisitReconciliationStateSnapshot } from './reconciliation-state-hash'

export async function createManualVisitReconciliation(args: {
  supabase: SupabaseClient
  input: CreateManualVisitInput
  createdBy: string
}): Promise<ProtocolVisitReconciliationRow> {
  const context = await resolveProtocolVersionOrg(
    args.supabase,
    args.input.organization_id,
    args.input.protocol_version_id,
  )
  if (!context) throw new Error('Protocol version not found')

  const { data, error } = await args.supabase
    .from('protocol_visit_reconciliations')
    .insert({
      organization_id: args.input.organization_id,
      protocol_version_id: args.input.protocol_version_id,
      visit_candidate_id: null,
      visit_code: args.input.visit_code,
      visit_name: args.input.visit_name,
      visit_type: args.input.visit_type ?? null,
      study_day: args.input.study_day ?? null,
      window_before_days: args.input.window_before_days ?? null,
      window_after_days: args.input.window_after_days ?? null,
      reconciliation_status: VISIT_RECONCILIATION_STATUS.DRAFT,
      reconciliation_source: RECONCILIATION_SOURCE.MANUAL,
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create manual visit reconciliation')

  const mapped = mapVisitReconciliationRow(data as Record<string, unknown>)
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.input.organization_id,
    protocolVersionId: args.input.protocol_version_id,
    eventType: RECONCILIATION_EVENT_TYPE.VISIT_CREATED,
    actorId: args.createdBy,
    visitReconciliationId: mapped.id,
    eventPayload: { source: RECONCILIATION_SOURCE.MANUAL },
    stateSnapshot: buildVisitReconciliationStateSnapshot(mapped),
  })

  return mapped
}
