import { enrichSubjectRuntimeWithCoordinatorOrchestration } from '@/lib/coordinator-orchestration/integration/subject-projection-bridge'
import { enrichSubjectRuntimeWithRuntimeAutomation } from '@/lib/runtime-automation/integration/subject-projection-bridge'
import { enrichSubjectRuntimeWithFinancialRuntime } from '@/lib/financial-runtime/integration/subject-projection-bridge'
import { enrichSubjectRuntimeWithOperationalIntelligence } from '@/lib/operational-intelligence/integration/subject-projection-bridge'
import { subjectChartTabPath } from '@/lib/ops/paths'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations/loadSubjectOperationalIntelligence'
import {
  projectionBlocker,
  deriveOperationalHealthFromSignals,
} from '@/lib/projections/blockers'
import { RUNTIME_PROJECTION_VERSION } from '@/lib/projections/constants'
import {
  countIncompleteSourceForSubject,
  countOpenAdverseEvents,
  isTerminalVisitStatus,
} from '@/lib/projections/compute/shared'
import type { SubjectLongitudinalState, SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

function deriveLongitudinalState(enrollmentStatus: string): SubjectLongitudinalState {
  switch (enrollmentStatus) {
    case 'screening':
    case 'screen_failed':
      return 'screening'
    case 'enrolled':
    case 'randomized':
      return 'active'
    case 'completed':
    case 'withdrawn':
    case 'lost_to_follow_up':
      return 'terminal'
    default:
      return 'unknown'
  }
}

export async function computeSubjectRuntimeProjection(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  options?: { persistOperationalIntelligence?: boolean },
): Promise<SubjectRuntimeProjection | null> {
  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, enrollment_status')
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!subject) return null

  const studyId = subject.study_id as string
  const enrollmentStatus = subject.enrollment_status as string

  const [intelligenceResult, incompleteSourceCount, unresolvedSafetyCount] =
    await Promise.all([
      loadSubjectOperationalIntelligence({
        subjectId: studySubjectId,
        studyId,
        organizationId,
      }),
      countIncompleteSourceForSubject(supabase, studySubjectId, organizationId),
      countOpenAdverseEvents(supabase, studySubjectId, organizationId),
    ])

  const blockers = []

  if (!intelligenceResult.ok) {
    return {
      studySubjectId,
      organizationId,
      studyId,
      computedAt: new Date().toISOString(),
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      longitudinalState: deriveLongitudinalState(enrollmentStatus),
      operationalHealth: 'unknown',
      unresolvedSafetyCount,
      missedVisitCount: 0,
      pendingWorkflowCount: 0,
      incompleteSourceCount,
      openVisitCount: 0,
      blockerCount: 1,
      blockers: [
        projectionBlocker({
          id: 'intelligence-unavailable',
          category: 'system',
          severity: 'warning',
          label: 'Projection partial',
          detail: intelligenceResult.error,
        }),
      ],
      snapshot: { enrollmentStatus },
    }
  }

  const intelligence = intelligenceResult.data
  const visitsHref = subjectChartTabPath(studyId, studySubjectId, 'visits')
  const workflowHref = subjectChartTabPath(studyId, studySubjectId, 'workflow')
  const aeHref = subjectChartTabPath(studyId, studySubjectId, 'adverse-events')

  const missedVisitCount = intelligence.visitTimeline.filter(
    (v) => v.visitStatus === 'missed',
  ).length

  const openVisitCount = intelligence.visitTimeline.filter(
    (v) => !isTerminalVisitStatus(v.visitStatus),
  ).length

  const pendingWorkflowCount = intelligence.pendingActions.length

  if (unresolvedSafetyCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'unresolved-safety',
        category: 'safety',
        severity: 'blocker',
        label: 'Unresolved safety',
        detail: `${unresolvedSafetyCount} open adverse event(s) on registry.`,
        href: aeHref,
      }),
    )
  }

  if (missedVisitCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'missed-visits',
        category: 'visits',
        severity: 'blocker',
        label: 'Missed visits',
        detail: `${missedVisitCount} missed visit(s).`,
        href: visitsHref,
      }),
    )
  }

  if (pendingWorkflowCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'pending-workflow',
        category: 'workflow',
        severity: 'warning',
        label: 'Pending workflows',
        detail: `${pendingWorkflowCount} open workflow item(s).`,
        href: workflowHref,
      }),
    )
  }

  if (incompleteSourceCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'source-backlog',
        category: 'source',
        severity: 'warning',
        label: 'Source backlog',
        detail: `${incompleteSourceCount} incomplete source package(s).`,
        href: visitsHref,
      }),
    )
  }

  const criticalReasons = intelligence.healthReasons
  const attentionReasons: string[] = []
  if (intelligence.health === 'attention') {
    attentionReasons.push(...intelligence.healthReasons)
  }

  const operationalHealth = deriveOperationalHealthFromSignals({
    criticalReasons: intelligence.health === 'critical' ? criticalReasons : [],
    attentionReasons,
  })

  const baseProjection = {
    studySubjectId,
    organizationId,
    studyId,
    computedAt: new Date().toISOString(),
    projectionVersion: RUNTIME_PROJECTION_VERSION,
    longitudinalState: deriveLongitudinalState(enrollmentStatus),
    operationalHealth,
    unresolvedSafetyCount,
    missedVisitCount,
    pendingWorkflowCount,
    incompleteSourceCount,
    openVisitCount,
    blockerCount: blockers.filter((b) => b.severity === 'blocker').length,
    blockers,
    snapshot: {
      enrollmentStatus,
      health: intelligence.health,
      healthReasons: intelligence.healthReasons,
      upcomingVisitCount: intelligence.upcomingVisits.length,
      validationIssueCount: intelligence.validationIssues.length,
    },
  }

  const withIntelligence = await enrichSubjectRuntimeWithOperationalIntelligence({
    supabase,
    projection: baseProjection,
    persist: options?.persistOperationalIntelligence ?? false,
  })

  const withFinancial = await enrichSubjectRuntimeWithFinancialRuntime({
    supabase,
    projection: withIntelligence,
    persist: options?.persistOperationalIntelligence ?? false,
  })

  const withOrchestration = await enrichSubjectRuntimeWithCoordinatorOrchestration({
    supabase,
    projection: withFinancial,
    persist: options?.persistOperationalIntelligence ?? false,
  })

  return enrichSubjectRuntimeWithRuntimeAutomation({
    supabase,
    projection: withOrchestration,
    persist: options?.persistOperationalIntelligence ?? false,
  })
}
