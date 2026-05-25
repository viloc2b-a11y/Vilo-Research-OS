import { computeVisitOperationalIntelligence } from '@/lib/operational-intelligence/compute-visit'
import { upsertVisitOperationalIntelligence } from '@/lib/operational-intelligence/persist'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Enriches visit readiness snapshot with operational intelligence (derived only).
 * Full replay remains on-demand via rebuildVisitReplay.
 */
export async function enrichVisitReadinessWithOperationalIntelligence(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persist?: boolean
  includeReplaySummary?: boolean
}): Promise<VisitReadinessProjection> {
  const intelligence = await computeVisitOperationalIntelligence({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    studySubjectId: input.projection.studySubjectId,
    visitId: input.projection.visitId,
    projection: input.projection,
  })

  if (input.persist) {
    await upsertVisitOperationalIntelligence(intelligence)
  }

  let replaySummary: string | undefined
  if (input.includeReplaySummary) {
    const explanation = intelligence.snapshot.readinessExplanation as
      | { summary?: string; primaryCauses?: string[] }
      | undefined
    if (explanation?.primaryCauses?.length) {
      replaySummary = explanation.primaryCauses.slice(0, 3).join('; ')
    }
  }

  return {
    ...input.projection,
    snapshot: {
      ...input.projection.snapshot,
      operationalIntelligence: {
        burdenScore: intelligence.coordinatorBurden.burdenScore,
        complexityScore: intelligence.visitComplexity.complexityScore,
        frictionScore: intelligence.protocolFriction.frictionScore,
        riskLevel: intelligence.runtimeRisk.riskLevel,
        riskScore: intelligence.runtimeRisk.riskScore,
        signalCount: intelligence.signals.length,
        riskFactors: intelligence.runtimeRisk.riskFactors,
      },
      replayBlockedSummary: replaySummary,
    },
  }
}
