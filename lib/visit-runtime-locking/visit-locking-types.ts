import type { VisitRuntimeEventRow, VisitRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'

export const LOCK_STATUS = {
  UNLOCKED: 'unlocked',
  LOCKED: 'locked',
  VOIDED: 'voided',
} as const

export type LockStatus = (typeof LOCK_STATUS)[keyof typeof LOCK_STATUS]

export const SNAPSHOT_STATUS = {
  LOCKED: 'locked',
  SUPERSEDED: 'superseded',
  VOIDED: 'voided',
} as const

export type SnapshotStatus = (typeof SNAPSHOT_STATUS)[keyof typeof SNAPSHOT_STATUS]

export type VisitSnapshotProcedure = {
  procedure_instance_id: string
  procedure_code: string
  procedure_name: string
  blueprint_version_id: string
  procedure_status: string
  field_values: Record<string, unknown>
  completed_at: string | null
}

export type VisitSnapshotEvent = {
  event_type: string
  event_timestamp: string
  state_hash: string
}

export type VisitSnapshotJson = {
  visit_instance: {
    id: string
    subject_id: string
    visit_code: string
    visit_name: string
    visit_status: string
    progress_percent: number
    started_at: string | null
    completed_at: string | null
  }
  procedures: VisitSnapshotProcedure[]
  events: VisitSnapshotEvent[]
  source_context: {
    source_publication_id: string | null
    source_publication_version: number | null
    source_package_hash: string | null
    source_package_id: string
    visit_shell_id: string
    runtime_visit_id: string
  }
}

export type VisitRuntimeSnapshotRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitInstanceId: string
  sourcePackageId: string
  snapshotStatus: SnapshotStatus
  snapshotJson: VisitSnapshotJson
  snapshotHash: string
  lockedBy: string
  lockedAt: string
  lockReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type LockVisitRuntimeInput = {
  organization_id: string
  visit_instance_id: string
  lock_reason?: string | null
}

export type LockVisitRuntimeResult = {
  snapshot: VisitRuntimeSnapshotRow
  snapshotHash: string
  idempotent: boolean
}

export function mapVisitRuntimeSnapshotRow(row: Record<string, unknown>): VisitRuntimeSnapshotRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitInstanceId: String(row.visit_instance_id),
    sourcePackageId: String(row.source_package_id),
    snapshotStatus: row.snapshot_status as SnapshotStatus,
    snapshotJson: row.snapshot_json as VisitSnapshotJson,
    snapshotHash: String(row.snapshot_hash),
    lockedBy: String(row.locked_by),
    lockedAt: String(row.locked_at),
    lockReason: row.lock_reason ? String(row.lock_reason) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export type VisitInstanceWithLock = VisitRuntimeInstanceRow & {
  lockStatus: LockStatus
  lockedSnapshotId: string | null
  lockedAt: string | null
  lockedBy: string | null
}

export function mapVisitInstanceWithLock(row: Record<string, unknown>): VisitInstanceWithLock {
  const base = {
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
    visitStatus: row.visit_status as VisitRuntimeInstanceRow['visitStatus'],
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    progressPercent: Number(row.progress_percent),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
  return {
    ...base,
    lockStatus: (row.lock_status as LockStatus) ?? LOCK_STATUS.UNLOCKED,
    lockedSnapshotId: row.locked_snapshot_id ? String(row.locked_snapshot_id) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    lockedBy: row.locked_by ? String(row.locked_by) : null,
  }
}

export type BuildVisitSnapshotInput = {
  visitInstance: VisitInstanceWithLock
  procedures: Array<{
    id: string
    procedureCode: string
    procedureName: string
    blueprintVersionId: string
    procedureStatus: string
    fieldValues: Record<string, unknown>
    completedAt: string | null
    procedureOrder: number
  }>
  events: VisitRuntimeEventRow[]
}
