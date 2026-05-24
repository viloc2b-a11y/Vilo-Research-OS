import { evaluateRuntimeRules } from '@/lib/protocol-graph/evaluate/rule-evaluator'
import type { RuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import type { GraphOrchestrationDirective, GraphVisitBlocker } from '@/lib/protocol-graph/types'

export function evaluateBranchExecution(ctx: RuntimeGraphContext): {
  blockers: GraphVisitBlocker[]
  directives: GraphOrchestrationDirective[]
  activeBranches: string[]
} {
  const branchRules = ctx.graph.runtimeRules.filter((r) => r.kind === 'conditional_branch')
  const visitEval = evaluateRuntimeRules(branchRules, ctx, 'visit')
  const subjectEval = evaluateRuntimeRules(branchRules, ctx, 'subject')

  return {
    blockers: [...visitEval.blockers, ...subjectEval.blockers],
    directives: [...visitEval.directives, ...subjectEval.directives],
    activeBranches: [...ctx.activeBranches],
  }
}

export function isProcedureActivatedByBranch(
  procedureCode: string,
  activeBranches: string[],
  graph: RuntimeGraphContext['graph'],
): boolean {
  if (activeBranches.length === 0) return true
  for (const edge of graph.edges) {
    if (edge.edgeType !== 'branch_activates_visit') continue
    const codes = (edge.properties?.activatesProcedureCodes as string[] | undefined) ?? []
    if (!codes.includes(procedureCode)) continue
    const branchKey = edge.fromNodeKey.replace(/^branch:/, '')
    if (activeBranches.includes(branchKey)) return true
  }
  return false
}
