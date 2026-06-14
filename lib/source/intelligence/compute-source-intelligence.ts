/**
 * Source Intelligence — compute signals for a visit's source status.
 *
 * Signals:
 *   missing     — procedure execution exists but no response set is present
 *   incomplete  — response set exists but status is 'draft' or 'in_progress' (not yet submitted)
 *   overdue     — response set exists but was not submitted within 24h of visit scheduled_date
 *   inconsistent — unresolved validation findings (open/acknowledged) exist for a response set
 *
 * Note on "missing" heuristic: the mission spec references `workflow_status IN
 * ('completed', 'source_submitted')`. That field does not exist in this schema.
 * We instead use `execution_status = 'completed'` on procedure_executions as the
 * signal that a procedure was done and source should exist.
 *
 * Note on "incomplete": source_response_sets has no is_complete boolean column.
 * We derive completion from status: any status other than 'draft' or 'in_progress'
 * is considered submitted/complete for the purposes of this signal.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceIntelligenceSignalKind = 'missing' | 'incomplete' | 'overdue' | 'inconsistent'
export type SourceIntelligenceSeverity = 'critical' | 'warning' | 'info'

export type SourceIntelligenceSignal = {
  kind: SourceIntelligenceSignalKind
  severity: SourceIntelligenceSeverity
  procedureExecutionId?: string
  responseSetId?: string
  message: string
}

export type SourceIntelligenceReport = {
  visitId: string
  totalProcedures: number
  completedWithSource: number
  signals: SourceIntelligenceSignal[]
  hasBlockers: boolean
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export async function computeSourceIntelligence(args: {
  supabase: SupabaseClient
  organizationId: string
  visitId: string
  subjectId?: string
}): Promise<SourceIntelligenceReport> {
  const { supabase, organizationId, visitId, subjectId } = args

  // 1. Load visit scheduled_date (needed for overdue check)
  const { data: visit } = await supabase
    .from('visits')
    .select('id, scheduled_date, study_subject_id')
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const scheduledDate: string | null = visit?.scheduled_date ?? null

  // 2. Load procedure executions for this visit
  let peQuery = supabase
    .from('procedure_executions')
    .select('id, execution_status')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  if (subjectId) {
    // Filter to subject via visit's study_subject_id — procedure_executions
    // doesn't have study_subject_id directly, so we rely on visit scoping which
    // already implies the subject. This param is accepted but has no additional
    // filter at the PE level.
    void subjectId
  }

  const { data: procedureExecutions } = await peQuery

  const allPes = procedureExecutions ?? []
  const completedPes = allPes.filter((pe) => pe.execution_status === 'completed')
  const completedPeIds = completedPes.map((pe) => pe.id)

  // 3. Load response sets for this visit
  let rsQuery = supabase
    .from('source_response_sets')
    .select('id, procedure_execution_id, status, submitted_at, opened_at')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)
    .neq('status', 'archived')

  const { data: responseSets } = await rsQuery
  const allRs = responseSets ?? []

  // Index by procedure_execution_id for O(1) lookup
  const rsByPeId = new Map<string, typeof allRs[number]>()
  for (const rs of allRs) {
    if (rs.procedure_execution_id) {
      rsByPeId.set(rs.procedure_execution_id, rs)
    }
  }

  const responseSetIds = allRs.map((rs) => rs.id)

  // 4. Load unresolved validation findings for these response sets
  const { data: findings } = responseSetIds.length > 0
    ? await supabase
        .from('source_response_validation_findings')
        .select('id, response_set_id, severity, message, status')
        .in('response_set_id', responseSetIds)
        .in('status', ['open', 'acknowledged'])
    : { data: [] as { id: string; response_set_id: string; severity: string; message: string; status: string }[] }

  // Index findings by response_set_id
  const findingsByRsId = new Map<string, typeof findings>()
  for (const f of findings ?? []) {
    const existing = findingsByRsId.get(f.response_set_id) ?? []
    existing.push(f)
    findingsByRsId.set(f.response_set_id, existing)
  }

  const signals: SourceIntelligenceSignal[] = []
  let completedWithSource = 0

  // 5. Compute signals
  for (const pe of completedPes) {
    const rs = rsByPeId.get(pe.id)

    // --- MISSING: completed procedure with no response set ---
    if (!rs) {
      signals.push({
        kind: 'missing',
        severity: 'critical',
        procedureExecutionId: pe.id,
        message: `Procedure ${pe.id.slice(0, 8)} is marked completed but has no source response set.`,
      })
      continue
    }

    completedWithSource++

    // --- INCOMPLETE: response set exists but not yet submitted ---
    const isSubmitted = !['draft', 'in_progress'].includes(rs.status)
    if (!isSubmitted) {
      signals.push({
        kind: 'incomplete',
        severity: 'warning',
        procedureExecutionId: pe.id,
        responseSetId: rs.id,
        message: `Response set ${rs.id.slice(0, 8)} is incomplete (status: ${rs.status}).`,
      })
    }

    // --- OVERDUE: submitted more than 24h after visit scheduled_date ---
    if (isSubmitted && rs.submitted_at && scheduledDate) {
      const visitDate = new Date(scheduledDate)
      const submittedAt = new Date(rs.submitted_at)
      const diffHours = (submittedAt.getTime() - visitDate.getTime()) / (1000 * 60 * 60)
      if (diffHours > 24) {
        signals.push({
          kind: 'overdue',
          severity: 'warning',
          procedureExecutionId: pe.id,
          responseSetId: rs.id,
          message: `Response set ${rs.id.slice(0, 8)} was submitted ${Math.round(diffHours)}h after the visit scheduled date (threshold: 24h).`,
        })
      }
    }

    // --- INCONSISTENT: unresolved validation findings ---
    const rsFindings = findingsByRsId.get(rs.id) ?? []
    const errorFindings = rsFindings.filter((f) => f.severity === 'error')
    const warningFindings = rsFindings.filter((f) => f.severity === 'warning')

    if (errorFindings.length > 0) {
      signals.push({
        kind: 'inconsistent',
        severity: 'critical',
        responseSetId: rs.id,
        message: `${errorFindings.length} unresolved error finding(s) on response set ${rs.id.slice(0, 8)}.`,
      })
    } else if (warningFindings.length > 0) {
      signals.push({
        kind: 'inconsistent',
        severity: 'warning',
        responseSetId: rs.id,
        message: `${warningFindings.length} unresolved warning finding(s) on response set ${rs.id.slice(0, 8)}.`,
      })
    }
  }

  return {
    visitId,
    totalProcedures: allPes.length,
    completedWithSource,
    signals,
    hasBlockers: signals.some((s) => s.severity === 'critical'),
  }
}
