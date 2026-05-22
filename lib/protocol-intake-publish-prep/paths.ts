import { join } from 'node:path'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'

export function publishCandidateDir(draftKey: string, cwd = process.cwd()): string {
  return join(/*turbopackIgnore: true*/ cwd, 'data', 'source-publish-candidates', draftKey)
}

export function publishCandidatePath(draftKey: string, cwd = process.cwd()): string {
  return join(publishCandidateDir(draftKey, cwd), 'publish_candidate.json')
}

export function publishCandidateAuditPath(draftKey: string, cwd = process.cwd()): string {
  return join(publishCandidateDir(draftKey, cwd), 'publish_candidate_audit.json')
}

export function publishCandidateApprovalPath(draftKey: string, cwd = process.cwd()): string {
  return join(publishCandidateDir(draftKey, cwd), 'publish_candidate_approval.json')
}

export function approvedDraftPath(draftKey: string, cwd = process.cwd()): string {
  return join(workspaceDir(cwd, draftKey), 'approved_intake_draft.json')
}

export function reviewAuditPath(draftKey: string, cwd = process.cwd()): string {
  return join(workspaceDir(cwd, draftKey), 'review_audit.json')
}

export function sourcePublishSnapshotDir(draftKey: string, cwd = process.cwd()): string {
  return join(/*turbopackIgnore: true*/ cwd, 'data', 'source-publish-snapshots', draftKey)
}

export function sourcePackageSnapshotPath(draftKey: string, cwd = process.cwd()): string {
  return join(sourcePublishSnapshotDir(draftKey, cwd), 'source_package_snapshot.json')
}

export function sourcePackageSnapshotAuditPath(draftKey: string, cwd = process.cwd()): string {
  return join(sourcePublishSnapshotDir(draftKey, cwd), 'source_package_snapshot_audit.json')
}
