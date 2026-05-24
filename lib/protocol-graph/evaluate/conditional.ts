import type { ProtocolGraphDocument } from '@/lib/protocol-graph/types'

/**
 * Returns visit_def_procedure_map ids for conditional procedures available on this visit definition.
 */
export function resolveAvailableConditionalMapIds(
  graph: ProtocolGraphDocument,
  visitDefinitionId: string,
  existingProcedureDefinitionIds: Set<string>,
): string[] {
  const visitKey = `visit:${visitDefinitionId}`
  const mapIds: string[] = []

  for (const edge of graph.edges) {
    if (edge.edgeType !== 'visit_requires_procedure') continue
    if (edge.fromNodeKey !== visitKey) continue
    if (!edge.condition?.isConditional && !edge.properties?.isConditional) continue

    const mapId = edge.properties?.mapId as string | undefined
    const procNode = edge.toNodeKey
    const procId = procNode.replace(/^proc:/, '')
    if (existingProcedureDefinitionIds.has(procId)) continue
    if (mapId) mapIds.push(mapId)
  }

  return mapIds
}
