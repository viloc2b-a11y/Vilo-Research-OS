import type { PerformanceScope, PerformanceQueryError } from '@/lib/performance/types'
import { getReadLayerClient } from '@/lib/performance/read-layer/query/supabase-client'
import {
  buildFallbackCoordinatorLoad,
  buildFallbackSubjectSignals,
} from '@/lib/performance/read-layer/fallback-signals'
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
import {
  loadCoordinatorLoadWorkflowActions,
  loadCoordinatorLoadSnapshotQueries,
  loadOverdueWorkflowActions,
  loadSnapshotQueryRiskSignals,
} from '@/lib/performance/read-layer/signals/workflow-signals'
import { loadBlockedProcedures } from '@/lib/performance/read-layer/signals/procedure-signals'
import { loadSubjectSignals } from '@/lib/performance/read-layer/signals/subject-signals'
import { loadDataCaptureSignals } from '@/lib/performance/read-layer/signals/data-capture-signals'
import { loadEventSignals } from '@/lib/performance/read-layer/signals/event-signals'
import { loadOpenGovernanceSignals } from '@/lib/performance/read-layer/signals/governance-signals'
import { loadFinancialLeakageRiskSignals } from '@/lib/performance/read-layer/signals/financial-signals'
import { loadLabLongitudinalSignals } from '@/lib/performance/read-layer/signals/lab-signals'
import { loadSafetyClockSignals } from '@/lib/performance/read-layer/signals/safety-signals'
import { loadConsentReconsentSignals } from '@/lib/performance/read-layer/signals/consent-signals'
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
  unsignedOver48hCount?: number
  visitsClosingWindowToday?: number
  enrollmentTarget?: number | null
  randomizedCount?: number
  enrollmentEndDate?: string | null
  budgetEvidenceDocumentCount?: number
  contractEvidenceDocumentCount?: number
  activeBudgetReferenceCount?: number
  activeContractReferenceCount?: number
  financialLeakageCount?: number
}): StudyHealthInput {
  return {
    studyId,
    blockedProcedureCount: metrics.blockedProcedureCount,
    missedVisitCount: metrics.missedVisitCount,
    openQueryCount: metrics.openQueryCount,
    openFindingsCount: 0,
    unsignedOver48hCount: metrics.unsignedOver48hCount ?? 0,
    visitsClosingWindowToday: metrics.visitsClosingWindowToday ?? 0,
    enrollmentTarget: metrics.enrollmentTarget ?? null,
    randomizedCount: metrics.randomizedCount ?? 0,
    enrollmentEndDate: metrics.enrollmentEndDate ?? null,
    budgetEvidenceDocumentCount: metrics.budgetEvidenceDocumentCount ?? 0,
    contractEvidenceDocumentCount: metrics.contractEvidenceDocumentCount ?? 0,
    activeBudgetReferenceCount: metrics.activeBudgetReferenceCount ?? 0,
    activeContractReferenceCount: metrics.activeContractReferenceCount ?? 0,
    financialLeakageCount: metrics.financialLeakageCount ?? 0,
    staleStudyFlag: false,
  }
}

function buildStudyCards(
  studies: { id: string; name: string; status: string }[],
  metricsByStudyId: Map<string, StudyMetrics>,
): StudyPerformanceCard[] {
  return studies.map((study) => {
    const metrics = metricsByStudyId.get(study.id)
    const budgetEvidenceCount =
      (metrics?.budgetEvidenceDocumentCount ?? 0) + (metrics?.contractEvidenceDocumentCount ?? 0)
    const activeBudgetReferenceCount =
      (metrics?.activeBudgetReferenceCount ?? 0) + (metrics?.activeContractReferenceCount ?? 0)
    let budgetNegotiationReadiness: StudyPerformanceCard['budgetNegotiationReadiness'] = 'ready'
    let budgetNegotiationReason = 'Budget and CTA evidence is indexed and ready for review.'
    let budgetNegotiationNextStep = 'Review candidate source chunks before negotiating terms.'
    if (budgetEvidenceCount === 0) {
      budgetNegotiationReadiness = 'blocked'
      budgetNegotiationReason = 'Budget / CTA evidence is missing.'
      budgetNegotiationNextStep = 'Open Document Intelligence and ingest Budget / CTA documents.'
    } else if (activeBudgetReferenceCount === 0) {
      budgetNegotiationReadiness = 'review_needed'
      budgetNegotiationReason = 'Evidence exists, but there is no active reference set.'
      budgetNegotiationNextStep = 'Activate the relevant budget and CTA references before negotiation.'
    }
    const base = {
      studyId: study.id,
      studyName: study.name,
      studyStatus: study.status,
      subjectCount: metrics?.subjectCount ?? 0,
      enrolledCount: metrics?.enrolledCount ?? 0,
      screeningCount: metrics?.screeningCount ?? 0,
      randomizedCount: metrics?.randomizedCount ?? 0,
      screenFailedCount: metrics?.screenFailedCount ?? 0,
      attributedSubjectCount: metrics?.attributedSubjectCount ?? 0,
      unattributedSubjectCount: metrics?.unattributedSubjectCount ?? 0,
      enrollmentTarget: metrics?.enrollmentTarget ?? null,
      enrollmentEndDate: metrics?.enrollmentEndDate ?? null,
      budgetEvidenceDocumentCount: metrics?.budgetEvidenceDocumentCount ?? 0,
      contractEvidenceDocumentCount: metrics?.contractEvidenceDocumentCount ?? 0,
      activeBudgetReferenceCount: metrics?.activeBudgetReferenceCount ?? 0,
      activeContractReferenceCount: metrics?.activeContractReferenceCount ?? 0,
      financialLeakageCount: metrics?.financialLeakageCount ?? 0,
      leakageScore: metrics?.leakageScore ?? 0,
      budgetNegotiationReadiness,
      budgetNegotiationReason,
      budgetNegotiationNextStep,
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
        unsignedOver48hCount: metrics?.unsignedOver48hCount ?? 0,
        visitsClosingWindowToday: metrics?.visitsClosingWindowToday ?? 0,
        enrollmentTarget: metrics?.enrollmentTarget ?? null,
        randomizedCount: metrics?.randomizedCount ?? 0,
        enrollmentEndDate: metrics?.enrollmentEndDate ?? null,
        budgetEvidenceDocumentCount: metrics?.budgetEvidenceDocumentCount ?? 0,
        contractEvidenceDocumentCount: metrics?.contractEvidenceDocumentCount ?? 0,
        activeBudgetReferenceCount: metrics?.activeBudgetReferenceCount ?? 0,
        activeContractReferenceCount: metrics?.activeContractReferenceCount ?? 0,
        financialLeakageCount: metrics?.financialLeakageCount ?? 0,
      }),
    )
  })
}

type StudyMetrics = {
  subjectCount: number
  enrolledCount?: number
  screeningCount?: number
  randomizedCount?: number
  screenFailedCount?: number
  attributedSubjectCount?: number
  unattributedSubjectCount?: number
  activeVisitCount: number
  missedVisitCount: number
  openQueryCount: number
  blockedProcedureCount: number
  unsignedOver48hCount?: number
  visitsClosingWindowToday?: number
  enrollmentTarget?: number | null
  enrollmentEndDate?: string | null
  budgetEvidenceDocumentCount?: number
  contractEvidenceDocumentCount?: number
  activeBudgetReferenceCount?: number
  activeContractReferenceCount?: number
  financialLeakageCount?: number
  leakageScore?: number
}

function incrementStudyMetric(
  metricsByStudyId: Map<string, StudyMetrics>,
  studyId: string,
  field: 'unsignedOver48hCount' | 'visitsClosingWindowToday' | 'financialLeakageCount',
) {
  const current = metricsByStudyId.get(studyId) ?? {
    subjectCount: 0,
    activeVisitCount: 0,
    missedVisitCount: 0,
    openQueryCount: 0,
    blockedProcedureCount: 0,
  }
  current[field] = (current[field] ?? 0) + 1
  metricsByStudyId.set(studyId, current)
}

function updateStudyLeakageScore(
  metricsByStudyId: Map<string, StudyMetrics>,
  studyId: string,
  score: number,
) {
  const current = metricsByStudyId.get(studyId) ?? {
    subjectCount: 0,
    activeVisitCount: 0,
    missedVisitCount: 0,
    openQueryCount: 0,
    blockedProcedureCount: 0,
  }
  current.leakageScore = Math.max(current.leakageScore ?? 0, score)
  metricsByStudyId.set(studyId, current)
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

  const [
    visitSignals,
    studySignals,
    overdueWorkflow,
    blockedProcedures,
    subjectSignals,
    dataCaptureSignals,
    eventSignals,
    coordinatorLoadWorkflow,
    governanceSignals,
    snapshotQueryRisk,
    coordinatorLoadSnapshotQueries,
    financialLeakageSignals,
    labLongitudinalSignals,
    safetyClockSignals,
    consentReconsentSignals,
  ] = await Promise.all([
    loadVisitSignals(client, queryScope),
    loadStudySignals(client, organizationIds, queryScope, studyIds),
    loadOverdueWorkflowActions(client, queryScope),
    loadBlockedProcedures(client, queryScope),
    loadSubjectSignals(client, queryScope),
    loadDataCaptureSignals(client, queryScope),
    loadEventSignals(client, queryScope),
    loadCoordinatorLoadWorkflowActions(client, queryScope),
    loadOpenGovernanceSignals(client, queryScope),
    loadSnapshotQueryRiskSignals(client, queryScope),
    loadCoordinatorLoadSnapshotQueries(client, queryScope),
    loadFinancialLeakageRiskSignals(client, queryScope),
    loadLabLongitudinalSignals(client, queryScope),
    loadSafetyClockSignals(client, queryScope),
    loadConsentReconsentSignals(client, queryScope),
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
  if (dataCaptureSignals.windowClosingToday.error) {
    errors.push(dataCaptureSignals.windowClosingToday.error)
  }
  if (dataCaptureSignals.unsignedVisitsOver48h.error) {
    errors.push(dataCaptureSignals.unsignedVisitsOver48h.error)
  }
  if (subjectSignals.markers.error) {
    errors.push(subjectSignals.markers.error)
  }
  if (eventSignals.events.error) {
    errors.push(eventSignals.events.error)
  }
  if (coordinatorLoadWorkflow.error) {
    errors.push(coordinatorLoadWorkflow.error)
  }
  if (governanceSignals.error) {
    errors.push(governanceSignals.error)
  }
  if (snapshotQueryRisk.error) {
    errors.push(snapshotQueryRisk.error)
  }
  if (coordinatorLoadSnapshotQueries.error) {
    errors.push(coordinatorLoadSnapshotQueries.error)
  }
  if (financialLeakageSignals.error) {
    errors.push(financialLeakageSignals.error)
  }
  if (labLongitudinalSignals.error) {
    errors.push(labLongitudinalSignals.error)
  }
  if (safetyClockSignals.safetyClocks.error) {
    errors.push(safetyClockSignals.safetyClocks.error)
  }
  if (consentReconsentSignals.consentSignals.error) {
    errors.push(consentReconsentSignals.consentSignals.error)
  }

  const metricsByStudyId = new Map(
    studySignals.studyCounts.rows.map((row) => [row.studyId, { ...row }]),
  )

  for (const row of dataCaptureSignals.windowClosingToday.rows) {
    incrementStudyMetric(metricsByStudyId, row.study_id as string, 'visitsClosingWindowToday')
  }
  for (const row of dataCaptureSignals.unsignedVisitsOver48h.rows) {
    incrementStudyMetric(metricsByStudyId, row.study_id as string, 'unsignedOver48hCount')
  }
  for (const row of financialLeakageSignals.rows) {
    incrementStudyMetric(metricsByStudyId, row.study_id as string, 'financialLeakageCount')
    const score = Number(row.leakage_score ?? 0)
    if (score > 0) {
      updateStudyLeakageScore(metricsByStudyId, row.study_id as string, score)
    }
  }

  const studyCards = buildStudyCards(scopedStudies, metricsByStudyId)

  const scoredSubjectSignals = buildFallbackSubjectSignals({
    riskVisits: visitSignals.riskVisits.rows,
    overdueWorkflow: overdueWorkflow.rows,
    blockedProcedures: blockedProcedures.rows,
    windowClosingToday: dataCaptureSignals.windowClosingToday.rows,
    unsignedVisitsOver48h: dataCaptureSignals.unsignedVisitsOver48h.rows,
    governanceSignals: governanceSignals.rows,
    snapshotQueries: snapshotQueryRisk.rows,
    financialLeakage: financialLeakageSignals.rows,
    labSignals: labLongitudinalSignals.rows,
    safetySignals: safetyClockSignals.safetyClocks.rows,
    consentSignals: consentReconsentSignals.consentSignals.rows,
  })
  const riskQueue = buildScoredRiskQueueFromSignals(scoredSubjectSignals)
  const coordinatorLoad = buildFallbackCoordinatorLoad([
    ...coordinatorLoadWorkflow.rows,
    ...coordinatorLoadSnapshotQueries.rows,
  ])

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
    coordinatorLoad,
  }
}
