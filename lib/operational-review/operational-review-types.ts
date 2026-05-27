export const REVIEW_TYPE = {
  OPERATIONAL: 'operational',
  PI_REVIEW: 'pi_review',
  QUALITY_REVIEW: 'quality_review',
  MONITOR_PREP: 'monitor_prep',
} as const

export type ReviewType = (typeof REVIEW_TYPE)[keyof typeof REVIEW_TYPE]

export const REVIEW_STATUS = {
  NOT_STARTED: 'not_started',
  IN_REVIEW: 'in_review',
  QUERIES_OPEN: 'queries_open',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS]

export const QUERY_SCOPE = {
  VISIT: 'visit',
  PROCEDURE: 'procedure',
  FIELD: 'field',
  SOURCE_SECTION: 'source_section',
} as const

export type QueryScope = (typeof QUERY_SCOPE)[keyof typeof QUERY_SCOPE]

export const QUERY_STATUS = {
  OPEN: 'open',
  ANSWERED: 'answered',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
} as const

export type QueryStatus = (typeof QUERY_STATUS)[keyof typeof QUERY_STATUS]

export const QUERY_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type QueryPriority = (typeof QUERY_PRIORITY)[keyof typeof QUERY_PRIORITY]

export const QUERY_EVENT_TYPE = {
  QUERY_OPENED: 'query_opened',
  QUERY_ANSWERED: 'query_answered',
  QUERY_RESOLVED: 'query_resolved',
  QUERY_CANCELLED: 'query_cancelled',
  QUERY_REASSIGNED: 'query_reassigned',
  REVIEW_STARTED: 'review_started',
  REVIEW_COMPLETED: 'review_completed',
} as const

export type QueryEventType = (typeof QUERY_EVENT_TYPE)[keyof typeof QUERY_EVENT_TYPE]

export type VisitSnapshotReviewRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  snapshotId: string
  visitInstanceId: string
  reviewType: ReviewType
  reviewStatus: ReviewStatus
  reviewerRole: string | null
  reviewerUserId: string | null
  startedAt: string | null
  completedAt: string | null
  completedBy: string | null
  reviewNotes: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type VisitSnapshotQueryRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  snapshotId: string
  reviewId: string | null
  queryScope: QueryScope
  procedureInstanceId: string | null
  procedureCode: string | null
  fieldId: string | null
  fieldLabel: string | null
  queryText: string
  queryStatus: QueryStatus
  priority: QueryPriority
  assignedRole: string | null
  assignedUserId: string | null
  openedBy: string
  openedAt: string
  resolvedBy: string | null
  resolvedAt: string | null
  resolutionText: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VisitSnapshotQueryEventRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  snapshotId: string
  queryId: string
  eventType: QueryEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  stateHash: string
  metadata: Record<string, unknown>
}

export type CreateSnapshotReviewInput = {
  organization_id: string
  study_id: string
  subject_id: string
  snapshot_id: string
  review_type?: ReviewType
  reviewer_role?: string | null
}

export type OpenSnapshotQueryInput = {
  organization_id: string
  study_id: string
  subject_id: string
  snapshot_id: string
  review_id?: string | null
  query_scope: QueryScope
  procedure_instance_id?: string | null
  procedure_code?: string | null
  field_id?: string | null
  field_label?: string | null
  query_text: string
  priority?: QueryPriority
  assigned_role?: string | null
  assigned_user_id?: string | null
}

export type LoadedSnapshotReviewWorkspace = {
  snapshot: import('@/lib/visit-runtime-locking/visit-locking-types').VisitRuntimeSnapshotRow
  review: VisitSnapshotReviewRow | null
  queries: VisitSnapshotQueryRow[]
  events: VisitSnapshotQueryEventRow[]
}

export type QueryStateSnapshot = {
  query_id: string
  query_status: QueryStatus
  priority: QueryPriority
  answer_text: string | null
  resolution_text: string | null
}

export function mapVisitSnapshotReviewRow(row: Record<string, unknown>): VisitSnapshotReviewRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    snapshotId: String(row.snapshot_id),
    visitInstanceId: String(row.visit_instance_id),
    reviewType: row.review_type as ReviewType,
    reviewStatus: row.review_status as ReviewStatus,
    reviewerRole: row.reviewer_role ? String(row.reviewer_role) : null,
    reviewerUserId: row.reviewer_user_id ? String(row.reviewer_user_id) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    reviewNotes: row.review_notes ? String(row.review_notes) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapVisitSnapshotQueryRow(row: Record<string, unknown>): VisitSnapshotQueryRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    snapshotId: String(row.snapshot_id),
    reviewId: row.review_id ? String(row.review_id) : null,
    queryScope: row.query_scope as QueryScope,
    procedureInstanceId: row.procedure_instance_id ? String(row.procedure_instance_id) : null,
    procedureCode: row.procedure_code ? String(row.procedure_code) : null,
    fieldId: row.field_id ? String(row.field_id) : null,
    fieldLabel: row.field_label ? String(row.field_label) : null,
    queryText: String(row.query_text),
    queryStatus: row.query_status as QueryStatus,
    priority: row.priority as QueryPriority,
    assignedRole: row.assigned_role ? String(row.assigned_role) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    openedBy: String(row.opened_by),
    openedAt: String(row.opened_at),
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolutionText: row.resolution_text ? String(row.resolution_text) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapVisitSnapshotQueryEventRow(
  row: Record<string, unknown>,
): VisitSnapshotQueryEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    snapshotId: String(row.snapshot_id),
    queryId: String(row.query_id),
    eventType: row.event_type as QueryEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload as Record<string, unknown>) ?? {},
    stateHash: String(row.state_hash),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export const UNRESOLVED_QUERY_STATUSES: QueryStatus[] = [QUERY_STATUS.OPEN, QUERY_STATUS.ANSWERED]
