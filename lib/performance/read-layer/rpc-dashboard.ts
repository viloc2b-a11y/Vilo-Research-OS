import { summarizeStudyPortfolio } from '@/lib/performance/portfolio'
import { mapCoordinatorLoadRows } from '@/lib/performance/portfolio/map-coordinator-load'
import { enrichStudyCardFromVpiRow } from '@/lib/performance/scoring/enrich-read-model'
import { buildScoredRiskQueueFromVpiRows } from '@/lib/performance/scoring'
import type {
  PerformanceLoadStatus,
  PerformanceQueryError,
  PerformanceReadModel,
} from '@/app/(ops)/performance/_lib/performance-types'
import type { VisitSnapshotAggregate } from '@/lib/performance/read-layer/signals/visit-signals'

/** RPC payload keys — must match vpi_load_dashboard() JSON shape. */
export const VPI_DASHBOARD_RPC_KEYS = [
  'study_health',
  'subject_risk_signals',
  'coordinator_load',
  'generated_at',
] as const

export type VpiStudyHealthRow = {
  organization_id: string
  study_id: string
  study_name: string
  study_status: string
  subject_count: number
  enrolled_count: number
  active_visit_count: number
  missed_visit_count: number
  open_query_count: number
  open_findings_count: number
  blocked_procedure_count: number
  unsigned_over_48h_count: number
  visits_closing_window_today: number
  stale_study_flag: boolean
  last_activity_at: string | null
}

export type VpiSubjectRiskSignalRow = {
  organization_id: string
  study_id: string
  subject_id: string
  subject_identifier?: string | null
  study_name?: string | null
  signal_kind: string
  signal_source: string
  signal_entity_id?: string | null
  signal_created_at: string
  signal_age_hours: number
  severity_rank: number
  recommended_action: string
}

export type VpiCoordinatorLoadRow = {
  organization_id: string
  user_id: string
  assigned_items: number
  overdue_items: number
  blocked_items: number
  due_today: number
  unassigned_queue: number
  last_active_at: string | null
}

export type VpiDashboardPayload = {
  study_health: VpiStudyHealthRow[]
  subject_risk_signals: VpiSubjectRiskSignalRow[]
  coordinator_load: VpiCoordinatorLoadRow[]
  generated_at: string
}

function resolveStatus(errors: PerformanceQueryError[], hasData: boolean): PerformanceLoadStatus {
  if (errors.some((e) => e.source === 'studies')) return 'error'
  if (errors.length > 0) return hasData ? 'partial' : 'error'
  if (!hasData) return 'empty'
  return 'ok'
}

export function mapRpcDashboardToReadModel(input: {
  payload: VpiDashboardPayload
  organizationCount: number
  selectedStudyId: string | null
  visitSnapshot: VisitSnapshotAggregate
  visitSnapshotErrors: PerformanceQueryError[]
  rpcError: PerformanceQueryError | null
}): PerformanceReadModel {
  const errors: PerformanceQueryError[] = []
  if (input.rpcError) errors.push(input.rpcError)
  errors.push(...input.visitSnapshotErrors)

  const studyFilterOptions = input.payload.study_health.map((row) => ({
    studyId: row.study_id,
    studyName: row.study_name,
  }))

  const selectedStudy = input.selectedStudyId
    ? input.payload.study_health.find((r) => r.study_id === input.selectedStudyId) ?? null
    : null

  if (input.selectedStudyId && !selectedStudy) {
    return {
      status: 'error',
      errors: [
        {
          source: 'study_filter',
          message: 'Selected study is not visible in your organization scope.',
        },
      ],
      organizationCount: input.organizationCount,
      studyFilter: {
        selectedStudyId: input.selectedStudyId,
        selectedStudyName: null,
        options: studyFilterOptions,
      },
      studyCards: [],
      riskQueue: [],
      visitSnapshot: input.visitSnapshot,
      portfolioSummary: { critical: 0, risk: 0, watch: 0, healthy: 0 },
      coordinatorLoad: [],
    }
  }

  const scopedHealth = selectedStudy
    ? input.payload.study_health.filter((r) => r.study_id === selectedStudy.study_id)
    : input.payload.study_health

  const studyCards = scopedHealth.map((row) => enrichStudyCardFromVpiRow(row))

  const scopedSignals = selectedStudy
    ? input.payload.subject_risk_signals.filter((r) => r.study_id === selectedStudy.study_id)
    : input.payload.subject_risk_signals

  const riskQueue = buildScoredRiskQueueFromVpiRows(scopedSignals)

  const studyFilter = {
    selectedStudyId: selectedStudy?.study_id ?? null,
    selectedStudyName: selectedStudy?.study_name ?? null,
    options: studyFilterOptions,
  }

  const hasData =
    studyCards.some(
      (c) =>
        c.subjectCount > 0 ||
        c.activeVisitCount > 0 ||
        c.missedVisitCount > 0 ||
        c.openQueryCount > 0 ||
        c.blockedProcedureCount > 0,
    ) ||
    riskQueue.length > 0 ||
    input.visitSnapshot.totalVisits > 0

  const coordinatorLoad = mapCoordinatorLoadRows(input.payload.coordinator_load)
  const unassigned = coordinatorLoad[0]?.unassignedQueue ?? 0
  if (unassigned > 0 && !coordinatorLoad.some((r) => r.userId === 'unassigned')) {
    coordinatorLoad.push({
      userId: 'unassigned',
      assignedItems: unassigned,
      overdueItems: 0,
      blockedItems: 0,
      dueToday: 0,
      unassignedQueue: unassigned,
      lastActiveAt: null,
    })
  }

  return {
    status: resolveStatus(errors, hasData),
    errors,
    organizationCount: input.organizationCount,
    studyFilter,
    studyCards,
    riskQueue,
    visitSnapshot: input.visitSnapshot,
    portfolioSummary: summarizeStudyPortfolio(studyCards),
    coordinatorLoad,
  }
}

export function parseVpiDashboardPayload(data: unknown): VpiDashboardPayload | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  return {
    study_health: Array.isArray(row.study_health) ? (row.study_health as VpiStudyHealthRow[]) : [],
    subject_risk_signals: Array.isArray(row.subject_risk_signals)
      ? (row.subject_risk_signals as VpiSubjectRiskSignalRow[])
      : [],
    coordinator_load: Array.isArray(row.coordinator_load)
      ? (row.coordinator_load as VpiCoordinatorLoadRow[])
      : [],
    generated_at:
      typeof row.generated_at === 'string'
        ? row.generated_at
        : new Date().toISOString(),
  }
}
