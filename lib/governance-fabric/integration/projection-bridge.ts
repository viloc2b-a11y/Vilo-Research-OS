import { detectVisitGovernanceSignals } from '@/lib/governance-fabric/detect-deviations'
import {
  governanceSignalsToBlockers,
  syncGovernanceSignalsForVisit,
} from '@/lib/governance-fabric/signals'
import { deriveReadinessStatusFromBlockers, projectionBlocker } from '@/lib/projections/blockers'
import { subjectDeviationsTabPath } from '@/lib/ops/paths'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichVisitReadinessWithGovernanceFabric(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persistSignals?: boolean
}): Promise<VisitReadinessProjection> {
  const signals = await detectVisitGovernanceSignals({
    supabase: input.supabase,
    projection: input.projection,
  })

  if (input.persistSignals) {
    await syncGovernanceSignalsForVisit({
      supabase: input.supabase,
      signals,
      organizationId: input.projection.organizationId,
      visitId: input.projection.visitId,
    })
  }

  const governanceBlockers = governanceSignalsToBlockers(signals).map((b) =>
    projectionBlocker({
      ...b,
      href: subjectDeviationsTabPath(input.projection.studyId, input.projection.studySubjectId),
    }),
  )

  const existingIds = new Set(input.projection.blockers.map((b) => b.id))
  const newBlockers = governanceBlockers.filter((b) => !existingIds.has(b.id))
  const blockers = [...input.projection.blockers, ...newBlockers]
  const terminal = input.projection.readinessStatus === 'terminal'

  const readinessStatus = terminal
    ? 'terminal'
    : deriveReadinessStatusFromBlockers(blockers, false)

  const hasGovernanceSignoffBlock = signals.some(
    (s) => s.severity === 'blocker' && s.signalType.includes('signoff'),
  )

  return {
    ...input.projection,
    blockers,
    blockerCount: blockers.filter((b) => b.severity === 'blocker').length,
    readinessStatus,
    coordinatorSignReady: hasGovernanceSignoffBlock
      ? false
      : input.projection.coordinatorSignReady,
    investigatorSignReady: hasGovernanceSignoffBlock
      ? false
      : input.projection.investigatorSignReady,
    snapshot: {
      ...input.projection.snapshot,
      governanceSignalCount: signals.length,
      governanceOpenBlockerCount: signals.filter((s) => s.severity === 'blocker').length,
      governanceSignalTypes: [...new Set(signals.map((s) => s.signalType))],
    },
  }
}
