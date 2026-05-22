import type { LoadedApprovedHandoff } from '@/lib/protocol-intake-publish-prep/load-approved'
import {
  PUBLISH_PREP_SAFETY,
  type PreflightResult,
  type PublishCandidate,
} from '@/lib/protocol-intake-publish-prep/types'

export function buildPublishCandidate(
  handoff: LoadedApprovedHandoff,
  preflight: PreflightResult,
  createdBy?: string,
): PublishCandidate {
  const { approved, approved_path, audit_path, audit_entry_count } = handoff
  return {
    candidate_version: '12E.1.0',
    draft_key: approved.draft_key,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    status: 'candidate_created',
    publish_ready: false,
    runtime_activation: false,
    safety: PUBLISH_PREP_SAFETY,
    source: {
      approved_draft_path: approved_path,
      review_audit_path: audit_path,
      manifest_reference: approved.manifest_reference,
      approved_at: approved.approved_at,
      approved_by: approved.approved_by,
    },
    preflight_snapshot: preflight,
    approval_summary: approved.approval_summary,
    study_metadata: approved.study_metadata,
    eligibility: approved.eligibility,
    visits: approved.visits,
    procedures: approved.procedures,
    source_composition: approved.source_composition,
    rejected_items: approved.rejected_items,
    edit_history_ref: {
      audit_path,
      entry_count: audit_entry_count,
    },
  }
}
