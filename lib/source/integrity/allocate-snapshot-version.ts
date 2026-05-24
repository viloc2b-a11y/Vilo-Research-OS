/**
 * Atomic snapshot_version allocation via DB RPC (transactional MAX+1).
 */

import type { SourceSnapshotType } from '@/lib/source/integrity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Each unlock/relock cycle intentionally produces a new immutable snapshot version for audit continuity.
 * Backed by allocate_source_field_snapshot_version() (advisory lock + SELECT MAX + 1 in one transaction).
 */
export async function allocateSnapshotVersion(
  supabase: SupabaseClient,
  input: {
    sourceResponseId: string
    fieldKey: string
    snapshotType: SourceSnapshotType
  },
): Promise<number> {
  const { data, error } = await supabase.rpc('allocate_source_field_snapshot_version', {
    p_source_response_id: input.sourceResponseId,
    p_field_key: input.fieldKey,
    p_snapshot_type: input.snapshotType,
  })

  if (error) {
    throw new Error(`allocateSnapshotVersion failed: ${error.message}`)
  }

  const version = typeof data === 'number' ? data : Number(data)
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`allocateSnapshotVersion returned invalid version: ${String(data)}`)
  }

  return version
}
