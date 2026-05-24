import { computeCoordinatorBurden } from '@/lib/operational-intelligence/metrics/coordinator-burden'
import { computeProtocolFriction } from '@/lib/operational-intelligence/metrics/protocol-friction'
import { computeRuntimeRisk } from '@/lib/operational-intelligence/metrics/runtime-risk'
import { computeVisitComplexity } from '@/lib/operational-intelligence/metrics/visit-complexity'
import { emitOperationalIntelligenceSignals } from '@/lib/operational-intelligence/signals/engine'
import {
  OPERATIONAL_INTELLIGENCE_VERSION,
  type VisitOperationalIntelligence,
} from '@/lib/operational-intelligence/types'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitOperationalIntelligence(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
  projection?: VisitReadinessProjection | null
}): Promise<VisitOperationalIntelligence> {
  const coordinatorBurden = await computeCoordinatorBurden({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
  })

  const visitComplexity = await computeVisitComplexity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    projection: input.projection,
  })

  const protocolFriction = await computeProtocolFriction({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
    visitBlockerIds: input.projection?.blockers.map((b) => b.id),
    graphEscalationCount: visitComplexity.safetyEscalationCount,
  })

  const runtimeRisk = computeRuntimeRisk({
    coordinatorBurden,
    visitComplexity,
    protocolFriction,
    unresolvedBlockerCount: visitComplexity.unresolvedBlockerCount,
  })

  const signals = emitOperationalIntelligenceSignals({
    coordinatorBurden,
    visitComplexity,
    protocolFriction,
    runtimeRisk,
    scope: 'visit',
  })

  const readinessExplanation = input.projection
    ? explainVisitReadinessBlocked({ projection: input.projection })
    : undefined

  return {
    visitId: input.visitId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    computedAt: new Date().toISOString(),
    intelligenceVersion: OPERATIONAL_INTELLIGENCE_VERSION,
    coordinatorBurden,
    visitComplexity,
    protocolFriction,
    runtimeRisk,
    signals,
    snapshot: {
      readinessExplanation,
      signalCount: signals.length,
    },
  }
}
