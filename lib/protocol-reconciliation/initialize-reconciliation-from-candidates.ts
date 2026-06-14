import type { SupabaseClient } from '@supabase/supabase-js'
import { appendReconciliationEvent } from './append-reconciliation-event'
import {
  mapProcedureReconciliationRow,
  mapVisitReconciliationRow,
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  RECONCILIATION_SOURCE,
  VISIT_RECONCILIATION_STATUS,
  type ProtocolProcedureReconciliationRow,
  type ProtocolVisitReconciliationRow,
} from './protocol-reconciliation-types'
import {
  buildVisitReconciliationStateSnapshot,
  buildProcedureReconciliationStateSnapshot,
} from './reconciliation-state-hash'
import { resolveProtocolVersionOrg } from './resolve-protocol-version-org'

export type InitializeReconciliationResult = {
  visitCount: number
  procedureCount: number
  skippedVisitCount: number
  skippedProcedureCount: number
}

export async function initializeReconciliationFromCandidates(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  createdBy: string
}): Promise<InitializeReconciliationResult> {
  const context = await resolveProtocolVersionOrg(
    args.supabase,
    args.organizationId,
    args.protocolVersionId,
  )
  if (!context) throw new Error('Protocol version not found')

  const [existingVisits, visitCandidates, procedureCandidates] = await Promise.all([
    args.supabase
      .from('protocol_visit_reconciliations')
      .select('visit_candidate_id')
      .eq('protocol_version_id', args.protocolVersionId),
    args.supabase
      .from('protocol_runtime_visit_candidates')
      .select('*')
      .eq('protocol_version_id', args.protocolVersionId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('protocol_runtime_procedure_candidates')
      .select('*')
      .eq('protocol_version_id', args.protocolVersionId)
      .order('created_at', { ascending: true }),
  ])

  if (existingVisits.error) throw new Error(existingVisits.error.message)
  if (visitCandidates.error) throw new Error(visitCandidates.error.message)
  if (procedureCandidates.error) throw new Error(procedureCandidates.error.message)

  const existingVisitCandidateIds = new Set(
    (existingVisits.data ?? [])
      .map((row) => row.visit_candidate_id)
      .filter(Boolean)
      .map(String),
  )

  const visitIdByCandidateId = new Map<string, string>()
  let visitCount = 0
  let skippedVisitCount = 0

  for (const [index, row] of (visitCandidates.data ?? []).entries()) {
    const candidateId = String(row.id)
    if (existingVisitCandidateIds.has(candidateId)) {
      skippedVisitCount += 1
      const { data: existingRow } = await args.supabase
        .from('protocol_visit_reconciliations')
        .select('id')
        .eq('visit_candidate_id', candidateId)
        .maybeSingle()
      if (existingRow?.id) visitIdByCandidateId.set(candidateId, String(existingRow.id))
      continue
    }

    const visitCode = row.visit_code ? String(row.visit_code) : `VISIT-${index + 1}`
    const { data: inserted, error } = await args.supabase
      .from('protocol_visit_reconciliations')
      .insert({
        organization_id: args.organizationId,
        protocol_version_id: args.protocolVersionId,
        visit_candidate_id: candidateId,
        visit_code: visitCode,
        visit_name: String(row.visit_name),
        visit_type: row.visit_type ? String(row.visit_type) : null,
        study_day: row.study_day ?? null,
        window_before_days: row.window_before_days ?? null,
        window_after_days: row.window_after_days ?? null,
        reconciliation_status: VISIT_RECONCILIATION_STATUS.DRAFT,
        reconciliation_source: RECONCILIATION_SOURCE.CANDIDATE,
        created_by: args.createdBy,
      })
      .select('*')
      .single()

    if (error || !inserted) throw new Error(error?.message ?? 'Failed to create visit reconciliation')

    const mapped = mapVisitReconciliationRow(inserted as Record<string, unknown>)
    visitIdByCandidateId.set(candidateId, mapped.id)
    visitCount += 1

    await appendReconciliationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      protocolVersionId: args.protocolVersionId,
      eventType: RECONCILIATION_EVENT_TYPE.VISIT_CREATED,
      actorId: args.createdBy,
      visitReconciliationId: mapped.id,
      eventPayload: { visit_candidate_id: candidateId },
      stateSnapshot: buildVisitReconciliationStateSnapshot(mapped),
    })
  }

  const { data: existingProcedures } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .select('procedure_candidate_id')
    .eq('protocol_version_id', args.protocolVersionId)

  const existingProcedureCandidateIds = new Set(
    (existingProcedures ?? [])
      .map((row) => row.procedure_candidate_id)
      .filter(Boolean)
      .map(String),
  )

  let procedureCount = 0
  let skippedProcedureCount = 0

  for (const [index, row] of (procedureCandidates.data ?? []).entries()) {
    const candidateId = String(row.id)
    if (existingProcedureCandidateIds.has(candidateId)) {
      skippedProcedureCount += 1
      continue
    }

    const visitCandidateId = row.visit_candidate_id ? String(row.visit_candidate_id) : null
    const visitReconciliationId = visitCandidateId
      ? visitIdByCandidateId.get(visitCandidateId) ?? null
      : null

    const { data: inserted, error } = await args.supabase
      .from('protocol_procedure_reconciliations')
      .insert({
        organization_id: args.organizationId,
        protocol_version_id: args.protocolVersionId,
        procedure_candidate_id: candidateId,
        visit_reconciliation_id: visitReconciliationId,
        procedure_name: String(row.procedure_name),
        procedure_category: row.procedure_category ? String(row.procedure_category) : null,
        reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW,
        reconciliation_source: RECONCILIATION_SOURCE.CANDIDATE,
        procedure_order: index + 1,
        created_by: args.createdBy,
      })
      .select('*')
      .single()

    if (error || !inserted) throw new Error(error?.message ?? 'Failed to create procedure reconciliation')
    procedureCount += 1

    const mapped = mapProcedureReconciliationRow(inserted as Record<string, unknown>)
    await appendReconciliationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      protocolVersionId: args.protocolVersionId,
      eventType: RECONCILIATION_EVENT_TYPE.MANUAL_MAPPING_CREATED,
      actorId: args.createdBy,
      procedureReconciliationId: mapped.id,
      eventPayload: { procedure_candidate_id: candidateId, source: 'candidate_init' },
      stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
    })
  }

  await args.supabase
    .from('protocol_runtime_studies')
    .update({ protocol_status: 'runtime_mapping' })
    .eq('id', context.protocolRuntimeStudyId)
    .neq('protocol_status', 'ready_for_generation')

  return { visitCount, procedureCount, skippedVisitCount, skippedProcedureCount }
}

export async function loadVisitReconciliationById(
  supabase: SupabaseClient,
  organizationId: string,
  visitReconciliationId: string,
): Promise<ProtocolVisitReconciliationRow | null> {
  const { data, error } = await supabase
    .from('protocol_visit_reconciliations')
    .select('*')
    .eq('id', visitReconciliationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapVisitReconciliationRow(data as Record<string, unknown>)
}

export async function loadProcedureReconciliationById(
  supabase: SupabaseClient,
  organizationId: string,
  procedureReconciliationId: string,
): Promise<ProtocolProcedureReconciliationRow | null> {
  const { data, error } = await supabase
    .from('protocol_procedure_reconciliations')
    .select('*')
    .eq('id', procedureReconciliationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProcedureReconciliationRow(data as Record<string, unknown>)
}
