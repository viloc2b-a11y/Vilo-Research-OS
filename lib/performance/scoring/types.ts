/** Phase 7C operational states (not exposed as UI labels). */
export type OperationalState = 'healthy' | 'watch' | 'risk' | 'critical'

export const OPERATIONAL_STATES: readonly OperationalState[] = [
  'healthy',
  'watch',
  'risk',
  'critical',
] as const

/** Internal sort key — higher number = more urgent. Never surface in UI copy. */
export const STATE_PRIORITY_RANK: Record<OperationalState, number> = {
  healthy: 0,
  watch: 1,
  risk: 2,
  critical: 3,
}

/** Phase 7B / RPC signal_kind values consumed by subject scoring. */
export type SubjectSignalKind =
  | 'missed_visit'
  | 'out_of_window'
  | 'overdue_action'
  | 'blocked_procedure'
  | 'window_warning'
  | 'unsigned_procedure_48h'
  | 'window_closing_today'
  | 'stale_subject'

export type SubjectSignalInput = {
  organizationId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string
  studyName: string
  signalKind: SubjectSignalKind
  signalSource: string
  signalEntityId: string | null
  signalCreatedAt: string
  signalAgeHours: number
  detailText: string
}

export type StudyHealthInput = {
  studyId: string
  blockedProcedureCount: number
  missedVisitCount: number
  openQueryCount: number
  openFindingsCount: number
  unsignedOver48hCount: number
  visitsClosingWindowToday: number
  staleStudyFlag: boolean
}

export type ScoredSubject = {
  organizationId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string
  studyName: string
  operationalState: OperationalState
  /** @internal */
  priorityRank: number
  primarySignalKind: SubjectSignalKind
  primarySignalSource: string
  primarySignalEntityId: string | null
  sortDate: string
  signalAgeHours: number
  detailText: string
  signalKinds: SubjectSignalKind[]
}

export type ScoredStudy = {
  studyId: string
  operationalState: OperationalState
  /** @internal */
  priorityRank: number
}
