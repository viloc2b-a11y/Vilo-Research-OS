export {
  PROTOCOL_GRAPH_SCHEMA_VERSION,
  type ProtocolGraphDocument,
  type ProtocolGraphEdge,
  type ProtocolGraphNode,
  type ProtocolRuntimeRule,
  type VisitGraphOrchestrationResult,
} from '@/lib/protocol-graph/types'

export { compileProtocolGraphFromStudy } from '@/lib/protocol-graph/compile/from-study-definitions'
export { computeGraphSourceChecksum } from '@/lib/protocol-graph/compile/checksum'
export { loadActiveProtocolGraph, loadProtocolGraphDocument } from '@/lib/protocol-graph/load'
export { publishProtocolGraph, type PublishProtocolGraphResult } from '@/lib/protocol-graph/publish'
export { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
export { enrichVisitReadinessWithProtocolGraph } from '@/lib/protocol-graph/integration/projection-bridge'
export { filterConditionalOptionsWithGraph } from '@/lib/protocol-graph/integration/conditional-procedures-graph'
export { BUILTIN_PROTOCOL_GRAPH_RULES, resolveBuiltinRules } from '@/lib/protocol-graph/rules/builtin-catalog'
