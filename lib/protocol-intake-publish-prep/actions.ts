'use server'

import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { loadApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import { buildPublishCandidate } from '@/lib/protocol-intake-publish-prep/build-candidate'
import { runPublishPreflight } from '@/lib/protocol-intake-publish-prep/preflight'
import {
  buildPublishCandidateApproval,
  loadPublishCandidateApproval,
} from '@/lib/protocol-intake-publish-prep/approval'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import {
  loadPublishCandidate,
  writePublishCandidateApproval,
  writePublishCandidateArtifacts,
} from '@/lib/protocol-intake-publish-prep/write-artifacts'
import type { PublishCandidateAuditEvent } from '@/lib/protocol-intake-publish-prep/types'
import {
  canManageSourceDocuments,
  canPrepareSourceDrafts,
} from '@/lib/rbac/permissions'

async function requirePublishPrepActor() {
  const user = await getSessionUser()
  if (!user) throw new Error('Sign in required')
  const organizationId = await getPrimaryOrganizationId(user.id)
  const memberships = await getOrganizationMemberships(user.id)
  const canAct =
    canPrepareSourceDrafts(memberships, organizationId ?? undefined)
    || canManageSourceDocuments(memberships, organizationId ?? undefined)
  if (!canAct) throw new Error('Your role cannot prepare publish candidates')
  return user
}

export async function createPublishCandidateAction(draftKey: string) {
  const user = await requirePublishPrepActor()
  const handoff = loadApprovedIntakeDraft(draftKey)
  if (!handoff) {
    throw new Error('Approved intake draft not found. Complete 12D review first.')
  }

  const preflight = runPublishPreflight(handoff)
  if (!preflight.passed) {
    throw new Error(
      `Preflight blocked publish candidate: ${preflight.blockers.join('; ')}`,
    )
  }

  const candidate = buildPublishCandidate(handoff, preflight, user.id)
  const auditEvent: PublishCandidateAuditEvent = {
    event: 'publish_candidate_created',
    draft_key: draftKey,
    timestamp: candidate.created_at,
    actor_id: user.id,
    preflight_passed: true,
    candidate_version: '12E.1.0',
  }
  writePublishCandidateArtifacts(candidate, auditEvent)
  return { ok: true, created_at: candidate.created_at }
}

export async function approvePublishCandidateAction(input: {
  draft_key: string
  approval_reason: string
}) {
  const user = await requirePublishPrepActor()
  const reason = input.approval_reason?.trim()
  if (!reason) {
    throw new Error('Approval reason is required')
  }

  const candidate = loadPublishCandidate(input.draft_key)
  if (!candidate) {
    throw new Error('Publish candidate not found. Create a publish candidate first.')
  }

  if (loadPublishCandidateApproval(input.draft_key)) {
    throw new Error('Publish candidate is already approved')
  }

  const finalReview = runFinalReviewChecks(candidate)
  if (!finalReview.passed) {
    throw new Error(
      `Final review blocked approval: ${finalReview.blockers.join('; ')}`,
    )
  }

  const approval = buildPublishCandidateApproval(
    candidate,
    finalReview,
    reason,
    user.id,
  )
  const auditEvent: PublishCandidateAuditEvent = {
    event: 'publish_candidate_approved',
    draft_key: input.draft_key,
    timestamp: approval.approved_at,
    actor_id: user.id,
    approval_reason: reason,
    candidate_version: '12E.1.0',
    approval_version: '12E-B.1.0',
  }
  writePublishCandidateApproval(approval, auditEvent)
  return { ok: true, approved_at: approval.approved_at }
}
