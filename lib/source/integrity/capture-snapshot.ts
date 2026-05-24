/**
 * Explicit runtime capture of source field hash snapshots (best-effort; never blocks submit/sign).
 *
 * Each unlock/relock cycle intentionally produces a new immutable snapshot version for audit continuity.
 */

import {
  observeSourceFieldSnapshotCaptured,
  observeSourceIntegrityViolationDetected,
} from '@/lib/observability/hooks/observe-audit-integrity'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { safeObserve } from '@/lib/observability/safe-observe'
import { allocateSnapshotVersion } from '@/lib/source/integrity/allocate-snapshot-version'
import {
  hashFieldValue,
  sourceFieldValueHasContent,
} from '@/lib/source/integrity/hash-field-value'
import type {
  CaptureSourceSnapshotScope,
  SourceFieldValueSlots,
  SourceSnapshotType,
} from '@/lib/source/integrity/types'
import { verifySourceSnapshot } from '@/lib/source/integrity/verify-snapshot'
import { redactTelemetryMetadata } from '@/lib/observability/redact-telemetry-metadata'
import type { SupabaseClient } from '@supabase/supabase-js'

type ResponseRow = {
  id: string
  source_field_id: string
  value_type: string | null
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: unknown | null
  source_fields: { field_key: string } | { field_key: string }[] | null
}

async function loadCurrentResponseRows(
  supabase: SupabaseClient,
  sourceResponseSetId: string,
  organizationId: string,
): Promise<Array<{ sourceResponseId: string; fieldKey: string; slots: SourceFieldValueSlots }>> {
  const { data, error } = await supabase
    .from('source_responses')
    .select(
      `
      id,
      source_field_id,
      value_type,
      value_text,
      value_number,
      value_boolean,
      value_date,
      value_datetime,
      value_json,
      source_fields!inner(field_key)
    `,
    )
    .eq('response_set_id', sourceResponseSetId)
    .eq('organization_id', organizationId)
    .eq('is_current', true)

  if (error) {
    throw new Error(`loadCurrentResponseRows failed: ${error.message}`)
  }

  const rows: Array<{ sourceResponseId: string; fieldKey: string; slots: SourceFieldValueSlots }> = []

  for (const row of (data ?? []) as ResponseRow[]) {
    const fieldRef = row.source_fields
    const fieldKey = Array.isArray(fieldRef) ? fieldRef[0]?.field_key : fieldRef?.field_key
    if (!fieldKey) continue

    const slots: SourceFieldValueSlots = {
      valueType: row.value_type,
      valueText: row.value_text,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
      valueDate: row.value_date,
      valueDatetime: row.value_datetime,
      valueJson: row.value_json,
    }

    if (!sourceFieldValueHasContent(slots)) continue

    rows.push({ sourceResponseId: row.id, fieldKey, slots })
  }

  return rows
}

export type CaptureSourceSnapshotResult = {
  capturedCount: number
  skippedCount: number
  snapshotIds: string[]
}

export function captureSourceSnapshotBestEffort(input: {
  scope: CaptureSourceSnapshotScope
  snapshotType: SourceSnapshotType
}): void {
  safeObserve(`capture-source-snapshot-${input.snapshotType}`, async () => {
    const result = await captureSourceSnapshot(input)
    if (result.capturedCount > 0) {
      observeSourceFieldSnapshotCaptured({
        supabase: input.scope.supabase,
        organizationId: input.scope.organizationId,
        studyId: input.scope.studyId,
        sourceResponseSetId: input.scope.sourceResponseSetId,
        snapshotType: input.snapshotType,
        capturedCount: result.capturedCount,
        visitId: input.scope.visitId ?? null,
        procedureExecutionId: input.scope.procedureExecutionId ?? null,
        actorUserId: input.scope.actorUserId,
      })
    }
  })
}

export async function captureSourceSnapshot(input: {
  scope: CaptureSourceSnapshotScope
  snapshotType: SourceSnapshotType
}): Promise<CaptureSourceSnapshotResult> {
  const { scope, snapshotType } = input
  const rows = await loadCurrentResponseRows(
    scope.supabase,
    scope.sourceResponseSetId,
    scope.organizationId,
  )

  if (rows.length === 0) {
    return { capturedCount: 0, skippedCount: 0, snapshotIds: [] }
  }

  const capturedAt = new Date().toISOString()
  const snapshotIds: string[] = []

  let operationalEventId: string | null = null
  try {
    operationalEventId = await emitClinicalOperationalEvent({
      supabase: scope.supabase as never,
      organizationId: scope.organizationId,
      studyId: scope.studyId,
      visitId: scope.visitId ?? null,
      procedureExecutionId: scope.procedureExecutionId ?? null,
      actorUserId: scope.actorUserId,
      eventType: OPERATIONAL_EVENT_TYPES.SOURCE_FIELD_SNAPSHOT_CAPTURED,
      payloadSource: 'source-integrity',
      mutation: 'source_integrity.capture_snapshot',
      details: {
        source_response_set_id: scope.sourceResponseSetId,
        snapshot_type: snapshotType,
        field_count: rows.length,
      },
    })
  } catch {
    operationalEventId = null
  }

  for (const row of rows) {
    try {
      const fieldValueHash = hashFieldValue(row.slots)
      const snapshotVersion = await allocateSnapshotVersion(scope.supabase, {
        sourceResponseId: row.sourceResponseId,
        fieldKey: row.fieldKey,
        snapshotType,
      })
      const metadata = redactTelemetryMetadata({
        snapshot_type: snapshotType,
        field_count_batch: rows.length,
        snapshot_version: snapshotVersion,
      })

      const { data, error } = await scope.supabase
        .from('source_response_field_snapshots')
        .insert({
          organization_id: scope.organizationId,
          study_id: scope.studyId,
          study_subject_id: scope.studySubjectId ?? null,
          visit_id: scope.visitId ?? null,
          procedure_execution_id: scope.procedureExecutionId ?? null,
          source_response_set_id: scope.sourceResponseSetId,
          source_response_id: row.sourceResponseId,
          field_key: row.fieldKey,
          field_value_hash: fieldValueHash,
          snapshot_type: snapshotType,
          snapshot_version: snapshotVersion,
          captured_by: scope.actorUserId,
          operational_event_id: operationalEventId,
          captured_at: capturedAt,
          metadata,
        })
        .select('id')
        .single()

      if (error) continue
      snapshotIds.push(data.id as string)
    } catch {
      continue
    }
  }

  return {
    capturedCount: snapshotIds.length,
    skippedCount: rows.length - snapshotIds.length,
    snapshotIds,
  }
}

/** Best-effort post-capture verification — emits violation signals only; does not block runtime. */
export function verifySourceSnapshotBestEffort(input: {
  scope: CaptureSourceSnapshotScope
  snapshotType: SourceSnapshotType
}): void {
  safeObserve(`verify-source-snapshot-${input.snapshotType}`, async () => {
    const outcome = await verifySourceSnapshot(input)
    if (outcome.mismatchCount === 0) return

    let operationalEventId: string | null = null
    try {
      operationalEventId = await emitClinicalOperationalEvent({
        supabase: input.scope.supabase as never,
        organizationId: input.scope.organizationId,
        studyId: input.scope.studyId,
        visitId: input.scope.visitId ?? null,
        procedureExecutionId: input.scope.procedureExecutionId ?? null,
        actorUserId: input.scope.actorUserId,
        eventType: OPERATIONAL_EVENT_TYPES.SOURCE_INTEGRITY_VIOLATION_DETECTED,
        payloadSource: 'source-integrity',
        mutation: 'source_integrity.verify_snapshot',
        details: {
          source_response_set_id: input.scope.sourceResponseSetId,
          snapshot_type: input.snapshotType,
          mismatch_count: outcome.mismatchCount,
          missing_count: outcome.missingCount,
        },
      })
    } catch {
      operationalEventId = null
    }

    observeSourceIntegrityViolationDetected({
      supabase: input.scope.supabase,
      organizationId: input.scope.organizationId,
      studyId: input.scope.studyId,
      sourceResponseSetId: input.scope.sourceResponseSetId,
      snapshotType: input.snapshotType,
      mismatchCount: outcome.mismatchCount,
      missingCount: outcome.missingCount,
      operationalEventId,
      visitId: input.scope.visitId ?? null,
      procedureExecutionId: input.scope.procedureExecutionId ?? null,
      actorUserId: input.scope.actorUserId,
    })
  })
}
