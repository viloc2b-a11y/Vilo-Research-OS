import type {
  SiteDefenseRiskInput,
  SiteDefenseSignal,
} from '@/lib/site-defense/signals/types'

function count(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function signal(input: Omit<SiteDefenseSignal, 'visibility'>): SiteDefenseSignal {
  return {
    ...input,
    visibility: 'site_internal_only',
  }
}

export function deriveSiteDefenseSignals(input: SiteDefenseRiskInput): SiteDefenseSignal[] {
  const signals: SiteDefenseSignal[] = []

  if (count(input.unsignedProcedureCount) > 0) {
    signals.push(signal({
      name: 'likely_signature_finding',
      source: 'unsigned_procedures',
      reason: 'Completed procedures still require signoff before review.',
      riskWeight: 92,
    }))
    signals.push(signal({
      name: 'likely_monitor_query',
      source: 'unsigned_procedures',
      reason: 'Unsigned procedure evidence may prompt monitor clarification.',
      riskWeight: 84,
    }))
  }

  if (count(input.incompleteSourceCount) > 0 || count(input.missingRequiredSourceFieldCount) > 0) {
    signals.push(signal({
      name: 'likely_source_finding',
      source: 'source_incompleteness',
      reason: 'Required source evidence is incomplete.',
      riskWeight: 88,
    }))
    signals.push(signal({
      name: 'likely_source_gap',
      source: 'source_incompleteness',
      reason: 'Required source evidence is incomplete.',
      riskWeight: 88,
    }))
    signals.push(signal({
      name: 'likely_monitor_query',
      source: 'source_incompleteness',
      reason: 'Incomplete source may create a review question.',
      riskWeight: 82,
    }))
  }

  if (count(input.temporalConsistencyIssueCount) > 0) {
    signals.push(signal({
      name: 'likely_deviation',
      source: 'temporal_consistency',
      reason: 'Chronology needs site review before evidence is released.',
      riskWeight: 90,
    }))
    signals.push(signal({
      name: 'likely_temporal_deviation',
      source: 'temporal_consistency',
      reason: 'Chronology needs site review before evidence is released.',
      riskWeight: 90,
    }))
    signals.push(signal({
      name: 'likely_sdv_mismatch',
      source: 'temporal_consistency',
      reason: 'Procedure, source, and visit timing may not align for SDV.',
      riskWeight: 86,
    }))
  }

  if (count(input.staleWorkflowCount) > 0) {
    signals.push(signal({
      name: 'likely_workflow_escalation',
      source: 'stale_workflows',
      reason: 'Workflow has not moved and may need site escalation.',
      riskWeight: 76,
    }))
  }

  if (count(input.missingDelegationCoverageCount) > 0) {
    signals.push(signal({
      name: 'likely_signature_finding',
      source: 'missing_delegation_coverage',
      reason: 'Delegation coverage should be resolved before signoff review.',
      riskWeight: 87,
    }))
  }

  if (count(input.sourceIntegrityMismatchCount) > 0) {
    signals.push(signal({
      name: 'likely_sdv_mismatch',
      source: 'source_integrity_mismatch',
      reason: 'Source evidence does not currently match runtime expectations.',
      riskWeight: 94,
    }))
  }

  if (count(input.unresolvedGovernanceBlockerCount) > 0) {
    signals.push(signal({
      name: 'likely_workflow_escalation',
      source: 'unresolved_governance_blockers',
      reason: 'Open governance blockers should be resolved before release.',
      riskWeight: 83,
    }))
    signals.push(signal({
      name: 'likely_monitor_query',
      source: 'unresolved_governance_blockers',
      reason: 'Open governance blockers may invite review questions.',
      riskWeight: 80,
    }))
  }

  return dedupeSiteDefenseSignals(signals)
}

export function dedupeSiteDefenseSignals(signals: SiteDefenseSignal[]): SiteDefenseSignal[] {
  const byKey = new Map<string, SiteDefenseSignal>()
  for (const item of signals) {
    const key = `${item.name}:${item.source}`
    const existing = byKey.get(key)
    if (!existing || item.riskWeight > existing.riskWeight) {
      byKey.set(key, item)
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.riskWeight - a.riskWeight)
}
