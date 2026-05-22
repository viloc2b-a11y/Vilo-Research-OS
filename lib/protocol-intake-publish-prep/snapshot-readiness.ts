import { existsSync, readFileSync } from 'node:fs'
import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'
import type { PublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/types'
import type {
  SnapshotReadinessCheck,
  SnapshotReadinessResult,
} from '@/lib/protocol-intake-publish-prep/types'
import {
  publishCandidateApprovalPath,
  publishCandidateAuditPath,
  publishCandidatePath,
  sourcePackageSnapshotPath,
} from '@/lib/protocol-intake-publish-prep/paths'

function check(
  id: string,
  label: string,
  ok: boolean,
  detail?: string,
): SnapshotReadinessCheck {
  return {
    id,
    label,
    status: ok ? 'pass' : 'fail',
    blocker: !ok,
    detail,
  }
}

export function runSnapshotReadiness(
  draftKey: string,
  candidate: PublishCandidate | null,
  approval: PublishCandidateApproval | null,
  cwd = process.cwd(),
): SnapshotReadinessResult {
  const checks: SnapshotReadinessCheck[] = []

  checks.push(
    check(
      'publish_candidate_exists',
      'Publish candidate exists',
      Boolean(candidate) && existsSync(publishCandidatePath(draftKey, cwd)),
    ),
    check(
      'approval_exists',
      'Publish candidate approval exists',
      Boolean(approval) && existsSync(publishCandidateApprovalPath(draftKey, cwd)),
    ),
    check(
      'approval_reason',
      'Approval reason recorded',
      Boolean(approval?.approval_reason?.trim()),
      approval?.approval_reason?.trim() ? undefined : 'approval_reason required',
    ),
  )

  if (candidate) {
    checks.push(
      check('candidate_publish_ready', 'Candidate publish_ready is false', candidate.publish_ready === false),
      check(
        'candidate_runtime_activation',
        'Candidate runtime_activation is false',
        candidate.runtime_activation === false,
      ),
      check('candidate_auto_publish', 'Candidate auto_publish is false', candidate.safety.auto_publish === false),
      check('candidate_auto_bind', 'Candidate auto_bind is false', candidate.safety.auto_bind === false),
      check(
        'candidate_runtime_mutation',
        'Candidate runtime_mutation is false',
        candidate.safety.runtime_mutation === false,
      ),
    )
  }

  if (approval) {
    checks.push(
      check('approval_publish_ready', 'Approval publish_ready is false', approval.publish_ready === false),
      check(
        'approval_runtime_activation',
        'Approval runtime_activation is false',
        approval.runtime_activation === false,
      ),
      check('approval_auto_publish', 'Approval auto_publish is false', approval.safety.auto_publish === false),
      check('approval_auto_bind', 'Approval auto_bind is false', approval.safety.auto_bind === false),
      check(
        'approval_runtime_mutation',
        'Approval runtime_mutation is false',
        approval.safety.runtime_mutation === false,
      ),
    )
  }

  const snapshotExists = existsSync(sourcePackageSnapshotPath(draftKey, cwd))
  checks.push(
    check(
      'snapshot_not_duplicate',
      'No existing snapshot (immutable one-time create)',
      !snapshotExists,
      snapshotExists ? 'source_package_snapshot.json already exists' : undefined,
    ),
  )

  const blockers = checks.filter((c) => c.blocker).map((c) =>
    c.detail ? `${c.label}: ${c.detail}` : c.label,
  )

  return { passed: blockers.length === 0, blockers, checks }
}

export function publishCandidateAuditEventCount(draftKey: string, cwd = process.cwd()): number {
  const path = publishCandidateAuditPath(draftKey, cwd)
  if (!existsSync(path)) return 0
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}
