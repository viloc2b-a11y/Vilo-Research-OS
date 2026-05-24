/**
 * Phase 4 — Safety continuity derived models (not independent clinical truth).
 * Source of truth: subject_adverse_events, workflow, source findings, operational_events.
 */

export type SafetyContinuityState = 'clear' | 'attention' | 'elevated' | 'critical'

export type UnresolvedSafetySource =
  | 'ae_registry'
  | 'workflow'
  | 'source_finding'
  | 'graph_safety_trigger'

export type UnresolvedSafetyItem = {
  source: UnresolvedSafetySource
  sourceId: string
  label: string
  detail: string
  severity: 'warning' | 'blocker'
  visitId?: string | null
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
  workflowActionId?: string | null
  seriousness?: boolean
  reportedAt?: string | null
}

export type SafetySourceRef = {
  kind: UnresolvedSafetySource
  id: string
  visitId?: string | null
}

export type SubjectSafetyContinuity = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  projectionVersion: number
  continuityState: SafetyContinuityState
  carryForwardActive: boolean
  unresolvedAeCount: number
  openSafetyWorkflowCount: number
  criticalFindingCount: number
  unresolvedItems: UnresolvedSafetyItem[]
  sourceRefs: SafetySourceRef[]
  snapshot: Record<string, unknown>
}

export type VisitSafetyCarryForward = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  projectionVersion: number
  subjectContinuityState: SafetyContinuityState
  carriedAeCount: number
  visitLinkedAeCount: number
  carryForwardActive: boolean
  blockers: Array<{
    id: string
    category: string
    severity: 'blocker' | 'warning' | 'info'
    label: string
    detail: string
  }>
  snapshot: Record<string, unknown>
}
