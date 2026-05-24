import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SubjectRuntimeUiModel } from '@/lib/runtime-ui/types'
import { MAX_AUTOMATION_PROPOSALS_SHOWN, MAX_BLOCKERS_SHOWN } from '@/lib/runtime-ui/guardrails'

type AutoRow = {
  proposed_actions?: Array<{
    id: string
    ruleId: string
    kind: string
    label: string
    detail: string
    priority: number
    status: string
    requiresCoordinatorApproval: boolean
  }>
}

export function mapSubjectRuntimeUiModel(input: {
  subject: SubjectRuntimeProjection
  automation?: AutoRow | null
}): SubjectRuntimeUiModel {
  const snap = input.subject.snapshot
  const orch = snap.coordinatorOrchestration as
    | { escalationLevel?: string; nextActionLabel?: string; actionNowCount?: number; piReviewCount?: number; escalationCount?: number }
    | undefined
  const autoSnap = snap.runtimeAutomation as { pendingApplyCount?: number } | undefined

  const blockers = input.subject.blockers.slice(0, MAX_BLOCKERS_SHOWN).map((b) => ({
    id: b.id,
    category: b.category,
    severity: b.severity,
    label: b.label,
    detail: b.detail,
    href: b.href ?? null,
  }))

  const automationProposals = (input.automation?.proposed_actions ?? [])
    .filter((a) => a.status === 'proposed')
    .slice(0, MAX_AUTOMATION_PROPOSALS_SHOWN)
    .map((a) => ({
      id: a.id,
      ruleId: a.ruleId,
      kind: a.kind,
      label: a.label,
      detail: a.detail,
      priority: a.priority,
      status: a.status,
      requiresCoordinatorApproval: a.requiresCoordinatorApproval,
    }))

  return {
    studySubjectId: input.subject.studySubjectId,
    organizationId: input.subject.organizationId,
    studyId: input.subject.studyId,
    operationalHealth: input.subject.operationalHealth,
    escalationLevel: orch?.escalationLevel ?? null,
    nextAction: orch?.nextActionLabel
      ? {
          label: orch.nextActionLabel,
          detail: null,
          kind: null,
          priority: 0,
          requiresPiReview: false,
          requiresEscalation: (orch.escalationCount ?? 0) > 0,
          href: null,
        }
      : null,
    whyBlocked: {
      blocked: input.subject.blockerCount > 0 || input.subject.operationalHealth === 'critical',
      readinessStatus: input.subject.operationalHealth,
      primaryCauses: blockers.filter((b) => b.severity === 'blocker').map((b) => b.label),
      blockerRows: blockers.filter((b) => b.severity === 'blocker'),
    },
    workQueueSummary: {
      actionNow: orch?.actionNowCount ?? 0,
      piReview: orch?.piReviewCount ?? 0,
      escalation: orch?.escalationCount ?? 0,
    },
    automationProposals,
    openVisitCount: input.subject.openVisitCount,
    overloadCompact: automationProposals.length > 4,
    pendingAutomationApplyCount: autoSnap?.pendingApplyCount ?? automationProposals.length,
  }
}
