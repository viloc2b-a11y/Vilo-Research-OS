import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'
import type { PublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/types'
import type { SourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/types'
import { PUBLISH_PREP_SAFETY } from '@/lib/protocol-intake-publish-prep/types'
import {
  buildSnapshotId,
  snapshotContentChecksum,
} from '@/lib/protocol-intake-publish-prep/snapshot-hash'
import { publishCandidateAuditEventCount } from '@/lib/protocol-intake-publish-prep/snapshot-readiness'
import {
  publishCandidateApprovalPath,
  publishCandidateAuditPath,
  publishCandidatePath,
} from '@/lib/protocol-intake-publish-prep/paths'

export function buildSourcePackageSnapshot(
  candidate: PublishCandidate,
  approval: PublishCandidateApproval,
  createdBy?: string,
  cwd = process.cwd(),
): SourcePackageSnapshot {
  const createdAt = new Date().toISOString()
  const payload = {
    snapshot_version: '12E-C.1.0' as const,
    snapshot_id: buildSnapshotId(candidate.draft_key, createdAt),
    draft_key: candidate.draft_key,
    immutable: true as const,
    runtime_activation: false as const,
    safety: PUBLISH_PREP_SAFETY,
    snapshot_created_at: createdAt,
    snapshot_created_by: createdBy,
    candidate_reference: {
      ...approval.candidate_reference,
      candidate_path: publishCandidatePath(candidate.draft_key, cwd),
    },
    approval_reference: {
      approval_path: publishCandidateApprovalPath(candidate.draft_key, cwd),
      approved_at: approval.approved_at,
      approved_by: approval.approved_by,
      approval_reason: approval.approval_reason,
    },
    approval_summary: candidate.approval_summary,
    study_metadata: candidate.study_metadata,
    eligibility: candidate.eligibility,
    visits: candidate.visits,
    procedures: candidate.procedures,
    source_composition: candidate.source_composition,
    rejected_items: candidate.rejected_items,
    edit_history_summary: candidate.edit_history_ref,
    review_audit_reference: {
      audit_path: candidate.source.review_audit_path,
    },
    publish_candidate_audit_reference: {
      audit_path: publishCandidateAuditPath(candidate.draft_key, cwd),
      event_count: publishCandidateAuditEventCount(candidate.draft_key, cwd),
    },
  }

  const content_checksum = snapshotContentChecksum(payload)
  return { ...payload, content_checksum }
}
