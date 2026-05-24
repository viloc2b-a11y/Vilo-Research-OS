import { computeCoordinatorBurden } from '@/lib/operational-intelligence/metrics/coordinator-burden'
import { computeProtocolFriction } from '@/lib/operational-intelligence/metrics/protocol-friction'
import { computeRuntimeRisk } from '@/lib/operational-intelligence/metrics/runtime-risk'
import { emitOperationalIntelligenceSignals } from '@/lib/operational-intelligence/signals/engine'
import {
  OPERATIONAL_INTELLIGENCE_VERSION,
  type SubjectOperationalIntelligence,
} from '@/lib/operational-intelligence/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeSubjectOperationalIntelligence(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
}): Promise<SubjectOperationalIntelligence> {
  const coordinatorBurden = await computeCoordinatorBurden({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
  })

  const { data: visitIntel } = await input.supabase
    .from('visit_operational_intelligence_projections')
    .select('complexity_score, burden_score')
    .eq('study_subject_id', input.studySubjectId)

  const complexityScores = (visitIntel ?? []).map(
    (r) => (r as { complexity_score?: number }).complexity_score ?? 0,
  )
  const averageComplexityScore =
    complexityScores.length > 0
      ? Math.round(complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length)
      : 0
  const maxComplexityScore = complexityScores.length > 0 ? Math.max(...complexityScores) : 0
  const highComplexityVisitCount = complexityScores.filter((s) => s >= 45).length

  const protocolFriction = await computeProtocolFriction({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
  })

  const runtimeRisk = computeRuntimeRisk({
    coordinatorBurden,
    protocolFriction,
  })

  const signals = emitOperationalIntelligenceSignals({
    coordinatorBurden,
    protocolFriction,
    runtimeRisk,
    scope: 'subject',
  })

  return {
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    computedAt: new Date().toISOString(),
    intelligenceVersion: OPERATIONAL_INTELLIGENCE_VERSION,
    coordinatorBurden,
    visitComplexityAggregate: {
      averageComplexityScore,
      maxComplexityScore,
      highComplexityVisitCount,
    },
    protocolFriction,
    runtimeRisk,
    signals,
    snapshot: {
      visitIntelligenceRowCount: visitIntel?.length ?? 0,
    },
  }
}
