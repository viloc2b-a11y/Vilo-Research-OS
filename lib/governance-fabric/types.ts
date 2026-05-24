/**
 * Phase 4 — Governance fabric derived models (runtime-emergent, not QMS truth).
 */

export type GovernanceSignalType =
  | 'visit_window_deviation'
  | 'missing_source_at_signoff'
  | 'unresolved_finding_at_closeout'
  | 'unresolved_ae_at_signoff'
  | 'protocol_graph_blocker_unresolved'
  | 'open_query_unresolved'
  | 'safety_continuity_elevated'

export type GovernanceSignalSeverity = 'info' | 'warning' | 'blocker'

export type GovernanceSignalStatus = 'open' | 'acknowledged' | 'superseded' | 'resolved'

export type GovernanceSignal = {
  signalKey: string
  signalType: GovernanceSignalType
  severity: GovernanceSignalSeverity
  status: GovernanceSignalStatus
  label: string
  detail: string
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
  workflowActionId?: string | null
  operationalEventId?: string | null
  detectedAt: string
  derivation: Record<string, unknown>
}

export type GovernanceDeviationRuleId =
  | 'visit_window_deviation'
  | 'missing_source_at_signoff'
  | 'unresolved_finding_at_closeout'
  | 'unresolved_ae_at_signoff'
  | 'protocol_graph_blocker_unresolved'
  | 'open_query_unresolved'
  | 'safety_continuity_elevated'

export type CapaPlaceholderStatus = 'placeholder' | 'draft' | 'active' | 'closed'

export type CapaPlaceholder = {
  id: string
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  governanceSignalId?: string | null
  status: CapaPlaceholderStatus
  title: string
  metadata: Record<string, unknown>
}
