import { mapVisitRuntimeWorkQueueBuckets } from '@/lib/coordinator-operations/map-operational-work-queue'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import {
  MAX_AUTOMATION_PROPOSALS_SHOWN,
  MAX_BLOCKERS_SHOWN,
  MAX_WORK_QUEUE_ITEMS_SHOWN,
  shouldShowLeakageWarning,
} from '@/lib/runtime-ui/guardrails'
import type {
  VisitRuntimeUiModel,
  RuntimeUiAutomationProposal,
  RuntimeUiBlockerRow,
  RuntimeUiNextAction,
  RuntimeUiWorkQueueBucket,
} from '@/lib/runtime-ui/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

type OrchRow = {
  next_actions?: Array<{
    id: string
    kind: string
    label: string
    detail: string
    priority: number
    requiresPiReview: boolean
    requiresEscalation: boolean
    href?: string | null
  }>
  work_queue?: {
    actionNow?: Array<{ label: string; kind: string; priority: number }>
    piReview?: Array<{ label: string; kind: string; priority: number }>
    escalation?: Array<{ label: string; kind: string; priority: number }>
    coordinatorFollowUp?: Array<{ label: string; kind: string; priority: number }>
    canWait?: Array<{ label: string; kind: string; priority: number }>
    blocked?: Array<{ label: string; kind: string; priority: number }>
  }
  urgency?: { level?: string }
  visit_execution?: { phase?: string }
}

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
  pending_apply_count?: number
}

function mapBlockers(blockers: VisitReadinessProjection['blockers']): RuntimeUiBlockerRow[] {
  return blockers.map((b) => ({
    id: b.id,
    category: b.category,
    severity: b.severity,
    label: b.label,
    detail: b.detail,
    href: b.href ?? null,
  }))
}

function mapNextAction(
  orch: OrchRow | null,
  snap: Record<string, unknown>,
): RuntimeUiNextAction | null {
  const fromSnap = snap.coordinatorOrchestration as
    | { nextActionLabel?: string; nextActionKind?: string }
    | undefined
  const top = orch?.next_actions?.[0]
  if (top) {
    return {
      label: top.label,
      detail: top.detail,
      kind: top.kind,
      priority: top.priority,
      requiresPiReview: top.requiresPiReview,
      requiresEscalation: top.requiresEscalation,
      href: top.href ?? null,
    }
  }
  if (fromSnap?.nextActionLabel) {
    return {
      label: fromSnap.nextActionLabel,
      detail: null,
      kind: fromSnap.nextActionKind ?? null,
      priority: 0,
      requiresPiReview: fromSnap.nextActionKind === 'pi_review',
      requiresEscalation: false,
      href: null,
    }
  }
  return null
}

function mapWorkQueue(
  orch: OrchRow | null,
  readiness: VisitReadinessProjection,
): RuntimeUiWorkQueueBucket[] {
  return mapVisitRuntimeWorkQueueBuckets(orch, {
    missingSourceCount: readiness.missingSourceCount,
    unsignedProcedureCount: readiness.unsignedProcedureCount,
    safetyBlockerCount: readiness.safetyBlockerCount,
  })
}

function mapAutomation(auto: AutoRow | null): RuntimeUiAutomationProposal[] {
  return (auto?.proposed_actions ?? [])
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
}

export function mapVisitRuntimeUiModel(input: {
  readiness: VisitReadinessProjection
  orchestration?: OrchRow | null
  automation?: AutoRow | null
}): VisitRuntimeUiModel {
  const snap = input.readiness.snapshot
  const fin = snap.financialRuntime as
    | { leakageScore?: number; topLeakage?: string[]; leakageItemCount?: number }
    | undefined
  const orchSnap = snap.coordinatorOrchestration as { piReviewCount?: number } | undefined

  const explanation = explainVisitReadinessBlocked({ projection: input.readiness })
  const allBlockers = mapBlockers(input.readiness.blockers)

  const safetyGovernanceBlockers = allBlockers
    .filter(
      (b) =>
        b.category.includes('safety')
        || b.category.includes('governance')
        || b.category === 'protocol_graph',
    )
    .slice(0, MAX_BLOCKERS_SHOWN)

  const leakageScore = fin?.leakageScore ?? 0
  const actionableLeakage =
    (fin?.leakageItemCount ?? 0) > 0
    || input.readiness.missingSourceCount > 0
    || input.readiness.unsignedProcedureCount > 0

  const workQueue = mapWorkQueue(input.orchestration ?? null, input.readiness)
  const piReviewNeeded =
    (orchSnap?.piReviewCount ?? 0) > 0
    || (input.orchestration?.work_queue?.piReview?.length ?? 0) > 0

  const automationProposals = mapAutomation(input.automation ?? null)
  const overloadCompact =
    automationProposals.length + workQueue.reduce((n, b) => n + b.items.length, 0) > 12

  return {
    visitId: input.readiness.visitId,
    organizationId: input.readiness.organizationId,
    studyId: input.readiness.studyId,
    studySubjectId: input.readiness.studySubjectId,
    readinessStatus: input.readiness.readinessStatus,
    computedAt: input.readiness.computedAt,
    nextAction: mapNextAction(input.orchestration ?? null, snap),
    whyBlocked: {
      blocked: explanation.blocked,
      readinessStatus: explanation.readinessStatus,
      primaryCauses: explanation.primaryCauses.slice(0, 6),
      blockerRows: allBlockers
        .filter((b) => b.severity === 'blocker')
        .slice(0, MAX_BLOCKERS_SHOWN),
    },
    safetyGovernanceBlockers,
    leakage: {
      show: shouldShowLeakageWarning({ leakageScore, actionableLeakage }),
      leakageScore,
      topLeakage: fin?.topLeakage ?? [],
      recommendedFix: fin?.topLeakage?.[0] ?? (actionableLeakage ? 'Resolve source and signatures' : null),
    },
    workQueue,
    automationProposals,
    piReviewNeeded,
    urgencyLevel:
      (input.orchestration?.urgency?.level as string)
      ?? (snap.coordinatorOrchestration as { urgencyLevel?: string })?.urgencyLevel
      ?? null,
    visitPhase:
      (input.orchestration?.visit_execution?.phase as string)
      ?? (snap.coordinatorOrchestration as { visitPhase?: string })?.visitPhase
      ?? null,
    overloadCompact,
    pendingAutomationApplyCount: input.automation?.pending_apply_count ?? automationProposals.length,
  }
}
