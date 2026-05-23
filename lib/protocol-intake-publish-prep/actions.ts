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
import { buildSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/build-snapshot'
import { runSnapshotReadiness } from '@/lib/protocol-intake-publish-prep/snapshot-readiness'
import { writeSourcePackageSnapshot, loadSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/write-snapshot'
import type {
  PublishCandidateAuditEvent,
  SourcePackageSnapshotAuditEvent,
} from '@/lib/protocol-intake-publish-prep/types'
import {
  canManageSourceBuilder,
  canPublishSource,
} from '@/lib/rbac/permissions'

async function requirePublishPrepActor() {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required' }
  const organizationId = await getPrimaryOrganizationId(user.id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId ?? undefined)) {
    return { ok: false as const, error: 'Your role cannot prepare publish candidates' }
  }
  return { ok: true as const, user }
}

async function requirePublishAuthority() {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required' }
  const organizationId = await getPrimaryOrganizationId(user.id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!canPublishSource(memberships, organizationId ?? undefined)) {
    return { ok: false as const, error: 'Your role cannot approve publish candidates or create snapshots' }
  }
  return { ok: true as const, user }
}

export async function createPublishCandidateAction(draftKey: string) {
  const auth = await requirePublishPrepActor()
  if (!auth.ok) return auth
  const user = auth.user

  const handoff = loadApprovedIntakeDraft(draftKey)
  if (!handoff) {
    return { ok: false as const, error: 'Approved intake draft not found. Complete 12D review first.' }
  }

  const preflight = runPublishPreflight(handoff)
  if (!preflight.passed) {
    return { ok: false as const, error: `Preflight blocked publish candidate: ${preflight.blockers.join('; ')}` }
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
  const auth = await requirePublishAuthority()
  if (!auth.ok) return auth
  const user = auth.user

  const reason = input.approval_reason?.trim()
  if (!reason) {
    return { ok: false as const, error: 'Approval reason is required' }
  }

  const candidate = loadPublishCandidate(input.draft_key)
  if (!candidate) {
    return { ok: false as const, error: 'Publish candidate not found. Create a publish candidate first.' }
  }

  if (loadPublishCandidateApproval(input.draft_key)) {
    return { ok: false as const, error: 'Publish candidate is already approved' }
  }

  const finalReview = runFinalReviewChecks(candidate)
  if (!finalReview.passed) {
    return { ok: false as const, error: `Final review blocked approval: ${finalReview.blockers.join('; ')}` }
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

export async function createSourcePackageSnapshotAction(draftKey: string) {
  const auth = await requirePublishAuthority()
  if (!auth.ok) return auth
  const user = auth.user

  const candidate = loadPublishCandidate(draftKey)
  if (!candidate) {
    return { ok: false as const, error: 'Publish candidate not found. Create and approve a candidate first.' }
  }

  const approval = loadPublishCandidateApproval(draftKey)
  if (!approval) {
    return { ok: false as const, error: 'Publish candidate approval not found. Approve the candidate first.' }
  }

  if (!approval.approval_reason?.trim()) {
    return { ok: false as const, error: 'Approval reason is required before creating a snapshot' }
  }

  if (loadSourcePackageSnapshot(draftKey)) {
    return { ok: false as const, error: 'Source package snapshot already exists for this draft' }
  }

  const readiness = runSnapshotReadiness(draftKey, candidate, approval)
  if (!readiness.passed) {
    return { ok: false as const, error: `Snapshot readiness blocked: ${readiness.blockers.join('; ')}` }
  }

  const snapshot = buildSourcePackageSnapshot(candidate, approval, user.id)
  const auditEvent: SourcePackageSnapshotAuditEvent = {
    event: 'source_package_snapshot_created',
    draft_key: draftKey,
    snapshot_id: snapshot.snapshot_id,
    timestamp: snapshot.snapshot_created_at,
    actor_id: user.id,
    content_checksum: snapshot.content_checksum,
    snapshot_version: '12E-C.1.0',
  }
  writeSourcePackageSnapshot(snapshot, auditEvent)
  return {
    ok: true,
    snapshot_id: snapshot.snapshot_id,
    content_checksum: snapshot.content_checksum,
  }
}
