import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  IntakeReviewPackage,
  ReviewItemState,
  ReviewSectionId,
  ReviewWorkspaceState,
  SectionReviewState,
} from '@/lib/protocol-intake-review/types'
import { defaultItemStatus } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'

const SECTIONS: ReviewSectionId[] = [
  'study_metadata',
  'visits',
  'procedures',
  'source_composition',
  'eligibility',
  'missing',
  'conflicts',
  'approval_summary',
]

export function workspacePath(draftKey: string, cwd = process.cwd()): string {
  return join(workspaceDir(cwd, draftKey), 'review_workspace.json')
}

export function createInitialWorkspace(pkg: IntakeReviewPackage): ReviewWorkspaceState {
  const items: Record<string, ReviewItemState> = {}
  for (const item of pkg.items) {
    if (item.section === 'approval_summary') continue
    const worst = item.fields.find((f) => f.confidence === 'low')
      ? 'low'
      : item.fields.some((f) => f.requires_human_review)
        ? 'medium'
        : 'high'
    const needs = item.fields.some((f) => f.requires_human_review)
    const conflict = item.section === 'conflicts'
    const status = defaultItemStatus(worst, needs, conflict)
    const snapshot: Record<string, unknown> = {}
    for (const f of item.fields) snapshot[f.field_key] = f.original_extracted_value
    items[item.item_id] = {
      item_id: item.item_id,
      reviewer_status: status,
      evidence_insufficient: false,
      field_overrides: {},
      original_snapshot: snapshot,
      updated_at: '1970-01-01T00:00:00.000Z',
    }
  }
  const sections = Object.fromEntries(
    SECTIONS.map((s) => [s, { section: s, section_status: 'pending' as const }]),
  ) as Record<ReviewSectionId, SectionReviewState>
  return {
    draft_key: pkg.draft_key,
    items,
    sections,
    audit: [],
    last_saved_at: '1970-01-01T00:00:00.000Z',
  }
}

export function loadWorkspace(pkg: IntakeReviewPackage, cwd = process.cwd()): ReviewWorkspaceState {
  const path = workspacePath(pkg.draft_key, cwd)
  if (!existsSync(path)) return createInitialWorkspace(pkg)
  try {
    const ws = JSON.parse(readFileSync(path, 'utf8')) as ReviewWorkspaceState
    for (const item of pkg.items) {
      if (!ws.items[item.item_id]) {
        const init = createInitialWorkspace(pkg)
        ws.items[item.item_id] = init.items[item.item_id]
      }
    }
    return ws
  } catch {
    return createInitialWorkspace(pkg)
  }
}

export function saveWorkspace(ws: ReviewWorkspaceState, cwd = process.cwd()): void {
  const dir = workspaceDir(cwd, ws.draft_key)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'review_workspace.json'), `${JSON.stringify(ws, null, 2)}\n`, 'utf8')
}

export { canIncludeInApproved, resolvedFieldValue } from '@/lib/protocol-intake-review/resolve'
