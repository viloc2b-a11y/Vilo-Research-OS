import { computeSubjectOperationalIntelligence } from '@/lib/operational-intelligence/compute-subject'
import { upsertSubjectOperationalIntelligence } from '@/lib/operational-intelligence/persist'
import type { SubjectRuntimeProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichSubjectRuntimeWithOperationalIntelligence(input: {
  supabase: SupabaseClient
  projection: SubjectRuntimeProjection
  persist?: boolean
}): Promise<SubjectRuntimeProjection> {
  const intelligence = await computeSubjectOperationalIntelligence({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    studySubjectId: input.projection.studySubjectId,
  })

  if (input.persist) {
    await upsertSubjectOperationalIntelligence(intelligence)
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      operationalIntelligence: {
        burdenScore: intelligence.coordinatorBurden.burdenScore,
        frictionScore: intelligence.protocolFriction.frictionScore,
        riskLevel: intelligence.runtimeRisk.riskLevel,
        riskScore: intelligence.runtimeRisk.riskScore,
        signalCount: intelligence.signals.length,
        highComplexityVisitCount: intelligence.visitComplexityAggregate.highComplexityVisitCount,
      },
    },
  }
}
