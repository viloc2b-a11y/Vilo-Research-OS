import { visitDetailPath } from '@/lib/ops/paths'
import { enrichVisitReadinessWithGovernanceFabric } from '@/lib/governance-fabric/integration/projection-bridge'
import { enrichVisitReadinessWithCoordinatorOrchestration } from '@/lib/coordinator-orchestration/integration/projection-bridge'
import { enrichVisitReadinessWithRuntimeAutomation } from '@/lib/runtime-automation/integration/projection-bridge'
import { enrichVisitReadinessWithFinancialRuntime } from '@/lib/financial-runtime/integration/projection-bridge'
import { enrichVisitReadinessWithOperationalIntelligence } from '@/lib/operational-intelligence/integration/projection-bridge'
import { enrichVisitReadinessWithProtocolGraph } from '@/lib/protocol-graph/integration/projection-bridge'
import { enrichVisitReadinessWithSafetyContinuity } from '@/lib/safety-continuity/integration/projection-bridge'
import { assessProcedureReadiness } from '@/lib/subject/visits/progress-note/guards'
import { projectionBlocker, deriveReadinessStatusFromBlockers } from '@/lib/projections/blockers'
import { RUNTIME_PROJECTION_VERSION } from '@/lib/projections/constants'
import {
  isTerminalVisitStatus,
  loadProcedureExecutionsForVisit,
  loadVisitSourceMetrics,
  countOpenAdverseEventsForVisit,
} from '@/lib/projections/compute/shared'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeVisitReadinessProjection(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
  options?: { persistSafetyGovernance?: boolean },
): Promise<VisitReadinessProjection | null> {
  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      'id, organization_id, study_id, study_subject_id, visit_status, visit_review_status, scheduled_date',
    )
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!visit) return null

  const visitStatus = visit.visit_status as string
  const terminal = isTerminalVisitStatus(visitStatus)
  const href = visitDetailPath(visitId)

  const procedures = await loadProcedureExecutionsForVisit(supabase, visitId, organizationId)
  const sourceMetrics = await loadVisitSourceMetrics(supabase, procedures)
  const safetyBlockerCount = await countOpenAdverseEventsForVisit(
    supabase,
    visitId,
    organizationId,
  )

  const activeProcedures = procedures.filter((p) => !p.section_disabled_at)
  const pendingProcedureCount = activeProcedures.filter(
    (p) => p.execution_status === 'pending',
  ).length
  const unsignedProcedureCount = activeProcedures.filter((p) => !p.is_signed).length

  const blockers = []

  if (terminal) {
    blockers.push(
      projectionBlocker({
        id: 'visit-terminal',
        category: 'visit',
        severity: 'info',
        label: 'Visit terminal',
        detail: `Visit is in ${visitStatus} state.`,
        href,
      }),
    )
  }

  if (pendingProcedureCount > 0 && !terminal) {
    blockers.push(
      projectionBlocker({
        id: 'pending-procedures',
        category: 'procedures',
        severity: 'warning',
        label: 'Pending procedures',
        detail: `${pendingProcedureCount} procedure(s) not yet executed.`,
        href,
      }),
    )
  }

  if (unsignedProcedureCount > 0 && !terminal) {
    blockers.push(
      projectionBlocker({
        id: 'unsigned-procedures',
        category: 'signatures',
        severity: 'blocker',
        label: 'Unsigned procedures',
        detail: `${unsignedProcedureCount} procedure(s) require signature.`,
        href,
      }),
    )
  }

  if (sourceMetrics.unresolvedFindingCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'unresolved-findings',
        category: 'source',
        severity: 'blocker',
        label: 'Unresolved findings',
        detail: `${sourceMetrics.unresolvedFindingCount} critical open finding(s).`,
        href: visitDetailPath(visitId, 'source'),
      }),
    )
  }

  if (sourceMetrics.unsubmittedSourceCount > 0 && !terminal) {
    blockers.push(
      projectionBlocker({
        id: 'missing-source',
        category: 'source',
        severity: 'blocker',
        label: 'Missing source',
        detail: `${sourceMetrics.unsubmittedSourceCount} procedure(s) need submitted capture.`,
        href: visitDetailPath(visitId, 'source'),
      }),
    )
  }

  if (safetyBlockerCount > 0) {
    blockers.push(
      projectionBlocker({
        id: 'visit-safety',
        category: 'safety',
        severity: 'warning',
        label: 'Open adverse events',
        detail: `${safetyBlockerCount} open AE(s) linked to this visit.`,
        href,
      }),
    )
  }

  const procedureRows = activeProcedures.map((p) => ({
    id: p.id,
    is_signed: Boolean(p.is_signed),
    validation_status: p.validation_status ?? 'pending',
  }))

  const completion = assessProcedureReadiness(
    procedureRows,
    sourceMetrics.unresolvedFindingCount,
  )

  if (completion.visitCompletionBlockReasons.length > 0 && !terminal) {
    for (const reason of completion.visitCompletionBlockReasons) {
      blockers.push(
        projectionBlocker({
          id: `completion-${reason.slice(0, 24)}`,
          category: 'completion',
          severity: 'blocker',
          label: 'Visit completion blocked',
          detail: reason,
          href,
        }),
      )
    }
  }

  const coordinatorSignReady =
    !terminal &&
    sourceMetrics.unsubmittedSourceCount === 0 &&
    sourceMetrics.unresolvedFindingCount === 0 &&
    activeProcedures.filter((p) => p.validation_status === 'blocked').length === 0

  const investigatorSignReady =
    coordinatorSignReady && visit.visit_review_status === 'coordinator_signed'

  const visitCompletionReady = !terminal && !completion.visitCompletionBlocked

  const readinessStatus = deriveReadinessStatusFromBlockers(blockers, terminal)

  const baseProjection = {
    visitId,
    organizationId: visit.organization_id as string,
    studyId: visit.study_id as string,
    studySubjectId: visit.study_subject_id as string,
    computedAt: new Date().toISOString(),
    projectionVersion: RUNTIME_PROJECTION_VERSION,
    readinessStatus: terminal ? 'terminal' : readinessStatus,
    pendingProcedureCount,
    unsignedProcedureCount,
    unresolvedFindingCount: sourceMetrics.unresolvedFindingCount,
    missingSourceCount: sourceMetrics.unsubmittedSourceCount,
    safetyBlockerCount,
    visitCompletionReady,
    coordinatorSignReady,
    investigatorSignReady,
    blockerCount: blockers.filter((b) => b.severity === 'blocker').length,
    blockers,
    snapshot: {
      visitStatus,
      visitReviewStatus: visit.visit_review_status,
      scheduledDate: visit.scheduled_date,
      procedureCount: procedures.length,
    },
  }

  const withGraph = await enrichVisitReadinessWithProtocolGraph({
    supabase,
    projection: baseProjection,
  })

  const withSafety = await enrichVisitReadinessWithSafetyContinuity({
    supabase,
    projection: withGraph,
    persist: options?.persistSafetyGovernance ?? false,
  })

  const withGovernance = await enrichVisitReadinessWithGovernanceFabric({
    supabase,
    projection: withSafety,
    persistSignals: options?.persistSafetyGovernance ?? false,
  })

  const withIntelligence = await enrichVisitReadinessWithOperationalIntelligence({
    supabase,
    projection: withGovernance,
    persist: options?.persistSafetyGovernance ?? false,
    includeReplaySummary: true,
  })

  const withFinancial = await enrichVisitReadinessWithFinancialRuntime({
    supabase,
    projection: withIntelligence,
    persist: options?.persistSafetyGovernance ?? false,
  })

  const withOrchestration = await enrichVisitReadinessWithCoordinatorOrchestration({
    supabase,
    projection: withFinancial,
    persist: options?.persistSafetyGovernance ?? false,
  })

  return enrichVisitReadinessWithRuntimeAutomation({
    supabase,
    projection: withOrchestration,
    persist: options?.persistSafetyGovernance ?? false,
  })
}
