import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import type { VisitComplexityMetrics } from '@/lib/operational-intelligence/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitComplexity(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  projection?: VisitReadinessProjection | null
}): Promise<VisitComplexityMetrics> {
  const { data: procedures } = await input.supabase
    .from('procedure_executions')
    .select('id, execution_status, section_disabled_at')
    .eq('visit_id', input.visitId)
    .eq('organization_id', input.organizationId)

  const active = (procedures ?? []).filter((p) => !p.section_disabled_at)
  const procedureCount = (procedures ?? []).length

  const graph = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
  })

  const dependencyCount = graph.blockers.filter((b) => b.id.includes('dep')).length
  const conditionalBranchCount = graph.activeBranches.length + graph.availableConditionalMapIds.length
  const safetyEscalationCount =
    graph.directives.filter((d) => d.matched && d.kind === 'safety_trigger').length
    + graph.blockers.filter((b) => b.category.includes('safety')).length

  const unresolvedBlockerCount =
    input.projection?.blockerCount
    ?? graph.blockers.filter((b) => b.severity === 'blocker').length

  const complexityScore = Math.min(
    100,
    procedureCount * 3
      + dependencyCount * 10
      + conditionalBranchCount * 8
      + safetyEscalationCount * 12
      + unresolvedBlockerCount * 15,
  )

  return {
    procedureCount,
    activeProcedureCount: active.length,
    dependencyCount,
    conditionalBranchCount,
    safetyEscalationCount,
    unresolvedBlockerCount,
    complexityScore,
  }
}
