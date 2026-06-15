import {
  burdenScore,
  deriveStudyRiskLevel,
  projectionBlocker,
} from '@/lib/projections/blockers'
import { RUNTIME_PROJECTION_VERSION } from '@/lib/projections/constants'
import { computeSubjectRuntimeProjection } from '@/lib/projections/compute/subject-runtime'
import type { StudyExecutionProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_ENROLLMENT = new Set(['enrolled', 'randomized'])

export async function computeStudyExecutionProjection(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
): Promise<StudyExecutionProjection | null> {
  const { data: study, error } = await supabase
    .from('studies')
    .select('id, organization_id')
    .eq('id', studyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!study) return null

  const { data: subjects, error: subErr } = await supabase
    .from('study_subjects')
    .select('id, enrollment_status')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (subErr) throw new Error(subErr.message)

  const subjectRows = subjects ?? []
  const enrolledSubjectCount = subjectRows.filter((s) =>
    ACTIVE_ENROLLMENT.has(s.enrollment_status as string),
  ).length

  const { count: incompleteSourceCount } = await supabase
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'in_progress'])

  const { count: openWorkflowCount } = await supabase
    .from('subject_workflow_actions')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .in('status', ['open', 'in_progress'])

  const [{ count: wfQueryCount }, { count: snapshotQueryCount }] = await Promise.all([
    supabase
      .from('subject_workflow_actions')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('action_type', 'query')
      .in('status', ['open', 'in_progress']),
    supabase
      .from('visit_snapshot_queries')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .in('query_status', ['open', 'answered']),
  ])
  const openQueryCount = (wfQueryCount ?? 0) + (snapshotQueryCount ?? 0)

  const { count: missedVisitCount } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('visit_status', 'missed')

  const [unresolvedSafetyCount, safetyCandidateCount, openDeviationCount,
    criticalDeviationCount, sponsorNotifiableDeviationCount, irbNotifiableDeviationCount,
    openCapaCount, overdueCapaCount, pendingEffectivenessCapaCount] = await Promise.all([
    supabase.from('safety_events').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .in('event_status', ['open', 'under_review'])
      .then(r => r.count ?? 0, () => 0),
    supabase.from('safety_events').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .eq('event_status', 'candidate')
      .then(r => r.count ?? 0, () => 0),
    supabase.from('protocol_deviations').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .in('status', ['open', 'under_review'])
      .then(r => r.count ?? 0, () => 0),
    supabase.from('protocol_deviations').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .eq('severity', 'critical').neq('status', 'closed')
      .then(r => r.count ?? 0, () => 0),
    supabase.from('protocol_deviations').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .eq('requires_sponsor_notification', true).neq('status', 'closed')
      .then(r => r.count ?? 0, () => 0),
    supabase.from('protocol_deviations').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .eq('requires_irb_notification', true).neq('status', 'closed')
      .then(r => r.count ?? 0, () => 0),
    supabase.from('capa_actions').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .in('capa_status', ['open', 'in_progress', 'under_review'])
      .then(r => r.count ?? 0, () => 0),
    supabase.from('capa_actions').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .not('capa_status', 'eq', 'closed')
      .lt('due_date', new Date().toISOString())
      .then(r => r.count ?? 0, () => 0),
    supabase.from('capa_actions').select('id', { count: 'exact', head: true })
      .eq('study_id', studyId).eq('organization_id', organizationId)
      .eq('effectiveness_check_required', true)
      .eq('effectiveness_check_result', 'pending')
      .not('capa_status', 'eq', 'closed')
      .then(r => r.count ?? 0, () => 0),
  ])

  let criticalSubjectCount = 0
  let attentionSubjectCount = 0
  let activeSubjectCount = 0

  for (const row of subjectRows) {
    const status = row.enrollment_status as string
    if (ACTIVE_ENROLLMENT.has(status)) activeSubjectCount += 1
    if (!ACTIVE_ENROLLMENT.has(status) && status !== 'screening' && status !== 'screen_failed') {
      continue
    }
    const subjectProjection = await computeSubjectRuntimeProjection(
      supabase,
      row.id as string,
      organizationId,
    )
    if (!subjectProjection) continue
    if (subjectProjection.operationalHealth === 'critical') criticalSubjectCount += 1
    else if (subjectProjection.operationalHealth === 'attention') attentionSubjectCount += 1
  }

  const deviationCapaBurden = (openDeviationCount ?? 0) * 2 + (openCapaCount ?? 0) * 3 + (overdueCapaCount ?? 0) * 5
  const sourceCompletionBurdenScore = burdenScore(incompleteSourceCount ?? 0, 2)
  const protocolExecutionBurdenScore = burdenScore(
    (openWorkflowCount ?? 0) + (missedVisitCount ?? 0) + (unresolvedSafetyCount ?? 0) + deviationCapaBurden,
    3,
  )

  const operationalRiskLevel = deriveStudyRiskLevel({
    criticalSubjectCount,
    attentionSubjectCount,
    openQueryCount: openQueryCount ?? 0,
    missedVisitCount: missedVisitCount ?? 0,
    openDeviationCount,
    criticalDeviationCount,
    openCapaCount,
    overdueCapaCount,
    leakageScore: 0,
    criticalLeakageCount: 0,
  })

  const blockers = []
  if ((openQueryCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'open-queries',
        category: 'workflow',
        severity: 'warning',
        label: 'Open queries',
        detail: `${openQueryCount} open data query(ies) across the study.`,
      }),
    )
  }
  if ((missedVisitCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-missed-visits',
        category: 'visits',
        severity: 'blocker',
        label: 'Missed visits',
        detail: `${missedVisitCount} missed visit(s) study-wide.`,
      }),
    )
  }
  if ((unresolvedSafetyCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-safety',
        category: 'safety',
        severity: 'blocker',
        label: 'Unresolved safety',
        detail: `${unresolvedSafetyCount} open safety event(s) study-wide.`,
      }),
    )
  }
  if ((safetyCandidateCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-safety-candidates',
        category: 'safety',
        severity: 'warning',
        label: 'Safety candidates',
        detail: `${safetyCandidateCount} safety candidate(s) awaiting assessment.`,
      }),
    )
  }
  if ((openDeviationCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-open-deviations',
        category: 'deviation',
        severity: 'warning',
        label: 'Open deviations',
        detail: `${openDeviationCount} open deviation(s) across the study.`,
      }),
    )
  }
  if ((criticalDeviationCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-critical-deviations',
        category: 'deviation',
        severity: 'blocker',
        label: 'Critical deviations',
        detail: `${criticalDeviationCount} critical deviation(s) not yet closed.`,
      }),
    )
  }
  if ((sponsorNotifiableDeviationCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-sponsor-notifiable',
        category: 'deviation',
        severity: 'blocker',
        label: 'Sponsor notification required',
        detail: `${sponsorNotifiableDeviationCount} deviation(s) requiring sponsor notification.`,
      }),
    )
  }
  if ((irbNotifiableDeviationCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-irb-notifiable',
        category: 'deviation',
        severity: 'blocker',
        label: 'IRB notification required',
        detail: `${irbNotifiableDeviationCount} deviation(s) requiring IRB notification.`,
      }),
    )
  }
  if ((openCapaCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-open-capa',
        category: 'capa',
        severity: 'warning',
        label: 'Open CAPA',
        detail: `${openCapaCount} open CAPA action(s).`,
      }),
    )
  }
  if ((overdueCapaCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-overdue-capa',
        category: 'capa',
        severity: 'blocker',
        label: 'Overdue CAPA',
        detail: `${overdueCapaCount} CAPA action(s) past due date.`,
      }),
    )
  }
  if ((pendingEffectivenessCapaCount ?? 0) > 0) {
    blockers.push(
      projectionBlocker({
        id: 'study-pending-effectiveness',
        category: 'capa',
        severity: 'warning',
        label: 'Pending effectiveness verification',
        detail: `${pendingEffectivenessCapaCount} CAPA action(s) awaiting effectiveness check.`,
      }),
    )
  }

  return {
    studyId,
    organizationId,
    computedAt: new Date().toISOString(),
    projectionVersion: RUNTIME_PROJECTION_VERSION,
    operationalRiskLevel,
    enrolledSubjectCount,
    activeSubjectCount,
    incompleteSourceCount: incompleteSourceCount ?? 0,
    openWorkflowCount: openWorkflowCount ?? 0,
    openQueryCount: openQueryCount ?? 0,
    missedVisitCount: missedVisitCount ?? 0,
    unresolvedSafetyCount,
    protocolExecutionBurdenScore,
    sourceCompletionBurdenScore,
    blockerCount: blockers.filter((b) => b.severity === 'blocker').length,
    blockers,
    snapshot: {
      subjectCount: subjectRows.length,
      criticalSubjectCount,
      attentionSubjectCount,
    },
  }
}
