import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import type { ConditionalProcedureOption } from '@/lib/visits/conditional-procedures'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Filters conditional procedure options using graph-orchestrated availability (branch + deps).
 */
export async function filterConditionalOptionsWithGraph(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  options: ConditionalProcedureOption[]
}): Promise<ConditionalProcedureOption[]> {
  const orchestration = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
  })

  const allowedMapIds = new Set(orchestration.availableConditionalMapIds)
  if (allowedMapIds.size === 0) return input.options

  return input.options.filter((o) => allowedMapIds.has(o.mapId))
}
