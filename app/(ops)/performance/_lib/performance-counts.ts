/**
 * @deprecated Import from lib/performance/read-layer/signals instead.
 * Re-exports preserved for backwards compatibility during Phase 7A.
 */
export {
  loadStudyCardCounts,
  loadStudiesList,
  type StudyCountsRow,
  type StudyRow,
} from '@/lib/performance/read-layer/signals/study-signals'

export {
  loadVisitSnapshot,
  loadVisitSnapshot as loadVisitSnapshotCounts,
  loadRiskVisits,
  type VisitSnapshotAggregate,
} from '@/lib/performance/read-layer/signals/visit-signals'

export type { PerformanceQueryScope } from '@/lib/performance/types'
