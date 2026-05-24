import { evaluateRuntimeRules } from '@/lib/protocol-graph/evaluate/rule-evaluator'
import type { RuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import type { GraphVisitBlocker, GraphOrchestrationDirective } from '@/lib/protocol-graph/types'

export function evaluateSafetyTriggerGraph(ctx: RuntimeGraphContext): {
  blockers: GraphVisitBlocker[]
  directives: GraphOrchestrationDirective[]
} {
  const safetyRules = ctx.graph.runtimeRules.filter(
    (r) => r.kind === 'safety_trigger' || r.kind === 'signoff_blocker',
  )
  return evaluateRuntimeRules(safetyRules, ctx, 'visit')
}
