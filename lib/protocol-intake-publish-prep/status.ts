import { existsSync } from 'node:fs'
import { loadPublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/approval'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import { hasApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import { runPreflightForDraftKey } from '@/lib/protocol-intake-publish-prep/preflight'
import { publishCandidateApprovalPath, publishCandidatePath, sourcePackageSnapshotPath } from '@/lib/protocol-intake-publish-prep/paths'
import { runSnapshotReadiness } from '@/lib/protocol-intake-publish-prep/snapshot-readiness'
import { loadSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/write-snapshot'
import { loadPublishCandidate } from '@/lib/protocol-intake-publish-prep/write-artifacts'
import type {
  FinalReviewResult,
  PublishPrepStatus,
  PreflightResult,
  SnapshotReadinessResult,
} from '@/lib/protocol-intake-publish-prep/types'

export type PublishPrepState = {
  status: PublishPrepStatus
  preflight: PreflightResult | null
  final_review: FinalReviewResult | null
  snapshot_readiness: SnapshotReadinessResult | null
  has_candidate: boolean
  has_approval: boolean
  has_snapshot: boolean
}

export function resolvePublishPrepStatus(draftKey: string, cwd = process.cwd()): PublishPrepState {
  const hasCandidate = existsSync(publishCandidatePath(draftKey, cwd))
  const hasApproval = existsSync(publishCandidateApprovalPath(draftKey, cwd))
  const hasSnapshot = existsSync(sourcePackageSnapshotPath(draftKey, cwd))

  if (hasCandidate) {
    const candidate = loadPublishCandidate(draftKey, cwd)
    const approval = loadPublishCandidateApproval(draftKey, cwd)
    const finalReview = candidate ? runFinalReviewChecks(candidate, cwd) : null
    const preflight = runPreflightForDraftKey(draftKey, cwd)
    const snapshotReadiness =
      candidate && approval
        ? runSnapshotReadiness(draftKey, candidate, approval, cwd)
        : null

    if ((hasApproval || approval) && (hasSnapshot || loadSourcePackageSnapshot(draftKey, cwd))) {
      return {
        status: 'snapshot_created',
        preflight,
        final_review: finalReview,
        snapshot_readiness: snapshotReadiness,
        has_candidate: true,
        has_approval: true,
        has_snapshot: true,
      }
    }

    if (hasApproval || approval) {
      if (snapshotReadiness && !snapshotReadiness.passed) {
        return {
          status: 'snapshot_blocked',
          preflight,
          final_review: finalReview,
          snapshot_readiness: snapshotReadiness,
          has_candidate: true,
          has_approval: true,
          has_snapshot: false,
        }
      }
      return {
        status: 'snapshot_ready',
        preflight,
        final_review: finalReview,
        snapshot_readiness: snapshotReadiness,
        has_candidate: true,
        has_approval: true,
        has_snapshot: false,
      }
    }

    if (finalReview && !finalReview.passed) {
      return {
        status: 'candidate_blocked',
        preflight,
        final_review: finalReview,
        snapshot_readiness: null,
        has_candidate: true,
        has_approval: false,
        has_snapshot: false,
      }
    }

    return {
      status: 'candidate_pending_review',
      preflight,
      final_review: finalReview,
      snapshot_readiness: null,
      has_candidate: true,
      has_approval: false,
      has_snapshot: false,
    }
  }

  if (!hasApprovedIntakeDraft(draftKey, cwd)) {
    return {
      status: 'not_ready',
      preflight: null,
      final_review: null,
      snapshot_readiness: null,
      has_candidate: false,
      has_approval: false,
      has_snapshot: false,
    }
  }

  const preflight = runPreflightForDraftKey(draftKey, cwd)
  if (!preflight?.passed) {
    return {
      status: 'blocked',
      preflight,
      final_review: null,
      snapshot_readiness: null,
      has_candidate: false,
      has_approval: false,
      has_snapshot: false,
    }
  }

  return {
    status: 'ready_for_candidate',
    preflight,
    final_review: null,
    snapshot_readiness: null,
    has_candidate: false,
    has_approval: false,
    has_snapshot: false,
  }
}
