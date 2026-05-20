export {
  OPERATIONAL_STATES,
  STATE_PRIORITY_RANK,
  type OperationalState,
  type ScoredSubject,
  type ScoredStudy,
  type StudyHealthInput,
  type SubjectSignalInput,
  type SubjectSignalKind,
} from '@/lib/performance/scoring/types'

export {
  RECOMMENDED_ACTION_CODES,
  isRecommendedActionCode,
  recommendedActionForStudy,
  recommendedActionForSubjectSignal,
  recommendedActionLabel,
  pickPrimarySubjectSignal,
  type RecommendedActionCode,
} from '@/lib/performance/scoring/recommended-actions'

export {
  mergeSubjectOperationalState,
  operationalStateForSubjectSignalKind,
  scoreSubjectFromSignalKinds,
  scoreSubjectSignals,
} from '@/lib/performance/scoring/subject-scoring'

export {
  resolveStudyOperationalState,
  scoreStudyHealth,
  scoreStudyHealthRows,
} from '@/lib/performance/scoring/study-scoring'

export {
  buildScoredRiskQueueFromSignals,
  buildScoredRiskQueueFromVpiRows,
  capScoredSubjects,
  compareScoredSubjects,
  dedupeLegacyRiskQueueBySubjectId,
  dedupeScoredSubjectsBySubjectId,
  scoredSubjectToQueueItem,
  sortScoredSubjects,
  vpiRowsToSubjectSignals,
} from '@/lib/performance/scoring/risk-queue'
