/**
 * Phase 16A-2.6 — Source field integrity types.
 */

export const SOURCE_SNAPSHOT_TYPE = {
  SUBMIT: 'submit',
  SIGN: 'sign',
  LOCK: 'lock',
  MONITORING_REVIEW: 'monitoring_review',
} as const

export const SOURCE_SNAPSHOT_TYPES = [
  SOURCE_SNAPSHOT_TYPE.SUBMIT,
  SOURCE_SNAPSHOT_TYPE.SIGN,
  SOURCE_SNAPSHOT_TYPE.LOCK,
  SOURCE_SNAPSHOT_TYPE.MONITORING_REVIEW,
] as const

export type SourceSnapshotType = (typeof SOURCE_SNAPSHOT_TYPES)[number]

export function isSourceSnapshotType(value: string): value is SourceSnapshotType {
  return (SOURCE_SNAPSHOT_TYPES as readonly string[]).includes(value)
}

export const SOURCE_SNAPSHOT_VERIFY_RESULT = {
  MATCH: 'match',
  MISMATCH: 'mismatch',
  MISSING_SNAPSHOT: 'missing_snapshot',
} as const

export const SOURCE_SNAPSHOT_VERIFY_RESULTS = [
  SOURCE_SNAPSHOT_VERIFY_RESULT.MATCH,
  SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH,
  SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT,
] as const

export type SourceSnapshotVerifyResult =
  (typeof SOURCE_SNAPSHOT_VERIFY_RESULTS)[number]

export type SourceFieldValueSlots = {
  valueType?: string | null
  valueText?: string | null
  valueNumber?: number | null
  valueBoolean?: boolean | null
  valueDate?: string | null
  valueDatetime?: string | null
  valueJson?: unknown | null
}

export type CaptureSourceSnapshotScope = {
  supabase: import('@supabase/supabase-js').SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  sourceResponseSetId: string
  actorUserId: string
}

export type FieldSnapshotVerifyRow = {
  sourceResponseId: string
  fieldKey: string
  snapshotType: SourceSnapshotType
  result: SourceSnapshotVerifyResult
  snapshotVersion: number | null
}

export type VerifySourceSnapshotOutcome = {
  overall: SourceSnapshotVerifyResult
  fieldResults: FieldSnapshotVerifyRow[]
  mismatchCount: number
  missingCount: number
}
