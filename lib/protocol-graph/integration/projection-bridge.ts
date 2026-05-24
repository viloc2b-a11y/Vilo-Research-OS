import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import { deriveReadinessStatusFromBlockers, projectionBlocker } from '@/lib/projections/blockers'
import type { RuntimeProjectionBlocker, VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Merges protocol graph orchestration blockers into a visit readiness projection (derived only).
 */
export async function enrichVisitReadinessWithProtocolGraph(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
}): Promise<VisitReadinessProjection> {
  const orchestration = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: input.projection.organizationId,
    studyId: input.projection.studyId,
    visitId: input.projection.visitId,
  })

  if (orchestration.blockers.length === 0) {
    return {
      ...input.projection,
      snapshot: {
        ...input.projection.snapshot,
        protocolGraphPublicationId: orchestration.publicationId,
        protocolGraphRevision: orchestration.graphRevision,
      },
    }
  }

  const graphBlockers: RuntimeProjectionBlocker[] = orchestration.blockers.map((b) =>
    projectionBlocker({
      id: b.id,
      category: b.category,
      severity: b.severity,
      label: b.label,
      detail: b.detail,
    }),
  )

  const blockers = [...input.projection.blockers, ...graphBlockers]
  const blockerCount = blockers.filter((b) => b.severity === 'blocker').length
  const terminal = input.projection.readinessStatus === 'terminal'
  const readinessStatus = terminal
    ? 'terminal'
    : deriveReadinessStatusFromBlockers(blockers, false)
  const hasGraphSignoffBlock = orchestration.blockers.some(
    (b) => b.severity === 'blocker' && b.id.includes('signoff'),
  )

  return {
    ...input.projection,
    blockers,
    blockerCount,
    readinessStatus,
    coordinatorSignReady: hasGraphSignoffBlock ? false : input.projection.coordinatorSignReady,
    investigatorSignReady: hasGraphSignoffBlock ? false : input.projection.investigatorSignReady,
    visitCompletionReady: orchestration.blockers.some(
      (b) => b.severity === 'blocker' && b.detail.toLowerCase().includes('closeout'),
    )
      ? false
      : input.projection.visitCompletionReady,
    snapshot: {
      ...input.projection.snapshot,
      protocolGraphPublicationId: orchestration.publicationId,
      protocolGraphRevision: orchestration.graphRevision,
      protocolGraphDirectiveCount: orchestration.directives.filter((d) => d.matched).length,
      activeBranches: orchestration.activeBranches,
    },
  }
}
