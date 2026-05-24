/**
 * Phase 16A-2.6 — Source field integrity (hash snapshots + verification).
 */

export {
  SOURCE_SNAPSHOT_TYPE,
  SOURCE_SNAPSHOT_TYPES,
  isSourceSnapshotType,
  SOURCE_SNAPSHOT_VERIFY_RESULT,
  SOURCE_SNAPSHOT_VERIFY_RESULTS,
} from '@/lib/source/integrity/types'

export type {
  SourceSnapshotType,
  SourceSnapshotVerifyResult,
  SourceFieldValueSlots,
  CaptureSourceSnapshotScope,
  FieldSnapshotVerifyRow,
  VerifySourceSnapshotOutcome,
} from '@/lib/source/integrity/types'

export { canonicalSerialize } from '@/lib/source/integrity/canonical-serialize'
export type { CanonicalSerializeOptions } from '@/lib/source/integrity/canonical-serialize'

export { allocateSnapshotVersion } from '@/lib/source/integrity/allocate-snapshot-version'

export {
  hashFieldValue,
  normalizeSourceFieldValueForHash,
  sourceFieldValueHasContent,
} from '@/lib/source/integrity/hash-field-value'

export {
  captureSourceSnapshot,
  captureSourceSnapshotBestEffort,
  verifySourceSnapshotBestEffort,
} from '@/lib/source/integrity/capture-snapshot'

export type { CaptureSourceSnapshotResult } from '@/lib/source/integrity/capture-snapshot'

export { verifySourceSnapshot } from '@/lib/source/integrity/verify-snapshot'
