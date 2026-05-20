import type { VpiStudyHealthRow } from '@/lib/performance/read-layer/rpc-dashboard'
import {
  recommendedActionForStudy,
  scoreStudyHealth,
  type StudyHealthInput,
} from '@/lib/performance/scoring'
import type {
  StudyPerformanceCard,
} from '@/app/(ops)/performance/_lib/performance-types'

export function studyHealthInputFromVpiRow(row: VpiStudyHealthRow): StudyHealthInput {
  return {
    studyId: row.study_id,
    blockedProcedureCount: row.blocked_procedure_count,
    missedVisitCount: row.missed_visit_count,
    openQueryCount: row.open_query_count,
    openFindingsCount: row.open_findings_count,
    unsignedOver48hCount: row.unsigned_over_48h_count,
    visitsClosingWindowToday: row.visits_closing_window_today,
    staleStudyFlag: row.stale_study_flag,
  }
}

export function studyHealthInputFromCard(card: StudyPerformanceCard): StudyHealthInput {
  return {
    studyId: card.studyId,
    blockedProcedureCount: card.blockedProcedureCount,
    missedVisitCount: card.missedVisitCount,
    openQueryCount: card.openQueryCount,
    openFindingsCount: card.openFindingsCount ?? 0,
    unsignedOver48hCount: card.unsignedOver48hCount ?? 0,
    visitsClosingWindowToday: card.visitsClosingWindowToday ?? 0,
    staleStudyFlag: card.staleStudyFlag ?? false,
  }
}

export function enrichStudyCardFromHealth(
  card: Omit<StudyPerformanceCard, 'operationalState' | 'recommendedAction'>,
  health: StudyHealthInput,
): StudyPerformanceCard {
  const scored = scoreStudyHealth(health)
  return {
    ...card,
    openFindingsCount: health.openFindingsCount,
    unsignedOver48hCount: health.unsignedOver48hCount,
    visitsClosingWindowToday: health.visitsClosingWindowToday,
    staleStudyFlag: health.staleStudyFlag,
    operationalState: scored.operationalState,
    recommendedAction: recommendedActionForStudy(health, scored.operationalState),
  }
}

export function enrichStudyCardFromVpiRow(row: VpiStudyHealthRow): StudyPerformanceCard {
  const health = studyHealthInputFromVpiRow(row)
  return enrichStudyCardFromHealth(
    {
      studyId: row.study_id,
      studyName: row.study_name,
      studyStatus: row.study_status,
      subjectCount: row.subject_count,
      enrolledCount: row.enrolled_count,
      activeVisitCount: row.active_visit_count,
      missedVisitCount: row.missed_visit_count,
      openQueryCount: row.open_query_count,
      openFindingsCount: row.open_findings_count,
      blockedProcedureCount: row.blocked_procedure_count,
      lastActivityAt: row.last_activity_at,
      href: `/studies/${row.study_id}`,
    },
    health,
  )
}
