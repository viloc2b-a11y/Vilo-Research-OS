import type {
  CausalityLink,
  CausalityNode,
  ReadinessBlockedExplanation,
  ReplayTimelineEntry,
  ReplayTimelineSegment,
} from '@/lib/runtime-replay/types'

export function buildCausalityChainFromTimeline(input: {
  segments: ReplayTimelineSegment[]
  readinessExplanation?: ReadinessBlockedExplanation
}): { nodes: CausalityNode[]; links: CausalityLink[] } {
  const nodes: CausalityNode[] = []
  const links: CausalityLink[] = []

  const allEntries: ReplayTimelineEntry[] = input.segments.flatMap((s) => s.entries)

  for (const entry of allEntries) {
    nodes.push({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      occurredAt: entry.occurredAt,
      refId:
        entry.operationalEventId
        ?? entry.workflowActionId
        ?? entry.sourceResponseSetId
        ?? null,
    })
  }

  for (let i = 1; i < allEntries.length; i++) {
    const prev = allEntries[i - 1]
    const curr = allEntries[i]
    if (prev.segmentType === curr.segmentType) {
      links.push({
        fromNodeId: prev.id,
        toNodeId: curr.id,
        relation: 'enabled',
        label: 'Sequential chronology',
      })
    }
  }

  if (input.readinessExplanation?.blocked) {
    const readinessNodeId = `readiness:${input.readinessExplanation.visitId}`
    nodes.push({
      id: readinessNodeId,
      kind: 'readiness_state',
      label: 'Visit readiness blocked',
      occurredAt: new Date().toISOString(),
      refId: input.readinessExplanation.visitId,
    })

    for (const blocker of input.readinessExplanation.blockerSummaries) {
      const blockerNodeId = `blocker:${blocker.id}`
      nodes.push({
        id: blockerNodeId,
        kind: 'blocker',
        label: blocker.label,
        occurredAt: new Date().toISOString(),
        refId: blocker.id,
      })
      links.push({
        fromNodeId: blockerNodeId,
        toNodeId: readinessNodeId,
        relation: 'blocked',
        label: blocker.detail,
      })
    }

    for (const path of input.readinessExplanation.causalityPath) {
      const match = nodes.find((n) => n.label.includes(path) || n.id.includes(path))
      if (match) {
        links.push({
          fromNodeId: match.id,
          toNodeId: readinessNodeId,
          relation: 'derived_from',
          label: path,
        })
      }
    }
  }

  const safetyEntries = allEntries.filter((e) => e.segmentType === 'safety_escalation')
  const governanceEntries = allEntries.filter((e) => e.segmentType === 'governance_emergence')
  for (const gov of governanceEntries) {
    const relatedSafety = safetyEntries.find(
      (s) => s.occurredAt <= gov.occurredAt && s.visitId === gov.visitId,
    )
    if (relatedSafety) {
      links.push({
        fromNodeId: relatedSafety.id,
        toNodeId: gov.id,
        relation: 'escalated',
        label: 'Safety state contributed to governance signal',
      })
    }
  }

  return { nodes, links }
}
