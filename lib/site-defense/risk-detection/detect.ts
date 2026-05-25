import type { SiteDefenseRiskInput } from '@/lib/site-defense/signals'
import type {
  InternalRiskCategory,
  InternalRiskFinding,
  InternalRiskSeverity,
  RiskDetectionSnapshot,
} from '@/lib/site-defense/risk-detection/types'

function count(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function severityFor(count: number, thresholds: { high: number; critical: number }): InternalRiskSeverity {
  if (count >= thresholds.critical) return 'critical'
  if (count >= thresholds.high) return 'high'
  if (count > 0) return 'medium'
  return 'low'
}

function finding(
  category: InternalRiskCategory,
  snapshot: RiskDetectionSnapshot,
  count: number,
  summary: string,
  severity: InternalRiskSeverity,
): InternalRiskFinding | null {
  if (count <= 0) return null
  return {
    category,
    severity,
    visibility: 'site_internal_only',
    runtimeId: snapshot.runtimeId,
    count,
    summary,
  }
}

export function detectInternalRisks(snapshot: RiskDetectionSnapshot): InternalRiskFinding[] {
  const findings: InternalRiskFinding[] = []

  const unsigned = count(snapshot.unsignedProcedureCount)
  const missingSig = count(snapshot.missingSignatureCount) + unsigned
  const stale = count(snapshot.staleWorkflowCount)
  const temporal = count(snapshot.temporalInconsistencyCount)
  const integrity = count(snapshot.sourceIntegrityMismatchCount)
  const blockers = count(snapshot.unresolvedBlockerCount) + count(snapshot.unresolvedGovernanceBlockerCount)
  const overdue = count(snapshot.overdueSourceCompletionCount)
  const incomplete =
    count(snapshot.incompleteSourceCount) + count(snapshot.missingRequiredSourceFieldCount)
  const piBottleneck = count(snapshot.piSignoffPendingCount) + count(snapshot.missingDelegationCoverageCount)
  const workload = count(snapshot.coordinatorOpenItemCount)

  const push = (item: InternalRiskFinding | null) => {
    if (item) findings.push(item)
  }

  push(
    finding(
      'unsigned_procedure',
      snapshot,
      unsigned,
      'Completed procedures still require signoff.',
      severityFor(unsigned, { high: 1, critical: 3 }),
    ),
  )
  push(
    finding(
      'missing_signature',
      snapshot,
      missingSig,
      'Signature coverage is incomplete for active evidence.',
      severityFor(missingSig, { high: 1, critical: 2 }),
    ),
  )
  push(
    finding(
      'stale_workflow',
      snapshot,
      stale,
      'Workflow steps have not progressed within expected site windows.',
      severityFor(stale, { high: 2, critical: 4 }),
    ),
  )
  push(
    finding(
      'temporal_inconsistency',
      snapshot,
      temporal,
      'Visit, procedure, and source chronology need site reconciliation.',
      severityFor(temporal, { high: 1, critical: 2 }),
    ),
  )
  push(
    finding(
      'source_integrity_mismatch',
      snapshot,
      integrity,
      'Source evidence does not match runtime integrity expectations.',
      severityFor(integrity, { high: 1, critical: 1 }),
    ),
  )
  push(
    finding(
      'unresolved_blocker',
      snapshot,
      blockers,
      'Operational blockers remain open before external review.',
      severityFor(blockers, { high: 1, critical: 2 }),
    ),
  )
  push(
    finding(
      'overdue_source_completion',
      snapshot,
      overdue + incomplete,
      'Required source completion is overdue or incomplete.',
      severityFor(overdue + incomplete, { high: 2, critical: 5 }),
    ),
  )
  push(
    finding(
      'pi_sub_i_bottleneck',
      snapshot,
      piBottleneck,
      'PI/Sub-I signoff or delegation coverage is blocking progression.',
      severityFor(piBottleneck, { high: 1, critical: 2 }),
    ),
  )
  push(
    finding(
      'workload_accumulation',
      snapshot,
      workload,
      'Coordinator open work is accumulating beyond sustainable thresholds.',
      severityFor(workload, { high: 8, critical: 15 }),
    ),
  )

  return findings.sort((a, b) => {
    const rank: Record<InternalRiskSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    return rank[b.severity] - rank[a.severity] || b.count - a.count
  })
}

export function snapshotToSiteDefenseRiskInput(snapshot: RiskDetectionSnapshot): SiteDefenseRiskInput {
  return {
    runtimeId: snapshot.runtimeId,
    unsignedProcedureCount: count(snapshot.unsignedProcedureCount),
    incompleteSourceCount:
      count(snapshot.incompleteSourceCount) + count(snapshot.overdueSourceCompletionCount),
    missingRequiredSourceFieldCount: count(snapshot.missingRequiredSourceFieldCount),
    temporalConsistencyIssueCount: count(snapshot.temporalInconsistencyCount),
    staleWorkflowCount: count(snapshot.staleWorkflowCount),
    missingDelegationCoverageCount:
      count(snapshot.missingDelegationCoverageCount) + count(snapshot.piSignoffPendingCount),
    sourceIntegrityMismatchCount: count(snapshot.sourceIntegrityMismatchCount),
    unresolvedGovernanceBlockerCount:
      count(snapshot.unresolvedGovernanceBlockerCount) + count(snapshot.unresolvedBlockerCount),
  }
}

export function detectInternalRisksWithInput(snapshot: RiskDetectionSnapshot): {
  findings: InternalRiskFinding[]
  riskInput: SiteDefenseRiskInput
} {
  return {
    findings: detectInternalRisks(snapshot),
    riskInput: snapshotToSiteDefenseRiskInput(snapshot),
  }
}
