import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import type { GraphTriggerExplanation } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function explainGraphTriggersForVisit(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<GraphTriggerExplanation[]> {
  const orchestration = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
  })

  return orchestration.directives.map((d) => ({
    ruleId: d.ruleId,
    kind: d.kind,
    label: d.action.label,
    matched: d.matched,
    actionType: d.action.type,
  }))
}

export function summarizeGraphTriggers(triggers: GraphTriggerExplanation[]): string[] {
  return triggers
    .filter((t) => t.matched)
    .map((t) => `Graph rule ${t.ruleId} (${t.kind}): ${t.label} → ${t.actionType}`)
}
