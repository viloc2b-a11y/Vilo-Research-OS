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

  const { count: openQueryCount } = await supabase
    .from('subject_workflow_actions')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('action_type', 'query')
    .in('status', ['open', 'in_progress'])

  const { count: missedVisitCount } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('visit_status', 'missed')

  const subjectIds = subjectRows.map((s) => s.id as string)
  let unresolvedSafetyCount = 0
  if (subjectIds.length > 0) {
    const { count } = await supabase
      .from('subject_adverse_events')
      .select('ae_id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('study_subject_id', subjectIds)
      .in('lifecycle_status', ['open', 'follow_up'])
    unresolvedSafetyCount = count ?? 0
  }

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

  const sourceCompletionBurdenScore = burdenScore(incompleteSourceCount ?? 0, 2)
  const protocolExecutionBurdenScore = burdenScore(
    (openWorkflowCount ?? 0) + (missedVisitCount ?? 0) + (unresolvedSafetyCount ?? 0),
    3,
  )

  const operationalRiskLevel = deriveStudyRiskLevel({
    criticalSubjectCount,
    attentionSubjectCount,
    openQueryCount: openQueryCount ?? 0,
    missedVisitCount: missedVisitCount ?? 0,
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
        detail: `${unresolvedSafetyCount} open adverse event(s) study-wide.`,
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
