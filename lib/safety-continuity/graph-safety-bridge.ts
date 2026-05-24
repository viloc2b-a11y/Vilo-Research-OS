import type { GraphVisitBlocker, VisitGraphOrchestrationResult } from '@/lib/protocol-graph/types'
import type { UnresolvedSafetyItem } from '@/lib/safety-continuity/types'

/**
 * Strengthens protocol graph safety triggers when subject continuity is elevated.
 */
export function strengthenGraphSafetyBlockers(input: {
  graphBlockers: GraphVisitBlocker[]
  subjectContinuityState: string
  unresolvedItems: UnresolvedSafetyItem[]
}): GraphVisitBlocker[] {
  const elevate =
    input.subjectContinuityState === 'elevated' || input.subjectContinuityState === 'critical'

  return input.graphBlockers.map((blocker) => {
    const isSafety =
      blocker.category === 'safety'
      || blocker.id.includes('safety')
      || blocker.label.toLowerCase().includes('safety')

    if (!isSafety && !elevate) return blocker

    const hasAe = input.unresolvedItems.some((i) => i.source === 'ae_registry')
    const shouldElevate = elevate && (isSafety || hasAe)

    if (!shouldElevate || blocker.severity === 'blocker') return blocker

    return {
      ...blocker,
      severity: 'blocker' as const,
      detail: `${blocker.detail} (elevated by safety continuity.)`,
    }
  })
}

export function graphSafetyItemsFromOrchestration(
  orchestration: VisitGraphOrchestrationResult,
): UnresolvedSafetyItem[] {
  return orchestration.directives
    .filter((d) => d.matched && (d.kind === 'safety_trigger' || d.action.type === 'trigger_safety_workflow'))
    .map((d) => ({
      source: 'graph_safety_trigger' as const,
      sourceId: d.ruleId,
      label: d.action.label,
      detail: d.action.detail ?? d.action.label,
      severity: (d.action.severity === 'blocker' ? 'blocker' : 'warning') as 'warning' | 'blocker',
    }))
}
