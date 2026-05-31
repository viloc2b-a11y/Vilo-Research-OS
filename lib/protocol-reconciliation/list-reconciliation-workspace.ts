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

type SectionEvidence = { title: string | null; type: string | null; text: string | null }
type VisitCandidateEvidence = { confidence: number | null; sectionId: string | null }
type ProcedureCandidateEvidence = {
  text: string | null
  confidence: number | null
  visitCandidateId: string | null
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

/**
 * Read-only evidence enrichment. Reconciliation rows do not store extracted text;
 * we trace each row back to its extraction candidate and source section through
 * existing FKs (visit_candidate_id / procedure_candidate_id -> candidates ->
 * protocol_runtime_sections). Best-effort: any missing/denied source leaves the
 * row's `evidence` as null ("No evidence available" in the UI). No schema changes,
 * no joins required — three version-scoped reads resolved in-memory.
 */
async function attachEvidenceContext(
  supabase: SupabaseClient,
  protocolVersionId: string,
  visits: ReturnType<typeof mapVisitReconciliationRow>[],
  procedures: ReturnType<typeof mapProcedureReconciliationRow>[],
): Promise<void> {
  const [sectionsRes, visitCandidatesRes, procedureCandidatesRes] = await Promise.all([
    supabase
      .from('protocol_runtime_sections')
      .select('id, section_title, section_type, extracted_text')
      .eq('protocol_version_id', protocolVersionId),
    supabase
      .from('protocol_runtime_visit_candidates')
      .select('id, confidence_score, extracted_from_section_id')
      .eq('protocol_version_id', protocolVersionId),
    supabase
      .from('protocol_runtime_procedure_candidates')
      .select('id, extracted_text, confidence_score, visit_candidate_id')
      .eq('protocol_version_id', protocolVersionId),
  ])

  const sectionById = new Map<string, SectionEvidence>()
  for (const row of sectionsRes.data ?? []) {
    sectionById.set(String(row.id), {
      title: toStringOrNull(row.section_title),
      type: toStringOrNull(row.section_type),
      text: toStringOrNull(row.extracted_text),
    })
  }

  const visitCandidateById = new Map<string, VisitCandidateEvidence>()
  for (const row of visitCandidatesRes.data ?? []) {
    visitCandidateById.set(String(row.id), {
      confidence: toNumberOrNull(row.confidence_score),
      sectionId: row.extracted_from_section_id ? String(row.extracted_from_section_id) : null,
    })
  }

  const procedureCandidateById = new Map<string, ProcedureCandidateEvidence>()
  for (const row of procedureCandidatesRes.data ?? []) {
    procedureCandidateById.set(String(row.id), {
      text: toStringOrNull(row.extracted_text),
      confidence: toNumberOrNull(row.confidence_score),
      visitCandidateId: row.visit_candidate_id ? String(row.visit_candidate_id) : null,
    })
  }

  for (const visit of visits) {
    const candidate = visit.visitCandidateId ? visitCandidateById.get(visit.visitCandidateId) : null
    const section = candidate?.sectionId ? sectionById.get(candidate.sectionId) : null
    visit.evidence =
      candidate || section
        ? {
            sectionTitle: section?.title ?? null,
            sectionType: section?.type ?? null,
            extractedText: section?.text ?? null,
            candidateConfidence: candidate?.confidence ?? null,
          }
        : null
  }

  for (const procedure of procedures) {
    const candidate = procedure.procedureCandidateId
      ? procedureCandidateById.get(procedure.procedureCandidateId)
      : null
    const visitCandidate = candidate?.visitCandidateId
      ? visitCandidateById.get(candidate.visitCandidateId)
      : null
    const section = visitCandidate?.sectionId ? sectionById.get(visitCandidate.sectionId) : null
    procedure.evidence = candidate
      ? {
          extractedText: candidate.text,
          candidateConfidence: candidate.confidence,
          sectionTitle: section?.title ?? null,
          sectionType: section?.type ?? null,
        }
      : null
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

  await attachEvidenceContext(supabase, protocolVersionId, visitReconciliations, procedureReconciliations)

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
