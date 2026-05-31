export const VISIT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DEFERRED: 'deferred',
} as const

export type VisitStatus = (typeof VISIT_STATUS)[keyof typeof VISIT_STATUS]

export const PROCEDURE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  NOT_APPLICABLE: 'not_applicable',
} as const

export type ProcedureStatus = (typeof PROCEDURE_STATUS)[keyof typeof PROCEDURE_STATUS]

export const VISIT_RUNTIME_EVENT_TYPE = {
  VISIT_INSTANCE_CREATED: 'visit_instance_created',
  VISIT_STARTED: 'visit_started',
  VISIT_COMPLETED: 'visit_completed',
  PROCEDURE_STARTED: 'procedure_started',
  PROCEDURE_COMPLETED: 'procedure_completed',
  PROCEDURE_SKIPPED: 'procedure_skipped',
  FIELD_VALUES_SAVED: 'field_values_saved',
  VISIT_LOCKED: 'visit_locked',
  VISIT_SNAPSHOT_CREATED: 'visit_snapshot_created',
  VISIT_LOCK_ATTEMPT_FAILED: 'visit_lock_attempt_failed',
  IP_ADMINISTRATION_EVENT: 'ip_administration_event',
} as const

export type VisitRuntimeEventType =
  (typeof VISIT_RUNTIME_EVENT_TYPE)[keyof typeof VISIT_RUNTIME_EVENT_TYPE]

export type VisitRuntimeInstanceRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  sourcePublicationId: string | null
  sourcePublicationVersion: number | null
  sourcePackageHash: string | null
  sourcePackageId: string
  visitShellId: string
  runtimeVisitId: string
  visitCode: string
  visitName: string
  visitType: string
  visitStatus: VisitStatus
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  completedBy: string | null
  progressPercent: number
  lockStatus: 'unlocked' | 'locked' | 'voided'
  lockedSnapshotId: string | null
  lockedAt: string | null
  lockedBy: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProcedureRuntimeInstanceRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitInstanceId: string
  sourcePackageId: string
  visitShellId: string
  procedureShellId: string
  procedureId: string
  blueprintVersionId: string
  procedureCode: string
  procedureName: string
  procedureOrder: number
  required: boolean
  procedureStatus: ProcedureStatus
  startedAt: string | null
  completedAt: string | null
  completedBy: string | null
  fieldValues: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VisitRuntimeEventRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitInstanceId: string
  procedureInstanceId: string | null
  eventType: VisitRuntimeEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  stateHash: string
  metadata: Record<string, unknown>
}

export type CreateVisitInstanceInput = {
  organization_id: string
  study_id: string
  subject_id: string
  source_publication_id?: string
  source_package_id?: string
  visit_shell_id: string
}

export type LoadedVisitWorkspace = {
  visitInstance: VisitRuntimeInstanceRow
  procedureInstances: ProcedureRuntimeInstanceRow[]
  events: VisitRuntimeEventRow[]
}

export type VisitRuntimeStateSnapshot = {
  visit_instance_id: string
  visit_status: VisitStatus
  progress_percent: number
  procedures: Array<{
    procedure_instance_id: string
    procedure_status: ProcedureStatus
    field_values: Record<string, unknown>
  }>
}

export function mapVisitRuntimeInstanceRow(row: Record<string, unknown>): VisitRuntimeInstanceRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    sourcePublicationId: row.source_publication_id ? String(row.source_publication_id) : null,
    sourcePublicationVersion:
      typeof row.source_publication_version === 'number'
        ? row.source_publication_version
        : row.source_publication_version
          ? Number(row.source_publication_version)
          : null,
    sourcePackageHash: row.source_package_hash ? String(row.source_package_hash) : null,
    sourcePackageId: String(row.source_package_id),
    visitShellId: String(row.visit_shell_id),
    runtimeVisitId: String(row.runtime_visit_id),
    visitCode: String(row.visit_code),
    visitName: String(row.visit_name),
    visitType: String(row.visit_type),
    visitStatus: row.visit_status as VisitStatus,
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    progressPercent: Number(row.progress_percent),
    lockStatus: (row.lock_status as VisitRuntimeInstanceRow['lockStatus']) ?? 'unlocked',
    lockedSnapshotId: row.locked_snapshot_id ? String(row.locked_snapshot_id) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    lockedBy: row.locked_by ? String(row.locked_by) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapProcedureRuntimeInstanceRow(
  row: Record<string, unknown>,
): ProcedureRuntimeInstanceRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitInstanceId: String(row.visit_instance_id),
    sourcePackageId: String(row.source_package_id),
    visitShellId: String(row.visit_shell_id),
    procedureShellId: String(row.procedure_shell_id),
    procedureId: String(row.procedure_id),
    blueprintVersionId: String(row.blueprint_version_id),
    procedureCode: String(row.procedure_code),
    procedureName: String(row.procedure_name),
    procedureOrder: Number(row.procedure_order),
    required: Boolean(row.required),
    procedureStatus: row.procedure_status as ProcedureStatus,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    fieldValues: (row.field_values as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapVisitRuntimeEventRow(row: Record<string, unknown>): VisitRuntimeEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitInstanceId: String(row.visit_instance_id),
    procedureInstanceId: row.procedure_instance_id ? String(row.procedure_instance_id) : null,
    eventType: row.event_type as VisitRuntimeEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload as Record<string, unknown>) ?? {},
    stateHash: String(row.state_hash),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
