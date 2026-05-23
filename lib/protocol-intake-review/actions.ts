'use server'

import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { loadIntakePackage } from '@/lib/protocol-intake-review/load-package'
import { buildApprovedDraft, writeApprovedArtifacts } from '@/lib/protocol-intake-review/approve'
import type { ReviewSectionId, ReviewerStatus } from '@/lib/protocol-intake-review/types'
import { loadWorkspace, saveWorkspace } from '@/lib/protocol-intake-review/workspace'
import {
  canManageSourceBuilder,
} from '@/lib/rbac/permissions'

async function requireReviewer() {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required' }
  const organizationId = await getPrimaryOrganizationId(user.id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId ?? undefined)) {
    return { ok: false as const, error: 'Your role cannot review protocol intake drafts' }
  }
  return { ok: true as const, user }
}

function touch(ws: ReturnType<typeof loadWorkspace>) {
  ws.last_saved_at = new Date().toISOString()
}

export async function updateReviewItemAction(input: {
  draft_key: string
  item_id: string
  reviewer_status?: ReviewerStatus
  evidence_insufficient?: boolean
  field_key?: string
  edited_value?: unknown
  edit_reason?: string
}) {
  const auth = await requireReviewer()
  if (!auth.ok) return auth
  const user = auth.user

  const pkg = loadIntakePackage(input.draft_key)
  if (!pkg) return { ok: false, error: 'Draft package not found' }
  const ws = loadWorkspace(pkg)
  const item = pkg.items.find((i) => i.item_id === input.item_id)
  const state = ws.items[input.item_id]
  if (!item || !state) return { ok: false, error: 'Item not found' }

  if (input.reviewer_status) state.reviewer_status = input.reviewer_status
  if (input.evidence_insufficient !== undefined) state.evidence_insufficient = input.evidence_insufficient

  if (input.field_key !== undefined && input.edited_value !== undefined) {
    const field = item.fields.find((f) => f.field_key === input.field_key)
    if (!field) return { ok: false, error: 'Field not found' }
    const original = field.original_extracted_value
    const changed =
      JSON.stringify(original) !== JSON.stringify(input.edited_value)
    if (changed && !input.edit_reason?.trim()) {
      return { ok: false, error: 'Edit reason is required when changing extracted content' }
    }
    state.field_overrides[input.field_key] = input.edited_value
    if (changed) {
      state.reviewer_status = 'edited'
      state.edit_reason = input.edit_reason
      ws.audit.push({
        item_id: input.item_id,
        field_name: input.field_key,
        original_value: original,
        edited_value: input.edited_value,
        edit_reason: input.edit_reason ?? '',
        reviewer_status: 'edited',
        reviewer_id: user.id,
        timestamp: new Date().toISOString(),
        evidence_refs: field.evidence_refs,
      })
    }
  }

  state.updated_at = new Date().toISOString()
  touch(ws)
  saveWorkspace(ws)
  return { ok: true }
}

export async function acceptHighConfidenceInSectionAction(input: {
  draft_key: string
  section: ReviewSectionId
}) {
  const auth = await requireReviewer()
  if (!auth.ok) return auth

  const pkg = loadIntakePackage(input.draft_key)
  if (!pkg) return { ok: false, error: 'Draft package not found' }
  const ws = loadWorkspace(pkg)
  for (const item of pkg.items.filter((i) => i.section === input.section)) {
    const high = item.fields.every(
      (f) => f.confidence === 'high' && !f.requires_human_review,
    )
    if (!high) continue
    const state = ws.items[item.item_id]
    if (state && state.reviewer_status === 'pending') {
      state.reviewer_status = 'accepted'
      state.updated_at = new Date().toISOString()
    }
  }
  touch(ws)
  saveWorkspace(ws)
  return { ok: true }
}

export async function approveSectionAction(input: {
  draft_key: string
  section: ReviewSectionId
}) {
  const auth = await requireReviewer()
  if (!auth.ok) return auth
  const user = auth.user

  const pkg = loadIntakePackage(input.draft_key)
  if (!pkg) return { ok: false, error: 'Draft package not found' }
  const ws = loadWorkspace(pkg)

  const sectionItems = pkg.items.filter(
    (i) => i.section === input.section && i.fields.length > 0,
  )
  for (const item of sectionItems) {
    const state = ws.items[item.item_id]
    if (!state) continue
    if (state.reviewer_status === 'pending' || state.reviewer_status === 'needs_clarification') {
      return { ok: false, error: `Item "${item.title}" needs a reviewer decision before section approval` }
    }
  }

  ws.sections[input.section] = {
    section: input.section,
    section_status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: user.id,
  }
  touch(ws)
  saveWorkspace(ws)
  return { ok: true }
}

export async function generateApprovedDraftAction(draft_key: string) {
  const auth = await requireReviewer()
  if (!auth.ok) return auth
  const user = auth.user

  const pkg = loadIntakePackage(draft_key)
  if (!pkg) return { ok: false, error: 'Draft package not found' }
  const ws = loadWorkspace(pkg)

  const operationalSections: ReviewSectionId[] = [
    'study_metadata',
    'visits',
    'procedures',
    'source_composition',
    'eligibility',
  ]
  for (const section of operationalSections) {
    if (ws.sections[section]?.section_status !== 'approved') {
      return { ok: false, error: `Section "${section}" must be approved before generating approved draft` }
    }
  }

  const pending = Object.values(ws.items).filter(
    (i) => i.reviewer_status === 'pending' || i.reviewer_status === 'needs_clarification',
  )
  const operationalIds = new Set(
    pkg.items
      .filter((i) => operationalSections.includes(i.section as ReviewSectionId))
      .map((i) => i.item_id),
  )
  if (pending.some((p) => operationalIds.has(p.item_id))) {
    return { ok: false, error: 'All operational items need accepted, edited, or rejected status' }
  }

  const approved = buildApprovedDraft(pkg, ws, user.id)
  writeApprovedArtifacts(pkg, approved, ws)
  return { ok: true, approved_at: approved.approved_at }
}
