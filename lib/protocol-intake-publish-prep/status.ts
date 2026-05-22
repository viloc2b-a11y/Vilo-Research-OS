import { existsSync } from 'node:fs'
import { loadPublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/approval'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import { hasApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import { runPreflightForDraftKey } from '@/lib/protocol-intake-publish-prep/preflight'
import { publishCandidateApprovalPath, publishCandidatePath } from '@/lib/protocol-intake-publish-prep/paths'
import { loadPublishCandidate } from '@/lib/protocol-intake-publish-prep/write-artifacts'
import type {
  FinalReviewResult,
  PublishPrepStatus,
  PreflightResult,
} from '@/lib/protocol-intake-publish-prep/types'

export type PublishPrepState = {
  status: PublishPrepStatus
  preflight: PreflightResult | null
  final_review: FinalReviewResult | null
  has_candidate: boolean
  has_approval: boolean
}

export function resolvePublishPrepStatus(draftKey: string, cwd = process.cwd()): PublishPrepState {
  const hasCandidate = existsSync(publishCandidatePath(draftKey, cwd))
  const hasApproval = existsSync(publishCandidateApprovalPath(draftKey, cwd))

  if (hasCandidate) {
    const candidate = loadPublishCandidate(draftKey, cwd)
    const finalReview = candidate ? runFinalReviewChecks(candidate, cwd) : null
    const preflight = runPreflightForDraftKey(draftKey, cwd)

    if (hasApproval || loadPublishCandidateApproval(draftKey, cwd)) {
      return {
        status: 'candidate_approved',
        preflight,
        final_review: finalReview,
        has_candidate: true,
        has_approval: true,
      }
    }

    if (finalReview && !finalReview.passed) {
      return {
        status: 'candidate_blocked',
        preflight,
        final_review: finalReview,
        has_candidate: true,
        has_approval: false,
      }
    }

    return {
      status: 'candidate_pending_review',
      preflight,
      final_review: finalReview,
      has_candidate: true,
      has_approval: false,
    }
  }

  if (!hasApprovedIntakeDraft(draftKey, cwd)) {
    return {
      status: 'not_ready',
      preflight: null,
      final_review: null,
      has_candidate: false,
      has_approval: false,
    }
  }

  const preflight = runPreflightForDraftKey(draftKey, cwd)
  if (!preflight?.passed) {
    return {
      status: 'blocked',
      preflight,
      final_review: null,
      has_candidate: false,
      has_approval: false,
    }
  }

  return {
    status: 'ready_for_candidate',
    preflight,
    final_review: null,
    has_candidate: false,
    has_approval: false,
  }
}
