/** Internal-only finding prevention signals (never external). */
export type SiteDefenseSignalName =
  | 'likely_monitor_query'
  | 'likely_source_finding'
  | 'likely_deviation'
  | 'likely_signature_finding'
  | 'likely_sdv_mismatch'
  /** @deprecated Use likely_source_finding */
  | 'likely_source_gap'
  /** @deprecated Use likely_deviation */
  | 'likely_temporal_deviation'
  /** @deprecated Use likely_workflow_escalation — maps to unresolved_escalation bucket */
  | 'likely_workflow_escalation'

export type SiteDefenseRiskInput = {
  runtimeId: string
  unsignedProcedureCount?: number
  incompleteSourceCount?: number
  missingRequiredSourceFieldCount?: number
  temporalConsistencyIssueCount?: number
  staleWorkflowCount?: number
  missingDelegationCoverageCount?: number
  sourceIntegrityMismatchCount?: number
  unresolvedGovernanceBlockerCount?: number
}

export type SiteDefenseSignal = {
  name: SiteDefenseSignalName
  visibility: 'site_internal_only'
  source: string
  reason: string
  riskWeight: number
}
