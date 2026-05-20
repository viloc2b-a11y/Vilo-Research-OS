import { buildVisitHealthTimeline } from '@/lib/subject/operations/buildVisitHealthTimeline'
import { getOpenWorkflowActions } from '@/lib/subject/operations/getOpenWorkflowActions'
import { getPendingSignatures } from '@/lib/subject/operations/getPendingSignatures'
import { getSubjectOperationalHealth } from '@/lib/subject/operations/getSubjectOperationalHealth'
import { getUpcomingVisits } from '@/lib/subject/operations/getUpcomingVisits'
import { loadSubjectValidationIssues } from '@/lib/subject/operations/getValidationIssues'
import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import {
  collapsePendingSignatures,
  collapseValidationIssues,
} from '@/lib/subject/signal-density'
import { loadSubjectVisitsPage } from '@/lib/subject/visits/load-subject-visits'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

export async function loadSubjectOperationalIntelligence(input: {
  subjectId: string
  studyId: string
  organizationId: string
  workflowActions?: SubjectWorkflowAction[]
}): Promise<{ ok: true; data: SubjectOperationalIntelligence } | { ok: false; error: string }> {
  const [visitsPage, workflowResult, validationIssues] = await Promise.all([
    loadSubjectVisitsPage(input.subjectId, input.studyId),
    input.workflowActions
      ? Promise.resolve({ ok: true as const, actions: input.workflowActions })
      : loadSubjectWorkflowActions(input.subjectId, input.organizationId),
    loadSubjectValidationIssues(input.subjectId, input.organizationId),
  ])

  if (!visitsPage) {
    return { ok: false, error: 'Could not load subject visits.' }
  }
  if (!workflowResult.ok) {
    return { ok: false, error: workflowResult.error }
  }

  const visits = visitsPage.visits
  const workflowActions = workflowResult.actions

  const upcomingVisits = getUpcomingVisits(visits, input.studyId)
  const pendingActions = getOpenWorkflowActions(workflowActions)
  const pendingSignatures = collapsePendingSignatures(
    getPendingSignatures({ visits, workflowActions }),
  )
  const collapsedValidationIssues = collapseValidationIssues(validationIssues)
  const { health, healthReasons } = getSubjectOperationalHealth({
    visits,
    upcomingVisits,
    pendingActions,
    pendingSignatures,
    validationIssues: collapsedValidationIssues,
  })
  const visitTimeline = buildVisitHealthTimeline(visits, validationIssues)

  return {
    ok: true,
    data: {
      health,
      healthReasons,
      upcomingVisits,
      pendingActions,
      pendingSignatures,
      validationIssues: collapsedValidationIssues,
      visitTimeline,
    },
  }
}
