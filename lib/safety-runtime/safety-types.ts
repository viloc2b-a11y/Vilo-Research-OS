export const SAFETY_EVENT_TYPE = {
  AE: 'ae',
  SAE: 'sae',
} as const

export type SafetyEventType = (typeof SAFETY_EVENT_TYPE)[keyof typeof SAFETY_EVENT_TYPE]

export const SAFETY_EVENT_STATUS = {
  CANDIDATE: 'candidate',
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  CLOSED: 'closed',
} as const

export type SafetyEventStatus = (typeof SAFETY_EVENT_STATUS)[keyof typeof SAFETY_EVENT_STATUS]

export const SOURCE_TYPE = {
  MANUAL: 'manual',
  LAB_SIGNAL: 'lab_signal',
  PROTOCOL_DEVIATION: 'protocol_deviation',
  SOURCE_REVIEW: 'source_review',
} as const

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE]

export const SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
} as const

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY]

export const RELATEDNESS = {
  UNRELATED: 'unrelated',
  UNLIKELY: 'unlikely',
  POSSIBLE: 'possible',
  PROBABLE: 'probable',
  DEFINITE: 'definite',
} as const

export type Relatedness = (typeof RELATEDNESS)[keyof typeof RELATEDNESS]

export type SafetyEventRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  eventType: SafetyEventType | null
  eventStatus: SafetyEventStatus
  sourceType: SourceType
  description: string
  severity: Severity | null
  relatedness: Relatedness | null
  requiresFollowUp: boolean
  openedAt: string
  closedAt: string | null
  createdBy: string
  updatedBy: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateSafetyEventInput = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  eventType?: SafetyEventType | null
  sourceType?: SourceType
  description: string
  severity?: Severity | null
  relatedness?: Relatedness | null
  requiresFollowUp?: boolean
  openedAt?: string
  metadata?: Record<string, unknown>
}

export type UpdateSafetyEventInput = {
  eventType?: SafetyEventType | null
  eventStatus?: SafetyEventStatus
  description?: string
  severity?: Severity | null
  relatedness?: Relatedness | null
  requiresFollowUp?: boolean
  closedAt?: string | null
  metadata?: Record<string, unknown>
}

export function mapSafetyEventRow(row: Record<string, unknown>): SafetyEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitId: row.visit_id != null ? String(row.visit_id) : null,
    eventType: row.event_type != null ? (row.event_type as SafetyEventType) : null,
    eventStatus: row.event_status as SafetyEventStatus,
    sourceType: row.source_type as SourceType,
    description: String(row.description),
    severity: row.severity as Severity | null,
    relatedness: row.relatedness as Relatedness | null,
    requiresFollowUp: Boolean(row.requires_follow_up),
    openedAt: String(row.opened_at),
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    metadata: row.metadata as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
