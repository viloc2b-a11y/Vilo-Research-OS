/**
 * Phase 12E — Controlled publish preparation (no runtime activation).
 */
import type { ApprovedIntakeDraft } from '@/lib/protocol-intake-review/approve'

export const PUBLISH_PREP_SAFETY = {
  auto_publish: false,
  auto_bind: false,
  runtime_mutation: false,
  requires_explicit_publish_action: true,
} as const

export const OPERATIONAL_SECTIONS = [
  'study_metadata',
  'visits',
  'procedures',
  'source_composition',
  'eligibility',
] as const

export type PublishPrepStatus =
  | 'not_ready'
  | 'ready_for_candidate'
  | 'candidate_created'
  | 'candidate_pending_review'
  | 'candidate_approved'
  | 'candidate_blocked'
  | 'snapshot_ready'
  | 'snapshot_created'
  | 'snapshot_blocked'
  | 'blocked'

export type PreflightCheckStatus = 'pass' | 'fail' | 'warn'

export type PreflightCheck = {
  id: string
  label: string
  status: PreflightCheckStatus
  blocker: boolean
  detail?: string
}

export type PreflightResult = {
  passed: boolean
  blockers: string[]
  warnings: string[]
  checks: PreflightCheck[]
}

export type PublishCandidate = {
  candidate_version: '12E.1.0'
  draft_key: string
  created_at: string
  created_by?: string
  status: 'candidate_created'
  publish_ready: false
  runtime_activation: false
  safety: typeof PUBLISH_PREP_SAFETY
  source: {
    approved_draft_path: string
    review_audit_path: string
    manifest_reference: ApprovedIntakeDraft['manifest_reference']
    approved_at: string
    approved_by?: string
  }
  preflight_snapshot: PreflightResult
  approval_summary: ApprovedIntakeDraft['approval_summary']
  study_metadata: Record<string, unknown>
  eligibility: ApprovedIntakeDraft['eligibility']
  visits: unknown[]
  procedures: unknown[]
  source_composition: unknown[]
  rejected_items: unknown[]
  edit_history_ref: {
    audit_path: string
    entry_count: number
  }
}

export type PublishCandidateAuditEvent =
  | {
      event: 'publish_candidate_created'
      draft_key: string
      timestamp: string
      actor_id?: string
      preflight_passed: boolean
      candidate_version: '12E.1.0'
    }
  | {
      event: 'publish_candidate_approved'
      draft_key: string
      timestamp: string
      actor_id?: string
      approval_reason: string
      candidate_version: '12E.1.0'
      approval_version: '12E-B.1.0'
    }

export type FinalReviewCheck = {
  id: string
  label: string
  status: PreflightCheckStatus
  blocker: boolean
  detail?: string
}

export type FinalReviewResult = {
  passed: boolean
  blockers: string[]
  checks: FinalReviewCheck[]
}

export type PublishCandidateApproval = {
  approval_version: '12E-B.1.0'
  draft_key: string
  approved_at: string
  approved_by?: string
  approval_reason: string
  publish_ready: false
  runtime_activation: false
  safety: typeof PUBLISH_PREP_SAFETY
  candidate_reference: {
    candidate_path: string
    candidate_created_at: string
    candidate_created_by?: string
  }
  final_review_snapshot: FinalReviewResult
}

export type SnapshotReadinessCheck = {
  id: string
  label: string
  status: PreflightCheckStatus
  blocker: boolean
  detail?: string
}

export type SnapshotReadinessResult = {
  passed: boolean
  blockers: string[]
  checks: SnapshotReadinessCheck[]
}

export type SourcePackageSnapshotPayload = {
  snapshot_version: '12E-C.1.0'
  snapshot_id: string
  draft_key: string
  immutable: true
  runtime_activation: false
  safety: typeof PUBLISH_PREP_SAFETY
  snapshot_created_at: string
  snapshot_created_by?: string
  candidate_reference: PublishCandidateApproval['candidate_reference'] & {
    candidate_path: string
  }
  approval_reference: {
    approval_path: string
    approved_at: string
    approved_by?: string
    approval_reason: string
  }
  approval_summary: PublishCandidate['approval_summary']
  study_metadata: PublishCandidate['study_metadata']
  eligibility: PublishCandidate['eligibility']
  visits: PublishCandidate['visits']
  procedures: PublishCandidate['procedures']
  source_composition: PublishCandidate['source_composition']
  rejected_items: PublishCandidate['rejected_items']
  edit_history_summary: PublishCandidate['edit_history_ref']
  review_audit_reference: { audit_path: string }
  publish_candidate_audit_reference: {
    audit_path: string
    event_count: number
  }
}

export type SourcePackageSnapshot = SourcePackageSnapshotPayload & {
  content_checksum: string
}

export type SourcePackageSnapshotAuditEvent = {
  event: 'source_package_snapshot_created'
  draft_key: string
  snapshot_id: string
  timestamp: string
  actor_id?: string
  content_checksum: string
  snapshot_version: '12E-C.1.0'
}
