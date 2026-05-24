/**
 * Phase 10 — Coordinator runtime UI view models (presentation only).
 */

export type RuntimeUiBlockerRow = {
  id: string
  category: string
  severity: 'blocker' | 'warning' | 'info'
  label: string
  detail: string
  href: string | null
}

export type RuntimeUiNextAction = {
  label: string
  detail: string | null
  kind: string | null
  priority: number
  requiresPiReview: boolean
  requiresEscalation: boolean
  href: string | null
}

export type RuntimeUiWorkQueueBucket = {
  bucket: string
  items: Array<{ label: string; kind: string; priority: number }>
}

export type RuntimeUiLeakageWarning = {
  show: boolean
  leakageScore: number
  topLeakage: string[]
  recommendedFix: string | null
}

export type RuntimeUiAutomationProposal = {
  id: string
  ruleId: string
  kind: string
  label: string
  detail: string
  priority: number
  status: string
  requiresCoordinatorApproval: boolean
}

export type RuntimeUiWhyBlocked = {
  blocked: boolean
  readinessStatus: string
  primaryCauses: string[]
  blockerRows: RuntimeUiBlockerRow[]
}

export type VisitRuntimeUiModel = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  readinessStatus: string
  computedAt: string | null
  nextAction: RuntimeUiNextAction | null
  whyBlocked: RuntimeUiWhyBlocked
  safetyGovernanceBlockers: RuntimeUiBlockerRow[]
  leakage: RuntimeUiLeakageWarning
  workQueue: RuntimeUiWorkQueueBucket[]
  automationProposals: RuntimeUiAutomationProposal[]
  piReviewNeeded: boolean
  urgencyLevel: string | null
  visitPhase: string | null
  overloadCompact: boolean
  pendingAutomationApplyCount: number
}

export type SubjectRuntimeUiModel = {
  studySubjectId: string
  organizationId: string
  studyId: string
  operationalHealth: string
  escalationLevel: string | null
  nextAction: RuntimeUiNextAction | null
  whyBlocked: RuntimeUiWhyBlocked
  workQueueSummary: { actionNow: number; piReview: number; escalation: number }
  automationProposals: RuntimeUiAutomationProposal[]
  openVisitCount: number
  overloadCompact: boolean
  pendingAutomationApplyCount: number
}
