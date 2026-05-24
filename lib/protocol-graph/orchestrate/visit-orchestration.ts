import { evaluateBranchExecution } from '@/lib/protocol-graph/evaluate/branch-execution'
import { buildVisitRuntimeGraphContext } from '@/lib/protocol-graph/evaluate/context'
import { resolveAvailableConditionalMapIds } from '@/lib/protocol-graph/evaluate/conditional'
import { evaluateProcedureDependencies } from '@/lib/protocol-graph/evaluate/dependency-engine'
import { evaluateRuntimeRules } from '@/lib/protocol-graph/evaluate/rule-evaluator'
import { evaluateSafetyTriggerGraph } from '@/lib/protocol-graph/evaluate/safety-triggers'
import { evaluateVisitSequencingBlockers } from '@/lib/protocol-graph/evaluate/visit-sequencing'
import { evaluateWindowDependencyRules } from '@/lib/protocol-graph/evaluate/window-rules'
import { loadActiveProtocolGraph } from '@/lib/protocol-graph/load'
import type { VisitGraphOrchestrationResult } from '@/lib/protocol-graph/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Coordinator-first visit orchestration: evaluates published graph against live execution state.
 * Does not mutate visits or procedures — returns directives and blockers for existing runtime.
 */
export async function evaluateVisitGraphOrchestration(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<VisitGraphOrchestrationResult> {
  const empty: VisitGraphOrchestrationResult = {
    visitId: input.visitId,
    studyId: input.studyId,
    publicationId: null,
    graphRevision: null,
    blockers: [],
    directives: [],
    availableConditionalMapIds: [],
    activeBranches: [],
    snapshot: {},
  }

  const publication = await loadActiveProtocolGraph(input.supabase, {
    organizationId: input.organizationId,
    studyId: input.studyId,
  })

  if (!publication) return empty

  const graph = publication.graph_document
  const ctx = await buildVisitRuntimeGraphContext({
    supabase: input.supabase,
    graph,
    visitId: input.visitId,
    organizationId: input.organizationId,
  })

  if (!ctx) return { ...empty, publicationId: publication.id, graphRevision: publication.graph_revision }

  const safety = evaluateSafetyTriggerGraph(ctx)
  const branch = evaluateBranchExecution(ctx)
  const generalRules = evaluateRuntimeRules(
    graph.runtimeRules.filter(
      (r) =>
        r.kind !== 'safety_trigger'
        && r.kind !== 'signoff_blocker'
        && r.kind !== 'conditional_branch',
    ),
    ctx,
    'visit',
  )

  const depBlockers = evaluateProcedureDependencies(graph, ctx)
  const windowBlockers = evaluateWindowDependencyRules(graph, ctx)
  const seqBlockers = ctx.visitDefinitionId
    ? await evaluateVisitSequencingBlockers({
        supabase: input.supabase,
        graph,
        studySubjectId: ctx.studySubjectId,
        organizationId: input.organizationId,
        visitDefinitionId: ctx.visitDefinitionId,
        visitCode: ctx.visitCode,
      })
    : []

  const { data: existing } = await input.supabase
    .from('procedure_executions')
    .select('procedure_definition_id')
    .eq('visit_id', input.visitId)

  const existingIds = new Set((existing ?? []).map((r) => r.procedure_definition_id as string))
  const conditionalMapIds = ctx.visitDefinitionId
    ? resolveAvailableConditionalMapIds(graph, ctx.visitDefinitionId, existingIds)
    : []

  const blockers = [
    ...safety.blockers,
    ...branch.blockers,
    ...generalRules.blockers,
    ...depBlockers,
    ...windowBlockers,
    ...seqBlockers,
  ]

  const directives = [...safety.directives, ...branch.directives, ...generalRules.directives]

  return {
    visitId: input.visitId,
    studyId: input.studyId,
    publicationId: publication.id,
    graphRevision: publication.graph_revision,
    blockers,
    directives,
    availableConditionalMapIds: conditionalMapIds,
    activeBranches: branch.activeBranches,
    snapshot: {
      visitCode: ctx.visitCode,
      openAeVisitCount: ctx.openAeVisitCount,
      unresolvedFindingCount: ctx.unresolvedFindingCount,
      activeBranches: branch.activeBranches,
    },
  }
}
