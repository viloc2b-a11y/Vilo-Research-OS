/**
 * Phase 5 — Runtime replay & causality models (derived from canonical chronology).
 */

export const RUNTIME_REPLAY_VERSION = 1

export type ReplayScope = 'visit' | 'subject'

export type ReplaySegmentType =
  | 'visit_execution'
  | 'source_signature'
  | 'safety_escalation'
  | 'workflow_query'
  | 'governance_emergence'

export type ReplayEntryKind =
  | 'operational_event'
  | 'execution_fact'
  | 'safety_registry'
  | 'workflow_action'
  | 'governance_signal'
  | 'graph_directive'
  | 'projection_derivation'

export type ReplayTimelineEntry = {
  id: string
  kind: ReplayEntryKind
  segmentType: ReplaySegmentType
  occurredAt: string
  label: string
  detail: string
  eventType?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
  workflowActionId?: string | null
  operationalEventId?: string | null
  payload?: Record<string, unknown>
}

export type ReplayTimelineSegment = {
  segmentType: ReplaySegmentType
  label: string
  entries: ReplayTimelineEntry[]
}

export type CausalityRelation =
  | 'caused'
  | 'enabled'
  | 'blocked'
  | 'escalated'
  | 'derived_from'
  | 'triggered'

export type CausalityNode = {
  id: string
  kind: ReplayEntryKind | 'blocker' | 'readiness_state'
  label: string
  occurredAt: string
  refId?: string | null
}

export type CausalityLink = {
  fromNodeId: string
  toNodeId: string
  relation: CausalityRelation
  label?: string
}

export type ReadinessBlockedExplanation = {
  visitId: string
  readinessStatus: string
  blocked: boolean
  primaryCauses: string[]
  blockerSummaries: Array<{
    id: string
    category: string
    severity: string
    label: string
    detail: string
  }>
  graphTriggerSummaries: string[]
  causalityPath: string[]
}

export type GraphTriggerExplanation = {
  ruleId: string
  kind: string
  label: string
  matched: boolean
  actionType: string
}

export type RuntimeReplayArtifact = {
  scope: ReplayScope
  scopeId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  replayVersion: number
  computedAt: string
  timeline: ReplayTimelineSegment[]
  causalityChain: { nodes: CausalityNode[]; links: CausalityLink[] }
  explanations: {
    readinessBlocked?: ReadinessBlockedExplanation
    graphTriggers?: GraphTriggerExplanation[]
    summary: string
  }
  sourceEventCount: number
  snapshot: Record<string, unknown>
}
