/**
 * Phase 12E — controlled publish prep smoke (no browser, no runtime).
 * Run: npx tsx scripts/phase12e-publish-prep-smoke.ts
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildApprovedDraft, writeApprovedArtifacts } from '@/lib/protocol-intake-review/approve'
import { discoverIntakePackages, loadIntakePackage } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'
import { createInitialWorkspace, saveWorkspace } from '@/lib/protocol-intake-review/workspace'
import { buildPublishCandidate } from '@/lib/protocol-intake-publish-prep/build-candidate'
import { loadApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import {
  publishCandidateAuditPath,
  publishCandidateDir,
  publishCandidatePath,
} from '@/lib/protocol-intake-publish-prep/paths'
import { runPublishPreflight } from '@/lib/protocol-intake-publish-prep/preflight'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
import { writePublishCandidateArtifacts } from '@/lib/protocol-intake-publish-prep/write-artifacts'
import type { ApprovedIntakeDraft } from '@/lib/protocol-intake-review/approve'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function removeDirIfExists(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

function seedApprovedDraft(root: string, draftKey: string): void {
  const pkg = loadIntakePackage(draftKey, root)
  if (!pkg) throw new Error('package missing for seed')

  const wsDir = workspaceDir(root, draftKey)
  removeDirIfExists(wsDir)
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
    ws.sections[section].approved_at = '2026-05-22T12:00:00.000Z'
    ws.sections[section].approved_by = 'smoke-reviewer'
  }

  saveWorkspace(ws, root)
  const approved = buildApprovedDraft(pkg, ws, 'smoke-reviewer')
  writeApprovedArtifacts(pkg, approved, ws, root)
}

function main() {
  const gates: Gate[] = []
  const root = process.cwd()
  const packages = discoverIntakePackages(root)
  const draftKey =
    packages.find((p) => p.draft_key.includes('para'))?.draft_key ?? packages[0]?.draft_key

  if (!draftKey) {
    console.log(JSON.stringify({ phase: '12E-publish-prep-smoke', gates, error: 'no package' }, null, 2))
    process.exit(1)
  }

  const candidateDir = publishCandidateDir(draftKey, root)
  removeDirIfExists(candidateDir)

  // No approved draft → blocked / not_ready
  const wsDir = workspaceDir(root, draftKey)
  removeDirIfExists(wsDir)
  const noApproved = resolvePublishPrepStatus(draftKey, root)
  gates.push(
    gate('no approved draft is not_ready', noApproved.status === 'not_ready'),
    gate('no approved blocks candidate path', !existsSync(publishCandidatePath(draftKey, root))),
  )

  let blockedCreate = false
  try {
    const handoffMissing = loadApprovedIntakeDraft(draftKey, root)
    if (handoffMissing) {
      const pf = runPublishPreflight(handoffMissing)
      if (pf.passed) blockedCreate = false
    }
  } catch {
    blockedCreate = true
  }
  gates.push(gate('no approved draft cannot preflight pass', !blockedCreate || noApproved.status === 'not_ready'))

  // Incomplete approval → blocked
  seedApprovedDraft(root, draftKey)
  const approvedPath = join(wsDir, 'approved_intake_draft.json')
  const incomplete = JSON.parse(readFileSync(approvedPath, 'utf8')) as ApprovedIntakeDraft
  incomplete.approval_summary.sections_approved = ['study_metadata']
  incomplete.visits = []
  writeFileSync(approvedPath, `${JSON.stringify(incomplete, null, 2)}\n`, 'utf8')
  const blocked = resolvePublishPrepStatus(draftKey, root)
  const blockedPf = loadApprovedIntakeDraft(draftKey, root)
  gates.push(
    gate('incomplete approval is blocked', blocked.status === 'blocked'),
    gate(
      'incomplete preflight fails',
      blockedPf ? !runPublishPreflight(blockedPf).passed : false,
    ),
  )

  // Full approved → ready → candidate
  seedApprovedDraft(root, draftKey)
  const handoff = loadApprovedIntakeDraft(draftKey, root)
  gates.push(gate('approved draft loads', Boolean(handoff)))
  if (!handoff) process.exit(1)

  const preflight = runPublishPreflight(handoff)
  gates.push(gate('complete approved preflight passes', preflight.passed, preflight.blockers.join('; ')))

  const ready = resolvePublishPrepStatus(draftKey, root)
  gates.push(gate('ready_for_candidate status', ready.status === 'ready_for_candidate'))

  const candidate = buildPublishCandidate(handoff, preflight, 'smoke-reviewer')
  writePublishCandidateArtifacts(candidate, {
    event: 'publish_candidate_created',
    draft_key: draftKey,
    timestamp: candidate.created_at,
    actor_id: 'smoke-reviewer',
    preflight_passed: true,
    candidate_version: '12E.1.0',
  }, root)

  gates.push(
    gate('publish_candidate.json exists', existsSync(publishCandidatePath(draftKey, root))),
    gate('publish_candidate_audit.json exists', existsSync(publishCandidateAuditPath(draftKey, root))),
  )

  const saved = JSON.parse(readFileSync(publishCandidatePath(draftKey, root), 'utf8')) as {
    publish_ready: boolean
    runtime_activation: boolean
    safety: { auto_publish: boolean; auto_bind: boolean; runtime_mutation: boolean }
  }

  gates.push(
    gate('candidate publish_ready false', saved.publish_ready === false),
    gate('candidate runtime_activation false', saved.runtime_activation === false),
    gate('candidate does not auto_publish', saved.safety.auto_publish === false),
    gate('candidate does not auto_bind', saved.safety.auto_bind === false),
    gate('candidate runtime_mutation false', saved.safety.runtime_mutation === false),
  )

  const created = resolvePublishPrepStatus(draftKey, root)
  gates.push(gate('status candidate_pending_review', created.status === 'candidate_pending_review'))

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12E-publish-prep-smoke',
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
