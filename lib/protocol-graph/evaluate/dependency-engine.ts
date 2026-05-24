import type { RuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import type { GraphVisitBlocker, ProtocolGraphDocument } from '@/lib/protocol-graph/types'

/**
 * Resolves procedure_depends_on_procedure edges from the published graph.
 */
export function evaluateProcedureDependencies(
  graph: ProtocolGraphDocument,
  ctx: RuntimeGraphContext,
): GraphVisitBlocker[] {
  const blockers: GraphVisitBlocker[] = []
  const deps = graph.edges.filter((e) => e.edgeType === 'procedure_depends_on_procedure')

  for (const edge of deps) {
    const visitCode = edge.condition?.visitCode as string | undefined
    if (visitCode && ctx.visitCode && visitCode !== ctx.visitCode) continue

    const dependsOnCode = edge.fromNodeKey.replace(/^proc-code:/, '')
    const targetCode = edge.toNodeKey.replace(/^proc-code:/, '')
    if (!dependsOnCode || !targetCode) continue

    if (ctx.incompleteProcedureCodes.has(dependsOnCode)) {
      blockers.push({
        id: `graph-dep:${edge.edgeKey}`,
        category: 'protocol_graph',
        severity: edge.properties?.required === false ? 'warning' : 'blocker',
        label: `Procedure dependency: ${targetCode}`,
        detail: `${targetCode} requires ${dependsOnCode} to be complete.`,
      })
    }
  }

  return blockers
}
