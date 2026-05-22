/**
 * Phase 12D — intake review workspace smoke (no browser).
 * Run: npx tsx scripts/phase12d-intake-review-smoke.ts
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildApprovedDraft, writeApprovedArtifacts } from '@/lib/protocol-intake-review/approve'
import { discoverIntakePackages, loadIntakePackage } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'
import { createInitialWorkspace, loadWorkspace, saveWorkspace } from '@/lib/protocol-intake-review/workspace'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function main() {
  const gates: Gate[] = []
  const root = process.cwd()

  const packages = discoverIntakePackages(root)
  gates.push(gate('discovers intake package', packages.length > 0, String(packages.length)))

  const draftKey =
    packages.find((p) => p.draft_key.includes('para'))?.draft_key ?? packages[0]?.draft_key
  if (!draftKey) {
    console.log(JSON.stringify({ gates, error: 'no package' }, null, 2))
    process.exit(1)
  }

  const pkg = loadIntakePackage(draftKey, root)
  gates.push(gate('loads review package', Boolean(pkg)))
  if (!pkg) process.exit(1)

  gates.push(
    gate('study metadata items', pkg.items.some((i) => i.section === 'study_metadata')),
    gate(
      'visit items with evidence',
      pkg.items.some((i) => i.section === 'visits' && (i.fields[0]?.evidence_refs.length ?? 0) > 0),
    ),
  )

  const wsDir = workspaceDir(root, draftKey)
  if (existsSync(wsDir)) rmSync(wsDir, { recursive: true })
  const ws = createInitialWorkspace(pkg)

  const metaItem = pkg.items.find((i) => i.item_id === 'meta:protocol_title')
  gates.push(gate('metadata field present', Boolean(metaItem)))
  if (!metaItem) process.exit(1)

  const metaState = ws.items[metaItem.item_id]
  metaState.field_overrides.protocol_title = 'Edited Title for Smoke'
  metaState.reviewer_status = 'edited'
  metaState.edit_reason = 'Coordinator correction'
  ws.audit.push({
    item_id: metaItem.item_id,
    field_name: 'protocol_title',
    original_value: metaItem.fields[0].original_extracted_value,
    edited_value: 'Edited Title for Smoke',
    edit_reason: 'Coordinator correction',
    reviewer_status: 'edited',
    reviewer_id: 'smoke-reviewer',
    timestamp: '2026-05-22T12:00:00.000Z',
    evidence_refs: metaItem.fields[0].evidence_refs,
  })

  const visitItem = pkg.items.find((i) => i.section === 'visits')
  if (visitItem) ws.items[visitItem.item_id].reviewer_status = 'accepted'

  const procItems = pkg.items.filter((i) => i.section === 'procedures')
  const procItem = procItems[0]
  const lowItem = procItems.find((i) =>
    i.fields.some((f) => f.requires_human_review),
  )
  if (procItem) ws.items[procItem.item_id].reviewer_status = 'rejected'
  if (lowItem && lowItem.item_id !== procItem?.item_id) {
    ws.items[lowItem.item_id].evidence_insufficient = true
    ws.items[lowItem.item_id].reviewer_status = 'needs_clarification'
    gates.push(gate('mark evidence insufficient', ws.items[lowItem.item_id].evidence_insufficient))
  }

  for (const item of pkg.items) {
    if (
      item.section === 'study_metadata'
      || item.section === 'visits'
      || item.section === 'procedures'
      || item.section === 'source_composition'
      || item.section === 'eligibility'
    ) {
      const st = ws.items[item.item_id]
      if (st.reviewer_status === 'rejected') continue
      if (st.reviewer_status === 'pending' || st.reviewer_status === 'needs_clarification') {
        st.reviewer_status = 'accepted'
      }
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

  const approvedPath = join(wsDir, 'approved_intake_draft.json')
  const auditPath = join(wsDir, 'review_audit.json')
  gates.push(
    gate('approved_intake_draft.json exists', existsSync(approvedPath)),
    gate('review_audit.json exists', existsSync(auditPath)),
  )

  const approvedJson = JSON.parse(readFileSync(approvedPath, 'utf8')) as {
    safety: { auto_publish: boolean; auto_bind: boolean; runtime_mutation: boolean }
    rejected_items: unknown[]
    edit_history: unknown[]
    study_metadata: { protocol_title?: string }
    procedures: Array<{ item_id: string }>
  }

  gates.push(
    gate('safety auto_publish false', approvedJson.safety.auto_publish === false),
    gate('safety auto_bind false', approvedJson.safety.auto_bind === false),
    gate('safety runtime_mutation false', approvedJson.safety.runtime_mutation === false),
    gate('rejected items retained', Array.isArray(approvedJson.rejected_items)),
    gate('edit history retained', (approvedJson.edit_history?.length ?? 0) > 0),
    gate(
      'edited title in approved metadata',
      approvedJson.study_metadata?.protocol_title === 'Edited Title for Smoke',
    ),
    gate(
      'rejected procedure excluded from list',
      !approvedJson.procedures?.some((p) => p.item_id === procItem?.item_id),
    ),
  )

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12D-intake-review-smoke',
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
