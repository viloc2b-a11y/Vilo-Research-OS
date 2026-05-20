import type { PerformanceScope, PerformanceQueryError } from '@/lib/performance/types'
import { getReadLayerClient } from '@/lib/performance/read-layer/query/supabase-client'
import { buildFallbackSubjectSignals } from '@/lib/performance/read-layer/fallback-signals'
import { summarizeStudyPortfolio } from '@/lib/performance/portfolio'
import { buildScoredRiskQueueFromSignals } from '@/lib/performance/scoring'
import { enrichStudyCardFromHealth } from '@/lib/performance/scoring/enrich-read-model'
import type { StudyHealthInput } from '@/lib/performance/scoring'
import { toQueryScope } from '@/lib/performance/read-layer/scope'
import {
  loadStudiesList,
  loadStudySignals,
} from '@/lib/performance/read-layer/signals/study-signals'
import { loadVisitSignals } from '@/lib/performance/read-layer/signals/visit-signals'
import { loadOverdueWorkflowActions } from '@/lib/performance/read-layer/signals/workflow-signals'
import { loadBlockedProcedures } from '@/lib/performance/read-layer/signals/procedure-signals'
import { loadSubjectSignals } from '@/lib/performance/read-layer/signals/subject-signals'
import { loadDataCaptureSignals } from '@/lib/performance/read-layer/signals/data-capture-signals'
import { loadEventSignals } from '@/lib/performance/read-layer/signals/event-signals'
import type {
  PerformanceLoadStatus,
  PerformanceReadModel,
  StudyPerformanceCard,
} from '@/app/(ops)/performance/_lib/performance-types'

function emptyModel(
  overrides: Partial<PerformanceReadModel> & Pick<PerformanceReadModel, 'status'>,
): PerformanceReadModel {
  return {
    status: overrides.status,
    errors: overrides.errors ?? [],
    organizationCount: overrides.organizationCount ?? 0,
    studyFilter: overrides.studyFilter ?? {
      selectedStudyId: null,
      selectedStudyName: null,
      options: [],
    },
    studyCards: overrides.studyCards ?? [],
    riskQueue: overrides.riskQueue ?? [],
    visitSnapshot: overrides.visitSnapshot ?? {
      totalVisits: 0,
      byVisitStatus: {},
      bySourceStatus: {},
      byReviewStatus: {},
    },
    portfolioSummary: overrides.portfolioSummary ?? {
      critical: 0,
      risk: 0,
      watch: 0,
      healthy: 0,
    },
    coordinatorLoad: overrides.coordinatorLoad ?? [],
  }
}

function resolveStatus(errors: PerformanceQueryError[], hasData: boolean): PerformanceLoadStatus {
  if (errors.some((e) => e.source === 'studies')) return 'error'
  if (errors.length > 0) return hasData ? 'partial' : 'error'
  if (!hasData) return 'empty'
  return 'ok'
}

function fallbackStudyHealth(studyId: string, metrics: {
  missedVisitCount: number
  openQueryCount: number
  blockedProcedureCount: number
}): StudyHealthInput {
  return {
    studyId,
    blockedProcedureCount: metrics.blockedProcedureCount,
    missedVisitCount: metrics.missedVisitCount,
    openQueryCount: metrics.openQueryCount,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: false,
  }
}

function buildStudyCards(
  studies: { id: string; name: string; status: string }[],
  metricsByStudyId: Map<
    string,
    {
      subjectCount: number
      activeVisitCount: number
      missedVisitCount: number
      openQueryCount: number
      blockedProcedureCount: number
    }
  >,
): StudyPerformanceCard[] {
  return studies.map((study) => {
    const metrics = metricsByStudyId.get(study.id)
    const base = {
      studyId: study.id,
      studyName: study.name,
      studyStatus: study.status,
      subjectCount: metrics?.subjectCount ?? 0,
      activeVisitCount: metrics?.activeVisitCount ?? 0,
      missedVisitCount: metrics?.missedVisitCount ?? 0,
      openQueryCount: metrics?.openQueryCount ?? 0,
      blockedProcedureCount: metrics?.blockedProcedureCount ?? 0,
      href: `/studies/${study.id}`,
    }
    return enrichStudyCardFromHealth(
      base,
      fallbackStudyHealth(study.id, {
        missedVisitCount: base.missedVisitCount,
        openQueryCount: base.openQueryCount,
        blockedProcedureCount: base.blockedProcedureCount,
      }),
    )
  })
}

export async function buildFromSignals(scope: PerformanceScope): Promise<PerformanceReadModel> {
  const { organizationIds, selectedStudyId } = scope

  if (organizationIds.length === 0) {
    return emptyModel({
      status: 'empty',
      organizationCount: 0,
      errors: [
        {
          source: 'session',
          message: 'No organization memberships found for your account.',
        },
      ],
    })
  }

  const client = await getReadLayerClient()
  const errors: PerformanceQueryError[] = []

  const studiesList = await loadStudiesList(client, organizationIds)

  if (studiesList.error) {
    return emptyModel({
      status: 'error',
      organizationCount: organizationIds.length,
      errors: [studiesList.error],
    })
  }

  const allStudies = studiesList.rows
  const studyFilterOptions = allStudies.map((s) => ({
    studyId: s.id,
    studyName: s.name,
  }))

  const selectedStudy = selectedStudyId
    ? allStudies.find((s) => s.id === selectedStudyId) ?? null
    : null

  if (selectedStudyId && !selectedStudy) {
    return emptyModel({
      status: 'error',
      organizationCount: organizationIds.length,
      studyFilter: {
        selectedStudyId,
        selectedStudyName: null,
        options: studyFilterOptions,
      },
      errors: [
        {
          source: 'study_filter',
          message: 'Selected study is not visible in your organization scope.',
        },
      ],
    })
  }

  if (allStudies.length === 0) {
    return emptyModel({
      status: 'empty',
      organizationCount: organizationIds.length,
      studyFilter: {
        selectedStudyId: null,
        selectedStudyName: null,
        options: [],
      },
      errors: [
        {
          source: 'studies',
          message: 'No studies are visible for your organization memberships.',
        },
      ],
    })
  }

  const scopedStudies = selectedStudy ? [selectedStudy] : allStudies
  const studyIds = scopedStudies.map((s) => s.id)
  const queryScope = toQueryScope(organizationIds, studyIds)

  const [visitSignals, studySignals, overdueWorkflow, blockedProcedures] = await Promise.all([
    loadVisitSignals(client, queryScope),
    loadStudySignals(client, organizationIds, queryScope, studyIds),
    loadOverdueWorkflowActions(client, queryScope),
    loadBlockedProcedures(client, queryScope),
    loadSubjectSignals(client, queryScope),
    loadDataCaptureSignals(client, queryScope),
    loadEventSignals(client, queryScope),
  ])

  errors.push(...visitSignals.snapshotErrors)
  errors.push(...studySignals.studyCountErrors)

  if (visitSignals.riskVisits.error) {
    errors.push(visitSignals.riskVisits.error)
  }
  if (overdueWorkflow.error) {
    errors.push(overdueWorkflow.error)
  }
  if (blockedProcedures.error) {
    errors.push(blockedProcedures.error)
  }

  const metricsByStudyId = new Map(
    studySignals.studyCounts.rows.map((row) => [row.studyId, row]),
  )

  const studyCards = buildStudyCards(scopedStudies, metricsByStudyId)

  const subjectSignals = buildFallbackSubjectSignals({
    riskVisits: visitSignals.riskVisits.rows,
    overdueWorkflow: overdueWorkflow.rows,
    blockedProcedures: blockedProcedures.rows,
  })
  const riskQueue = buildScoredRiskQueueFromSignals(subjectSignals)

  const visitSnapshot = visitSignals.snapshot

  const studyFilter = {
    selectedStudyId: selectedStudy?.id ?? null,
    selectedStudyName: selectedStudy?.name ?? null,
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
    visitSnapshot.totalVisits > 0

  return {
    status: resolveStatus(errors, hasData),
    errors,
    organizationCount: organizationIds.length,
    studyFilter,
    studyCards,
    riskQueue,
    visitSnapshot,
    portfolioSummary: summarizeStudyPortfolio(studyCards),
    coordinatorLoad: [],
  }
}
