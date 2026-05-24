/**
 * Phase 2 — Runtime projection types (derived state only).
 * operational_events + execution tables remain canonical truth.
 */

export type ProjectionBlockerSeverity = 'blocker' | 'warning' | 'info'

export type RuntimeProjectionBlocker = {
  id: string
  category: string
  severity: ProjectionBlockerSeverity
  label: string
  detail: string
  href?: string | null
}

export type VisitReadinessStatus = 'ready' | 'attention' | 'blocked' | 'terminal' | 'unknown'

export type VisitReadinessProjection = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  projectionVersion: number
  readinessStatus: VisitReadinessStatus
  pendingProcedureCount: number
  unsignedProcedureCount: number
  unresolvedFindingCount: number
  missingSourceCount: number
  safetyBlockerCount: number
  visitCompletionReady: boolean
  coordinatorSignReady: boolean
  investigatorSignReady: boolean
  blockerCount: number
  blockers: RuntimeProjectionBlocker[]
  snapshot: Record<string, unknown>
}

export type SubjectLongitudinalState =
  | 'screening'
  | 'active'
  | 'follow_up'
  | 'terminal'
  | 'unknown'

export type SubjectOperationalHealthProjection = 'healthy' | 'attention' | 'critical' | 'unknown'

export type SubjectRuntimeProjection = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  projectionVersion: number
  longitudinalState: SubjectLongitudinalState
  operationalHealth: SubjectOperationalHealthProjection
  unresolvedSafetyCount: number
  missedVisitCount: number
  pendingWorkflowCount: number
  incompleteSourceCount: number
  openVisitCount: number
  blockerCount: number
  blockers: RuntimeProjectionBlocker[]
  snapshot: Record<string, unknown>
}

export type StudyOperationalRiskLevel = 'low' | 'moderate' | 'elevated' | 'critical' | 'unknown'

export type StudyExecutionProjection = {
  studyId: string
  organizationId: string
  computedAt: string
  projectionVersion: number
  operationalRiskLevel: StudyOperationalRiskLevel
  enrolledSubjectCount: number
  activeSubjectCount: number
  incompleteSourceCount: number
  openWorkflowCount: number
  openQueryCount: number
  missedVisitCount: number
  unresolvedSafetyCount: number
  protocolExecutionBurdenScore: number
  sourceCompletionBurdenScore: number
  blockerCount: number
  blockers: RuntimeProjectionBlocker[]
  snapshot: Record<string, unknown>
}

export type ProjectionRefreshResult = {
  ok: boolean
  projectionVersion: number
  rowsAffected: number
  error?: string
}

export type CascadeRefreshResult = {
  visit?: ProjectionRefreshResult
  subject?: ProjectionRefreshResult
  study?: ProjectionRefreshResult
}
