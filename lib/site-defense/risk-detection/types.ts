/**
 * Internal risk detection — site-only operational risk categories.
 * Never exported to CRA/monitor surfaces.
 */

export type InternalRiskCategory =
  | 'unsigned_procedure'
  | 'stale_workflow'
  | 'missing_signature'
  | 'temporal_inconsistency'
  | 'source_integrity_mismatch'
  | 'unresolved_blocker'
  | 'overdue_source_completion'
  | 'pi_sub_i_bottleneck'
  | 'workload_accumulation'

export type InternalRiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export type InternalRiskFinding = {
  category: InternalRiskCategory
  severity: InternalRiskSeverity
  visibility: 'site_internal_only'
  runtimeId: string
  count: number
  summary: string
}

/** Projection/readiness counts used to derive site defense inputs. */
export type RiskDetectionSnapshot = {
  runtimeId: string
  unsignedProcedureCount?: number
  staleWorkflowCount?: number
  missingSignatureCount?: number
  temporalInconsistencyCount?: number
  sourceIntegrityMismatchCount?: number
  unresolvedBlockerCount?: number
  overdueSourceCompletionCount?: number
  incompleteSourceCount?: number
  missingRequiredSourceFieldCount?: number
  piSignoffPendingCount?: number
  coordinatorOpenItemCount?: number
  missingDelegationCoverageCount?: number
  unresolvedGovernanceBlockerCount?: number
}
