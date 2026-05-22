/**
 * Phase 12E-B — publish candidate final review smoke (no browser, no runtime).
 * Run: npx tsx scripts/phase12eb-publish-candidate-review-smoke.ts
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildApprovedDraft, writeApprovedArtifacts } from '@/lib/protocol-intake-review/approve'
import { discoverIntakePackages, loadIntakePackage } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'
import { createInitialWorkspace, saveWorkspace } from '@/lib/protocol-intake-review/workspace'
import {
  buildPublishCandidateApproval,
  loadPublishCandidateApproval,
} from '@/lib/protocol-intake-publish-prep/approval'
import { buildPublishCandidate } from '@/lib/protocol-intake-publish-prep/build-candidate'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import { loadApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import {
  publishCandidateApprovalPath,
  publishCandidateDir,
  publishCandidatePath,
} from '@/lib/protocol-intake-publish-prep/paths'
import { runPublishPreflight } from '@/lib/protocol-intake-publish-prep/preflight'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
import {
  loadPublishCandidate,
  writePublishCandidateApproval,
  writePublishCandidateArtifacts,
} from '@/lib/protocol-intake-publish-prep/write-artifacts'
import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function removeDirIfExists(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

function seedCandidate(root: string, draftKey: string) {
  const pkg = loadIntakePackage(draftKey, root)
  if (!pkg) throw new Error('package missing')

  const wsDir = workspaceDir(root, draftKey)
  removeDirIfExists(wsDir)
  const candidateDir = publishCandidateDir(draftKey, root)
  removeDirIfExists(candidateDir)

  const ws = createInitialWorkspace(pkg)
  for (const item of pkg.items) {
    if (
      item.section === 'study_metadata'
      || item.section === 'visits'
      || item.section === 'procedures'
      || item.section === 'source_composition'
      || item.section === 'eligibility'
    ) {
      ws.items[item.item_id].reviewer_status = 'accepted'
    }
  }
  for (const section of [
    'study_metadata',
    'visits',
    'procedures',
    'source_composition',
    'eligibility',
  ] as const) {
    ws.sections[section].section_status = 'approved'
  }
  saveWorkspace(ws, root)
  const approved = buildApprovedDraft(pkg, ws, 'smoke-reviewer')
  writeApprovedArtifacts(pkg, approved, ws, root)

  const handoff = loadApprovedIntakeDraft(draftKey, root)!
  const preflight = runPublishPreflight(handoff)
  const candidate = buildPublishCandidate(handoff, preflight, 'smoke-reviewer')
  writePublishCandidateArtifacts(candidate, {
    event: 'publish_candidate_created',
    draft_key: draftKey,
    timestamp: candidate.created_at,
    actor_id: 'smoke-reviewer',
    preflight_passed: true,
    candidate_version: '12E.1.0',
  }, root)
  return candidate
}

function tryApprove(
  draftKey: string,
  candidate: PublishCandidate,
  reason: string,
  root: string,
): { ok: boolean; error?: string } {
  if (!reason.trim()) return { ok: false, error: 'Approval reason is required' }
  const finalReview = runFinalReviewChecks(candidate, root)
  if (!finalReview.passed) {
    return { ok: false, error: finalReview.blockers.join('; ') }
  }
  const approval = buildPublishCandidateApproval(
    candidate,
    finalReview,
    reason,
    'smoke-reviewer',
    root,
  )
  writePublishCandidateApproval(approval, {
    event: 'publish_candidate_approved',
    draft_key: draftKey,
    timestamp: approval.approved_at,
    actor_id: 'smoke-reviewer',
    approval_reason: reason,
    candidate_version: '12E.1.0',
    approval_version: '12E-B.1.0',
  }, root)
  return { ok: true }
}

function main() {
  const gates: Gate[] = []
  const root = process.cwd()
  const packages = discoverIntakePackages(root)
  const draftKey =
    packages.find((p) => p.draft_key.includes('para'))?.draft_key ?? packages[0]?.draft_key
  if (!draftKey) process.exit(1)

  const candidateDir = publishCandidateDir(draftKey, root)
  removeDirIfExists(candidateDir)
  const noCandidate = resolvePublishPrepStatus(draftKey, root)
  gates.push(
    gate(
      'no candidate blocks approval path',
      noCandidate.status !== 'candidate_pending_review'
      && !existsSync(publishCandidateApprovalPath(draftKey, root)),
    ),
  )

  const candidate = seedCandidate(root, draftKey)
  const pending = resolvePublishPrepStatus(draftKey, root)
  gates.push(gate('candidate pending review', pending.status === 'candidate_pending_review'))

  const noReason = tryApprove(draftKey, candidate, '   ', root)
  gates.push(gate('missing reason blocks approval', !noReason.ok))

  writeFileSync(
    publishCandidatePath(draftKey, root),
    `${JSON.stringify({
      ...candidate,
      safety: { ...candidate.safety, auto_publish: true },
    }, null, 2)}\n`,
    'utf8',
  )
  const unsafeLoaded = JSON.parse(
    readFileSync(publishCandidatePath(draftKey, root), 'utf8'),
  ) as PublishCandidate
  const unsafeReview = runFinalReviewChecks(unsafeLoaded, root)
  gates.push(gate('failed safety flag blocks approval', !unsafeReview.passed))

  writeFileSync(
    publishCandidatePath(draftKey, root),
    `${JSON.stringify(candidate, null, 2)}\n`,
    'utf8',
  )

  const ok = tryApprove(draftKey, candidate, 'Coordinator final approval for smoke', root)
  gates.push(gate('valid candidate creates approval', ok.ok))

  gates.push(
    gate('approval artifact exists', existsSync(publishCandidateApprovalPath(draftKey, root))),
  )

  const approval = loadPublishCandidateApproval(draftKey, root)
  const approvedStatus = resolvePublishPrepStatus(draftKey, root)
  gates.push(
    gate('status candidate_approved', approvedStatus.status === 'candidate_approved'),
    gate('approval publish_ready false', approval?.publish_ready === false),
    gate('approval runtime_activation false', approval?.runtime_activation === false),
    gate('approval does not auto_publish', approval?.safety.auto_publish === false),
    gate('candidate unchanged publish_ready', loadPublishCandidate(draftKey, root)?.publish_ready === false),
  )

  const audit = JSON.parse(
    readFileSync(join(publishCandidateDir(draftKey, root), 'publish_candidate_audit.json'), 'utf8'),
  ) as Array<{ event: string }>
  gates.push(
    gate(
      'audit has publish_candidate_approved',
      audit.some((e) => e.event === 'publish_candidate_approved'),
    ),
  )

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12E-B-publish-candidate-review-smoke',
        draft_key: draftKey,
        gates,
        summary: { passed: gates.length - failed.length, failed: failed.length },
      },
      null,
      2,
    ),
  )
  process.exit(failed.length > 0 ? 1 : 0)
}

main()
