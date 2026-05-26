import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProcedureReconciliationRow,
  mapReconciliationEventRow,
  mapVisitReconciliationRow,
  PROCEDURE_RECONCILIATION_STATUS,
  VISIT_RECONCILIATION_STATUS,
  type LoadedReconciliationWorkspace,
  type ReconciliationWorkspaceSummary,
} from './protocol-reconciliation-types'
import { resolveProtocolVersionOrg } from './resolve-protocol-version-org'

function computeSummary(args: {
  visits: ReturnType<typeof mapVisitReconciliationRow>[]
  procedures: ReturnType<typeof mapProcedureReconciliationRow>[]
  eventCount: number
}): ReconciliationWorkspaceSummary {
  const visitsApproved = args.visits.filter(
    (v) => v.reconciliationStatus === VISIT_RECONCILIATION_STATUS.APPROVED,
  ).length
  const visitsRejected = args.visits.filter(
    (v) => v.reconciliationStatus === VISIT_RECONCILIATION_STATUS.REJECTED,
  ).length
  const visitsPending = args.visits.length - visitsApproved - visitsRejected

  const proceduresApproved = args.procedures.filter(
    (p) => p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.APPROVED,
  ).length
  const proceduresRejected = args.procedures.filter(
    (p) => p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.REJECTED,
  ).length
  const proceduresMatched = args.procedures.filter(
    (p) => p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.MATCHED,
  ).length
  const proceduresNeedsReview = args.procedures.filter(
    (p) =>
      p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW
      || p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.MANUAL_MAPPING_REQUIRED,
  ).length

  const totalItems = args.visits.length + args.procedures.length
  const resolvedItems = visitsApproved + visitsRejected + proceduresApproved + proceduresRejected
  const completenessPercent = totalItems === 0 ? 0 : Math.round((resolvedItems / totalItems) * 100)

  const hasApprovedVisit = visitsApproved > 0
  const allVisitsResolved = visitsPending === 0 && args.visits.length > 0
  const allProceduresResolved =
    proceduresNeedsReview === 0
    && proceduresMatched === 0
    && args.procedures.filter((p) => p.reconciliationStatus !== PROCEDURE_RECONCILIATION_STATUS.REJECTED).every(
      (p) => p.reconciliationStatus === PROCEDURE_RECONCILIATION_STATUS.APPROVED,
    )

  return {
    visitCount: args.visits.length,
    procedureCount: args.procedures.length,
    visitsApproved,
    visitsRejected,
    visitsPending,
    proceduresApproved,
    proceduresRejected,
    proceduresMatched,
    proceduresNeedsReview,
    eventCount: args.eventCount,
    completenessPercent,
    readyForRuntimeGeneration: hasApprovedVisit && allVisitsResolved && allProceduresResolved,
  }
}

export async function listReconciliationWorkspace(
  supabase: SupabaseClient,
  organizationId: string,
  protocolVersionId: string,
): Promise<LoadedReconciliationWorkspace | null> {
  const context = await resolveProtocolVersionOrg(supabase, organizationId, protocolVersionId)
  if (!context) return null

  const [visits, procedures, events] = await Promise.all([
    supabase
      .from('protocol_visit_reconciliations')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('protocol_procedure_reconciliations')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)
      .order('procedure_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('protocol_reconciliation_events')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)
      .order('event_timestamp', { ascending: false })
      .limit(100),
  ])

  if (visits.error) throw new Error(visits.error.message)
  if (procedures.error) throw new Error(procedures.error.message)
  if (events.error) throw new Error(events.error.message)

  const visitReconciliations = (visits.data ?? []).map((row) =>
    mapVisitReconciliationRow(row as Record<string, unknown>),
  )
  const procedureReconciliations = (procedures.data ?? []).map((row) =>
    mapProcedureReconciliationRow(row as Record<string, unknown>),
  )
  const eventRows = (events.data ?? []).map((row) => mapReconciliationEventRow(row as Record<string, unknown>))

  const summary = computeSummary({
    visits: visitReconciliations,
    procedures: procedureReconciliations,
    eventCount: eventRows.length,
  })

  return {
    protocolVersionId,
    organizationId,
    versionLabel: context.versionLabel,
    visitReconciliations,
    procedureReconciliations,
    events: eventRows,
    summary,
  }
}
