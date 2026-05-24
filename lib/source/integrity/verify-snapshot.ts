/**
 * Recompute field hashes and compare against latest snapshot_version (non-blocking).
 */

import { hashFieldValue, sourceFieldValueHasContent } from '@/lib/source/integrity/hash-field-value'
import type {
  CaptureSourceSnapshotScope,
  FieldSnapshotVerifyRow,
  SourceFieldValueSlots,
  SourceSnapshotType,
  SourceSnapshotVerifyResult,
  VerifySourceSnapshotOutcome,
} from '@/lib/source/integrity/types'
import { SOURCE_SNAPSHOT_VERIFY_RESULT } from '@/lib/source/integrity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type ResponseRow = {
  id: string
  value_type: string | null
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: unknown | null
  source_fields: { field_key: string } | { field_key: string }[] | null
}

type SnapshotRow = {
  source_response_id: string
  field_key: string
  field_value_hash: string
  snapshot_version: number
}

async function loadCurrentRows(
  supabase: SupabaseClient,
  sourceResponseSetId: string,
  organizationId: string,
): Promise<Array<{ sourceResponseId: string; fieldKey: string; slots: SourceFieldValueSlots }>> {
  const { data, error } = await supabase
    .from('source_responses')
    .select(
      `
      id,
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
    throw new Error(`verifySourceSnapshot load responses failed: ${error.message}`)
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

async function loadLatestSnapshots(
  supabase: SupabaseClient,
  sourceResponseSetId: string,
  snapshotType: SourceSnapshotType,
): Promise<Map<string, SnapshotRow>> {
  const { data, error } = await supabase
    .from('source_response_field_snapshots')
    .select('source_response_id, field_key, field_value_hash, snapshot_version')
    .eq('source_response_set_id', sourceResponseSetId)
    .eq('snapshot_type', snapshotType)
    .order('snapshot_version', { ascending: false })

  if (error) {
    throw new Error(`verifySourceSnapshot load snapshots failed: ${error.message}`)
  }

  const latest = new Map<string, SnapshotRow>()
  for (const row of (data ?? []) as SnapshotRow[]) {
    const key = `${row.source_response_id}:${row.field_key}`
    if (!latest.has(key)) {
      latest.set(key, row)
    }
  }
  return latest
}

function resolveOverall(
  fieldResults: FieldSnapshotVerifyRow[],
): SourceSnapshotVerifyResult {
  if (fieldResults.some((r) => r.result === SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH)) {
    return SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH
  }
  if (fieldResults.some((r) => r.result === SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT)) {
    return SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT
  }
  return SOURCE_SNAPSHOT_VERIFY_RESULT.MATCH
}

export async function verifySourceSnapshot(input: {
  scope: CaptureSourceSnapshotScope
  snapshotType: SourceSnapshotType
}): Promise<VerifySourceSnapshotOutcome> {
  const { scope, snapshotType } = input
  const [currentRows, latestSnapshots] = await Promise.all([
    loadCurrentRows(scope.supabase, scope.sourceResponseSetId, scope.organizationId),
    loadLatestSnapshots(scope.supabase, scope.sourceResponseSetId, snapshotType),
  ])

  const fieldResults: FieldSnapshotVerifyRow[] = []

  for (const row of currentRows) {
    const key = `${row.sourceResponseId}:${row.fieldKey}`
    const snapshot = latestSnapshots.get(key)
    if (!snapshot) {
      fieldResults.push({
        sourceResponseId: row.sourceResponseId,
        fieldKey: row.fieldKey,
        snapshotType,
        result: SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT,
        snapshotVersion: null,
      })
      continue
    }

    const recalculated = hashFieldValue(row.slots)
    const result: SourceSnapshotVerifyResult =
      recalculated === snapshot.field_value_hash
        ? SOURCE_SNAPSHOT_VERIFY_RESULT.MATCH
        : SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH

    fieldResults.push({
      sourceResponseId: row.sourceResponseId,
      fieldKey: row.fieldKey,
      snapshotType,
      result,
      snapshotVersion: snapshot.snapshot_version,
    })
  }

  const mismatchCount = fieldResults.filter(
    (r) => r.result === SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH,
  ).length
  const missingCount = fieldResults.filter(
    (r) => r.result === SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT,
  ).length

  return {
    overall: resolveOverall(fieldResults),
    fieldResults,
    mismatchCount,
    missingCount,
  }
}
