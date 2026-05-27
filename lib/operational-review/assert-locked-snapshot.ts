import type { SupabaseClient } from '@supabase/supabase-js'
import { loadVisitSnapshotById } from '@/lib/visit-runtime-locking/load-visit-snapshot'
import { SNAPSHOT_STATUS } from '@/lib/visit-runtime-locking/visit-locking-types'

export async function assertLockedSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  subjectId: string,
  snapshotId: string,
) {
  const snapshot = await loadVisitSnapshotById(supabase, organizationId, snapshotId)
  if (!snapshot) throw new Error('Visit snapshot not found.')
  if (snapshot.organizationId !== organizationId || snapshot.studyId !== studyId) {
    throw new Error('Snapshot does not match organization or study.')
  }
  if (snapshot.subjectId !== subjectId) {
    throw new Error('Snapshot does not match subject.')
  }
  if (snapshot.snapshotStatus !== SNAPSHOT_STATUS.LOCKED) {
    throw new Error('Review can only be created for a locked snapshot.')
  }
  return snapshot
}
