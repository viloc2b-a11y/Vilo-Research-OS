import {
  graphSafetyItemsFromOrchestration,
  strengthenGraphSafetyBlockers,
} from '@/lib/safety-continuity/graph-safety-bridge'
import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import { computeVisitSafetyCarryForward } from '@/lib/safety-continuity/carry-forward'
import { computeSubjectSafetyContinuity } from '@/lib/safety-continuity/compute-subject'
import {
  upsertSubjectSafetyContinuityProjection,
  upsertVisitSafetyCarryForwardProjection,
} from '@/lib/safety-continuity/persist'
import { deriveReadinessStatusFromBlockers, projectionBlocker } from '@/lib/projections/blockers'
import { subjectAdverseEventsTabPath } from '@/lib/ops/paths'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function enrichVisitReadinessWithSafetyContinuity(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
  persist?: boolean
}): Promise<VisitReadinessProjection> {
  const terminal = input.projection.readinessStatus === 'terminal'
  const aeHref = subjectAdverseEventsTabPath(
    input.projection.studyId,
    input.projection.studySubjectId,
  )

  const [subjectContinuity, carryForward, graphOrchestration] = await Promise.all([
    computeSubjectSafetyContinuity({
      supabase: input.supabase,
      organizationId: input.projection.organizationId,
      studyId: input.projection.studyId,
      studySubjectId: input.projection.studySubjectId,
    }),
    computeVisitSafetyCarryForward({
      supabase: input.supabase,
      organizationId: input.projection.organizationId,
      studyId: input.projection.studyId,
      studySubjectId: input.projection.studySubjectId,
      visitId: input.projection.visitId,
      terminalVisit: terminal,
    }),
    evaluateVisitGraphOrchestration({
      supabase: input.supabase,
      organizationId: input.projection.organizationId,
      studyId: input.projection.studyId,
      visitId: input.projection.visitId,
    }),
  ])

  if (input.persist) {
    await upsertSubjectSafetyContinuityProjection(input.supabase, subjectContinuity)
    await upsertVisitSafetyCarryForwardProjection(input.supabase, carryForward)
  }

  const strengthenedGraphBlockers = strengthenGraphSafetyBlockers({
    graphBlockers: graphOrchestration.blockers,
    subjectContinuityState: subjectContinuity.continuityState,
    unresolvedItems: subjectContinuity.unresolvedItems,
  })

  const strengthenedById = new Map(strengthenedGraphBlockers.map((b) => [b.id, b]))

  const existingIds = new Set(input.projection.blockers.map((b) => b.id))
  const carryBlockers = carryForward.blockers
    .filter((b) => !existingIds.has(b.id))
    .map((b) =>
      projectionBlocker({
        id: b.id,
        category: b.category,
        severity: b.severity,
        label: b.label,
        detail: b.detail,
        href: aeHref,
      }),
    )

  const signoffAeBlocker =
    !terminal && subjectContinuity.unresolvedAeCount > 0
      ? [
          projectionBlocker({
            id: 'safety-signoff-ae-subject',
            category: 'safety_continuity',
            severity: 'blocker',
            label: 'Unresolved AE blocks signoff',
            detail: `${subjectContinuity.unresolvedAeCount} open AE(s) on subject must be resolved before signoff.`,
            href: aeHref,
          }),
        ]
      : []

  const blockers = [
    ...input.projection.blockers
      .filter((b) => b.id !== 'visit-safety' || carryForward.visitLinkedAeCount === 0)
      .map((b) => {
        const strengthened = strengthenedById.get(b.id)
        if (!strengthened || strengthened.severity === b.severity) return b
        return { ...b, severity: strengthened.severity, detail: strengthened.detail }
      }),
    ...carryBlockers,
    ...signoffAeBlocker,
  ]

  const safetyBlockerCount =
    subjectContinuity.unresolvedAeCount
    + carryForward.carriedAeCount
    + graphSafetyItemsFromOrchestration(graphOrchestration).length

  const hasSignoffBlock = blockers.some(
    (b) => b.severity === 'blocker' && (b.category.includes('safety') || b.id.includes('signoff')),
  )

  const readinessStatus = terminal
    ? 'terminal'
    : deriveReadinessStatusFromBlockers(blockers, false)

  return {
    ...input.projection,
    safetyBlockerCount,
    blockers,
    blockerCount: blockers.filter((b) => b.severity === 'blocker').length,
    readinessStatus,
    coordinatorSignReady: hasSignoffBlock ? false : input.projection.coordinatorSignReady,
    investigatorSignReady: hasSignoffBlock ? false : input.projection.investigatorSignReady,
    visitCompletionReady: hasSignoffBlock ? false : input.projection.visitCompletionReady,
    snapshot: {
      ...input.projection.snapshot,
      safetyContinuityState: subjectContinuity.continuityState,
      carryForwardActive: carryForward.carryForwardActive,
      carriedAeCount: carryForward.carriedAeCount,
      graphSafetyDirectiveCount: graphOrchestration.directives.filter((d) => d.matched).length,
    },
  }
}
