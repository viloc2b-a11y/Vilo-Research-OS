import type { ProtocolGraphEdgeType, ProtocolGraphNodeType } from '@/lib/protocol-graph/types'

export const GRAPH_NODE_PREFIX = {
  study: 'study',
  version: 'version',
  visit: 'visit',
  procedure: 'proc',
  branch: 'branch',
  rule: 'rule',
} as const

export function visitNodeKey(visitDefinitionId: string): string {
  return `${GRAPH_NODE_PREFIX.visit}:${visitDefinitionId}`
}

export function procedureNodeKey(procedureDefinitionId: string): string {
  return `${GRAPH_NODE_PREFIX.procedure}:${procedureDefinitionId}`
}

export function branchNodeKey(branchKey: string): string {
  return `${GRAPH_NODE_PREFIX.branch}:${branchKey}`
}

export const EDGE_TYPES: Record<string, ProtocolGraphEdgeType> = {
  PROTOCOL_VISIT: 'protocol_requires_visit',
  VISIT_PROCEDURE: 'visit_requires_procedure',
  PROCEDURE_DEPENDS: 'procedure_depends_on_procedure',
  VISIT_DEPENDS: 'visit_depends_on_visit',
  WINDOW_DEPENDS: 'window_depends_on_visit',
  SAFETY_BLOCKS: 'safety_event_blocks_visit',
  LAB_TRIGGERS: 'lab_result_triggers_action',
  BRANCH_VISIT: 'branch_activates_visit',
} as const

export const NODE_TYPES: Record<string, ProtocolGraphNodeType> = {
  STUDY: 'study',
  VERSION: 'protocol_version',
  VISIT: 'visit_definition',
  PROCEDURE: 'procedure_definition',
  BRANCH: 'branch',
  SAFETY_RULE: 'safety_rule',
  DEPENDENCY_RULE: 'dependency_rule',
} as const
