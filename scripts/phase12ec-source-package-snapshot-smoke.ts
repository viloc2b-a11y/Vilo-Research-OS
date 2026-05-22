/**
 * Phase 12E-C — source package snapshot smoke (no browser, no runtime).
 * Run: npx tsx scripts/phase12ec-source-package-snapshot-smoke.ts
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
import { buildSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/build-snapshot'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import { loadApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import {
  publishCandidateApprovalPath,
  publishCandidateDir,
  publishCandidatePath,
  sourcePackageSnapshotPath,
  sourcePublishSnapshotDir,
} from '@/lib/protocol-intake-publish-prep/paths'
import { runPublishPreflight } from '@/lib/protocol-intake-publish-prep/preflight'
import { runSnapshotReadiness } from '@/lib/protocol-intake-publish-prep/snapshot-readiness'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
import {
  loadPublishCandidate,
  writePublishCandidateApproval,
  writePublishCandidateArtifacts,
} from '@/lib/protocol-intake-publish-prep/write-artifacts'
import { writeSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/write-snapshot'
import type { PublishCandidate } from '@/lib/protocol-intake-publish-prep/types'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function seedApprovedCandidate(root: string, draftKey: string) {
  const pkg = loadIntakePackage(draftKey, root)!
  const wsDir = workspaceDir(root, draftKey)
  if (existsSync(wsDir)) rmSync(wsDir, { recursive: true })
  const candDir = publishCandidateDir(draftKey, root)
  if (existsSync(candDir)) rmSync(candDir, { recursive: true })
  const snapDir = sourcePublishSnapshotDir(draftKey, root)
  if (existsSync(snapDir)) rmSync(snapDir, { recursive: true })

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

  const finalReview = runFinalReviewChecks(candidate, root)
  const approval = buildPublishCandidateApproval(
    candidate,
    finalReview,
    'Smoke approval for snapshot',
    'smoke-reviewer',
    root,
  )
  writePublishCandidateApproval(approval, {
    event: 'publish_candidate_approved',
    draft_key: draftKey,
    timestamp: approval.approved_at,
    actor_id: 'smoke-reviewer',
    approval_reason: approval.approval_reason,
    candidate_version: '12E.1.0',
    approval_version: '12E-B.1.0',
  }, root)
  return { candidate, approval }
}

function trySnapshot(
  draftKey: string,
  candidate: PublishCandidate,
  approval: ReturnType<typeof buildPublishCandidateApproval>,
  root: string,
): { ok: boolean; error?: string } {
  const readiness = runSnapshotReadiness(draftKey, candidate, approval, root)
  if (!readiness.passed) {
    return { ok: false, error: readiness.blockers.join('; ') }
  }
  const snapshot = buildSourcePackageSnapshot(candidate, approval, 'smoke-reviewer', root)
  writeSourcePackageSnapshot(snapshot, {
    event: 'source_package_snapshot_created',
    draft_key: draftKey,
    snapshot_id: snapshot.snapshot_id,
    timestamp: snapshot.snapshot_created_at,
    actor_id: 'smoke-reviewer',
    content_checksum: snapshot.content_checksum,
    snapshot_version: '12E-C.1.0',
  }, root)
  return { ok: true }
}

function main() {
  const gates: Gate[] = []
  const root = process.cwd()
  const draftKey =
    discoverIntakePackages(root).find((p) => p.draft_key.includes('para'))?.draft_key
    ?? discoverIntakePackages(root)[0]?.draft_key
  if (!draftKey) process.exit(1)

  const noCand = runSnapshotReadiness(draftKey, null, null, root)
  gates.push(gate('missing candidate blocks snapshot', !noCand.passed))

  const { candidate, approval } = seedApprovedCandidate(root, draftKey)

  const noApprovalPath = publishCandidateApprovalPath(draftKey, root)
  const approvalBackup = readFileSync(noApprovalPath, 'utf8')
  rmSync(noApprovalPath)
  const blockedNoApproval = runSnapshotReadiness(draftKey, candidate, null, root)
  gates.push(gate('missing approval blocks snapshot', !blockedNoApproval.passed))
  writeFileSync(noApprovalPath, approvalBackup, 'utf8')

  const approvalNoReason = loadPublishCandidateApproval(draftKey, root)!
  const badApproval = { ...approvalNoReason, approval_reason: '   ' }
  writeFileSync(noApprovalPath, `${JSON.stringify(badApproval, null, 2)}\n`, 'utf8')
  const blockedReason = runSnapshotReadiness(draftKey, candidate, badApproval, root)
  gates.push(gate('missing reason blocks snapshot', !blockedReason.passed))
  writeFileSync(noApprovalPath, approvalBackup, 'utf8')

  writeFileSync(
    publishCandidatePath(draftKey, root),
    `${JSON.stringify({ ...candidate, safety: { ...candidate.safety, auto_publish: true } }, null, 2)}\n`,
    'utf8',
  )
  const unsafe = loadPublishCandidate(draftKey, root)!
  const blockedSafety = runSnapshotReadiness(draftKey, unsafe, approval, root)
  gates.push(gate('failed safety flag blocks snapshot', !blockedSafety.passed))
  writeFileSync(
    publishCandidatePath(draftKey, root),
    `${JSON.stringify(candidate, null, 2)}\n`,
    'utf8',
  )

  const ok = trySnapshot(draftKey, candidate, approval, root)
  gates.push(gate('valid approval creates snapshot', ok.ok))

  const snapshot = JSON.parse(
    readFileSync(sourcePackageSnapshotPath(draftKey, root), 'utf8'),
  ) as {
    immutable: boolean
    runtime_activation: boolean
    content_checksum: string
    snapshot_id: string
  }

  gates.push(
    gate('snapshot artifact exists', existsSync(sourcePackageSnapshotPath(draftKey, root))),
    gate('snapshot has checksum', typeof snapshot.content_checksum === 'string' && snapshot.content_checksum.length === 64),
    gate('snapshot immutable true', snapshot.immutable === true),
    gate('runtime_activation false', snapshot.runtime_activation === false),
    gate('status snapshot_created', resolvePublishPrepStatus(draftKey, root).status === 'snapshot_created'),
    gate(
      'audit file exists',
      existsSync(join(sourcePublishSnapshotDir(draftKey, root), 'source_package_snapshot_audit.json')),
    ),
  )

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12E-C-source-package-snapshot-smoke',
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
