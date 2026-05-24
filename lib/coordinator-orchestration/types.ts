/**
 * Phase 8 — Coordinator orchestration (runtime-derived; not a task manager).
 */

export type CoordinatorActionKind =
  | 'procedure_execution'
  | 'source_correction'
  | 'coordinator_workflow'
  | 'pi_review'
  | 'signoff'
  | 'graph_resolution'
  | 'governance_resolution'
  | 'safety_follow_up'
  | 'leakage_escalation'
  | 'operational_escalation'
  | 'coordinator_follow_up'

export type CoordinatorNextAction = {
  id: string
  kind: CoordinatorActionKind
  priority: number
  label: string
  detail: string
  domain: 'graph' | 'governance' | 'safety' | 'workflow' | 'source' | 'financial' | 'visit' | 'replay'
  blockerId?: string | null
  procedureExecutionId?: string | null
  href?: string | null
  requiresEscalation: boolean
  requiresPiReview: boolean
  dependencyOf?: string | null
}

export type OperationalPriorityScores = {
  patientSafetyRisk: number
  protocolRisk: number
  visitTimelinePressure: number
  coordinatorBurden: number
  unresolvedGovernance: number
  financialLeakage: number
  compositeScore: number
}

export type RuntimeUrgency = {
  level: 'low' | 'moderate' | 'high' | 'critical'
  urgencyScore: number
  drivers: string[]
  slaPressure: boolean
}

export type BlockerResolutionStep = {
  order: number
  actionId: string
  label: string
  domain: string
}

export type BlockerResolutionChain = {
  id: string
  rootBlockerId: string
  rootLabel: string
  domains: string[]
  steps: BlockerResolutionStep[]
}

export type WorkQueueBucket = 'action_now' | 'can_wait' | 'blocked' | 'escalation' | 'pi_review' | 'coordinator_follow_up'

export type WorkQueueItem = {
  actionId: string
  bucket: WorkQueueBucket
  kind: CoordinatorActionKind
  label: string
  priority: number
}

export type DerivedWorkQueue = {
  actionNow: WorkQueueItem[]
  canWait: WorkQueueItem[]
  blocked: WorkQueueItem[]
  escalation: WorkQueueItem[]
  piReview: WorkQueueItem[]
  coordinatorFollowUp: WorkQueueItem[]
}

export type VisitExecutionOrchestration = {
  phase: 'pre_visit' | 'in_visit' | 'closeout' | 'terminal'
  primaryObjective: string
  pendingProcedureCount: number
  signoffBlocked: boolean
  graphBlocked: boolean
  recommendedSequence: string[]
}

export type SubjectEscalationOrchestration = {
  escalationLevel: 'none' | 'coordinator' | 'operational' | 'pi' | 'critical'
  reasons: string[]
  openVisitCount: number
  criticalVisitCount: number
}

export type FinancialLeakageEscalation = {
  leakageScore: number
  criticalLeakageCount: number
  topLeakageKinds: string[]
  recommendedActions: string[]
}

export type VisitCoordinatorOrchestration = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  orchestrationVersion: number
  nextActions: CoordinatorNextAction[]
  priorityScores: OperationalPriorityScores
  urgency: RuntimeUrgency
  blockerChains: BlockerResolutionChain[]
  workQueue: DerivedWorkQueue
  visitExecution: VisitExecutionOrchestration
  financialLeakageEscalation: FinancialLeakageEscalation
  topPriorityScore: number
  snapshot: Record<string, unknown>
}

export type SubjectCoordinatorOrchestration = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  orchestrationVersion: number
  nextActions: CoordinatorNextAction[]
  priorityScores: OperationalPriorityScores
  urgency: RuntimeUrgency
  blockerChains: BlockerResolutionChain[]
  workQueue: DerivedWorkQueue
  subjectEscalation: SubjectEscalationOrchestration
  financialLeakageEscalation: FinancialLeakageEscalation
  topPriorityScore: number
  snapshot: Record<string, unknown>
}
