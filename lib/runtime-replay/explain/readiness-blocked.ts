import { summarizeGraphTriggers } from '@/lib/runtime-replay/explain/graph-triggers'
import type { GraphTriggerExplanation, ReadinessBlockedExplanation } from '@/lib/runtime-replay/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

export function explainVisitReadinessBlocked(input: {
  projection: VisitReadinessProjection
  graphTriggers?: GraphTriggerExplanation[]
}): ReadinessBlockedExplanation {
  const blockers = input.projection.blockers
  const blocked = input.projection.readinessStatus === 'blocked'
    || blockers.some((b) => b.severity === 'blocker')

  const primaryCauses: string[] = []
  const causalityPath: string[] = []

  for (const b of blockers.filter((x) => x.severity === 'blocker')) {
    primaryCauses.push(`${b.category}: ${b.label}`)
    causalityPath.push(b.id)
  }

  if (input.projection.missingSourceCount > 0) {
    primaryCauses.push(`Missing source on ${input.projection.missingSourceCount} procedure(s)`)
    causalityPath.push('missing-source')
  }
  if (input.projection.unresolvedFindingCount > 0) {
    primaryCauses.push(`${input.projection.unresolvedFindingCount} unresolved critical finding(s)`)
    causalityPath.push('unresolved-findings')
  }
  if (input.projection.safetyBlockerCount > 0) {
    primaryCauses.push(`${input.projection.safetyBlockerCount} safety item(s) active`)
    causalityPath.push('safety-continuity')
  }

  const graphTriggerSummaries = input.graphTriggers
    ? summarizeGraphTriggers(input.graphTriggers)
    : []

  for (const summary of graphTriggerSummaries) {
    primaryCauses.push(summary)
    causalityPath.push('protocol-graph')
  }

  return {
    visitId: input.projection.visitId,
    readinessStatus: input.projection.readinessStatus,
    blocked,
    primaryCauses: [...new Set(primaryCauses)],
    blockerSummaries: blockers.map((b) => ({
      id: b.id,
      category: b.category,
      severity: b.severity,
      label: b.label,
      detail: b.detail,
    })),
    graphTriggerSummaries,
    causalityPath,
  }
}
