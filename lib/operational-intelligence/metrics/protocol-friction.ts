import type { ProtocolFrictionMetrics } from '@/lib/operational-intelligence/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeProtocolFriction(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId?: string | null
  visitBlockerIds?: string[]
  graphEscalationCount?: number
}): Promise<ProtocolFrictionMetrics> {
  let signalQuery = input.supabase
    .from('governance_signals')
    .select('id, signal_type, severity, status')
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .in('status', ['open', 'acknowledged'])

  if (input.visitId) {
    signalQuery = signalQuery.eq('visit_id', input.visitId)
  } else {
    signalQuery = signalQuery.eq('study_subject_id', input.studySubjectId)
  }

  const { data: signals } = await signalQuery

  const deviationSignalCount = (signals ?? []).filter((s) =>
    String(s.signal_type).includes('deviation'),
  ).length

  const blockerIds = input.visitBlockerIds ?? []
  const patternCounts = new Map<string, number>()
  for (const id of blockerIds) {
    const prefix = id.split(':')[0] ?? id
    patternCounts.set(prefix, (patternCounts.get(prefix) ?? 0) + 1)
  }
  const repeatedBlockerPatternCount = [...patternCounts.values()].filter((c) => c > 1).length

  const { data: recurringWorkflow } = await input.supabase
    .from('subject_workflow_actions')
    .select('title')
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('status', ['open', 'in_progress'])

  const titleCounts = new Map<string, number>()
  for (const row of recurringWorkflow ?? []) {
    const title = (row.title as string) ?? ''
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1)
  }
  const unresolvedWorkflowRecurrence = [...titleCounts.values()].filter((c) => c > 1).length

  let highBurdenVisitCount = 0
  if (!input.visitId) {
    const { data: visitProjections } = await input.supabase
      .from('visit_operational_intelligence_projections')
      .select('burden_score')
      .eq('study_subject_id', input.studySubjectId)
      .gte('burden_score', 40)
    highBurdenVisitCount = visitProjections?.length ?? 0
  }

  const graphEscalationCount = input.graphEscalationCount ?? 0

  const frictionScore = Math.min(
    100,
    repeatedBlockerPatternCount * 12
      + graphEscalationCount * 10
      + unresolvedWorkflowRecurrence * 8
      + highBurdenVisitCount * 6
      + deviationSignalCount * 14
      + (signals ?? []).filter((s) => s.severity === 'blocker').length * 15,
  )

  return {
    repeatedBlockerPatternCount,
    graphEscalationCount,
    unresolvedWorkflowRecurrence,
    highBurdenVisitCount,
    deviationSignalCount,
    frictionScore,
  }
}
