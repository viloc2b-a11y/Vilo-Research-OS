import { existsSync } from 'node:fs'
import { approvedDraftPath, reviewAuditPath } from '@/lib/protocol-intake-publish-prep/paths'
import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'
import type { FinalReviewCheck, FinalReviewResult } from '@/lib/protocol-intake-publish-prep/types'

function check(
  id: string,
  label: string,
  ok: boolean,
  detail?: string,
): FinalReviewCheck {
  return {
    id,
    label,
    status: ok ? 'pass' : 'fail',
    blocker: !ok,
    detail,
  }
}

export function runFinalReviewChecks(
  candidate: PublishCandidate,
  cwd = process.cwd(),
): FinalReviewResult {
  const checks: FinalReviewCheck[] = []
  const draftKey = candidate.draft_key

  checks.push(check('publish_candidate_exists', 'Publish candidate on file', true))

  checks.push(
    check(
      'publish_ready_false',
      'publish_ready is false',
      candidate.publish_ready === false,
    ),
    check(
      'runtime_activation_false',
      'runtime_activation is false',
      candidate.runtime_activation === false,
    ),
    check(
      'auto_publish_false',
      'auto_publish is false',
      candidate.safety.auto_publish === false,
    ),
    check(
      'auto_bind_false',
      'auto_bind is false',
      candidate.safety.auto_bind === false,
    ),
    check(
      'runtime_mutation_false',
      'runtime_mutation is false',
      candidate.safety.runtime_mutation === false,
    ),
  )

  const approvedPath = approvedDraftPath(draftKey, cwd)
  const auditPath = reviewAuditPath(draftKey, cwd)
  checks.push(
    check(
      'approved_draft_reference',
      'Approved draft reference exists',
      existsSync(approvedPath),
      approvedPath,
    ),
    check(
      'audit_reference',
      'Review audit reference exists',
      existsSync(auditPath),
      auditPath,
    ),
  )

  const blockers = checks.filter((c) => c.blocker).map((c) =>
    c.detail ? `${c.label}: ${c.detail}` : c.label,
  )

  return {
    passed: blockers.length === 0,
    blockers,
    checks,
  }
}
