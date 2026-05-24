import type { RuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import type { GraphVisitBlocker, ProtocolGraphDocument } from '@/lib/protocol-graph/types'

export function evaluateWindowDependencyRules(
  graph: ProtocolGraphDocument,
  ctx: RuntimeGraphContext,
): GraphVisitBlocker[] {
  const blockers: GraphVisitBlocker[] = []

  if (ctx.windowStatus === 'outside_window') {
    blockers.push({
      id: 'graph:window-outside',
      category: 'protocol_graph',
      severity: 'warning',
      label: 'Outside protocol window',
      detail: 'Visit is outside the protocol scheduling window.',
    })
  }

  const visitNode = graph.nodes.find(
    (n) => n.entityRefId === ctx.visitDefinitionId && n.nodeType === 'visit_definition',
  )
  if (visitNode?.properties?.windowMinOffset != null) {
    const snapshot = {
      windowMin: visitNode.properties.windowMinOffset,
      windowMax: visitNode.properties.windowMaxOffset,
      targetDay: visitNode.properties.targetDay,
      windowStatus: ctx.windowStatus,
    }
    if (ctx.windowStatus === 'warning') {
      blockers.push({
        id: 'graph:window-warning',
        category: 'protocol_graph',
        severity: 'warning',
        label: 'Window warning',
        detail: `Approaching protocol window boundary (Day ${String(snapshot.targetDay ?? '?')}).`,
      })
    }
  }

  return blockers
}
