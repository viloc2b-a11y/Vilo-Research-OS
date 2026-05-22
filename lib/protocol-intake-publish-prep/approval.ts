import { existsSync, readFileSync } from 'node:fs'
import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'
import {
  PUBLISH_PREP_SAFETY,
  type FinalReviewResult,
  type PublishCandidateApproval,
} from '@/lib/protocol-intake-publish-prep/types'
import { publishCandidateApprovalPath, publishCandidatePath } from '@/lib/protocol-intake-publish-prep/paths'

export function loadPublishCandidateApproval(
  draftKey: string,
  cwd = process.cwd(),
): PublishCandidateApproval | null {
  const path = publishCandidateApprovalPath(draftKey, cwd)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PublishCandidateApproval
  } catch {
    return null
  }
}

export function buildPublishCandidateApproval(
  candidate: PublishCandidate,
  finalReview: FinalReviewResult,
  approvalReason: string,
  approvedBy?: string,
  cwd = process.cwd(),
): PublishCandidateApproval {
  return {
    approval_version: '12E-B.1.0',
    draft_key: candidate.draft_key,
    approved_at: new Date().toISOString(),
    approved_by: approvedBy,
    approval_reason: approvalReason.trim(),
    publish_ready: false,
    runtime_activation: false,
    safety: PUBLISH_PREP_SAFETY,
    candidate_reference: {
      candidate_path: publishCandidatePath(candidate.draft_key, cwd),
      candidate_created_at: candidate.created_at,
      candidate_created_by: candidate.created_by,
    },
    final_review_snapshot: finalReview,
  }
}
