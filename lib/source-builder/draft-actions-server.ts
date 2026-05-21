'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import {
  buildDraftPayload,
  payloadToDraftParts,
  validateDraftPayload,
} from '@/lib/source-builder/draft-payload'
import type { SourceBuilderDraft } from '@/lib/source-builder/types'
import { createServerClient } from '@/lib/supabase/server'

export type SourceBuilderDraftSummary = {
  id: string
  name: string
  studyNickname: string | null
  lastSavedAt: string | null
}

export type SourceBuilderDraftActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type DraftRow = {
  draft_id: string
  organization_id: string
  draft_name: string
  study_nickname: string | null
  description: string | null
  status: string
  draft_payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

async function resolveOrgContext(organizationId?: string) {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false as const, error: 'Sign in required to save drafts.' }
  }

  const orgId = organizationId?.trim() || (await getPrimaryOrganizationId(user.id))
  if (!orgId) {
    return { ok: false as const, error: 'No organization membership found.' }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, orgId)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  return { ok: true as const, user, organizationId: orgId, supabase }
}

function rowToDraft(row: DraftRow): SourceBuilderDraft {
  const parts = payloadToDraftParts(row.draft_payload ?? {})
  return {
    id: row.draft_id,
    name: row.draft_name,
    protocolNickname: row.study_nickname ?? parts.protocolNickname,
    description: row.description ?? parts.description,
    status: 'draft',
    lastSavedAt: row.updated_at,
    visits: parts.visits,
    procedures: parts.procedures,
    matrix: parts.matrix,
    version: parts.version,
  }
}

async function insertDraftEvent(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: {
    draftId: string
    organizationId: string
    eventType: 'draft_created' | 'draft_saved' | 'draft_deleted'
    actorUserId: string
    eventPayload?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('source_builder_draft_events').insert({
    draft_id: params.draftId,
    organization_id: params.organizationId,
    event_type: params.eventType,
    actor_user_id: params.actorUserId,
    event_payload: params.eventPayload ?? null,
  })
  if (error) {
    console.error('insertDraftEvent', error.message)
  }
}

export async function listSourceBuilderDraftsAction(
  organizationId?: string,
): Promise<SourceBuilderDraftActionResult<SourceBuilderDraftSummary[]>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const { data, error } = await ctx.supabase
    .from('source_builder_drafts')
    .select('draft_id, draft_name, study_nickname, updated_at')
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })

  if (error) {
    return { ok: false, error: error.message }
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.draft_id as string,
      name: row.draft_name as string,
      studyNickname: (row.study_nickname as string | null) ?? null,
      lastSavedAt: (row.updated_at as string) ?? null,
    })),
  }
}

export async function loadSourceBuilderDraftAction(
  draftId: string,
  organizationId?: string,
): Promise<SourceBuilderDraftActionResult<SourceBuilderDraft>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const { data, error } = await ctx.supabase
    .from('source_builder_drafts')
    .select(
      'draft_id, organization_id, draft_name, study_nickname, description, status, draft_payload, created_at, updated_at',
    )
    .eq('draft_id', draftId)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'draft')
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: 'Draft not found.' }
  }

  return { ok: true, data: rowToDraft(data as DraftRow) }
}

export async function createSourceBuilderDraftAction(
  draft: SourceBuilderDraft,
  organizationId?: string,
): Promise<SourceBuilderDraftActionResult<SourceBuilderDraft>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const payload = buildDraftPayload(draft)
  const validationError = validateDraftPayload(payload)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const { data, error } = await ctx.supabase
    .from('source_builder_drafts')
    .insert({
      organization_id: ctx.organizationId,
      draft_name: draft.name.trim() || 'Untitled draft',
      study_nickname: draft.protocolNickname.trim() || null,
      description: draft.description.trim() || null,
      status: 'draft',
      draft_payload: payload,
      created_by: ctx.user.id,
      updated_by: ctx.user.id,
    })
    .select(
      'draft_id, organization_id, draft_name, study_nickname, description, status, draft_payload, created_at, updated_at',
    )
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to create draft.' }
  }

  await insertDraftEvent(ctx.supabase, {
    draftId: data.draft_id as string,
    organizationId: ctx.organizationId,
    eventType: 'draft_created',
    actorUserId: ctx.user.id,
    eventPayload: { draft_name: data.draft_name },
  })

  revalidatePath('/source-builder')
  return { ok: true, data: rowToDraft(data as DraftRow) }
}

export async function saveSourceBuilderDraftAction(
  draft: SourceBuilderDraft,
  organizationId?: string,
): Promise<SourceBuilderDraftActionResult<SourceBuilderDraft>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  if (!draft.id?.trim()) {
    return { ok: false, error: 'Draft id is required to save.' }
  }

  const payload = buildDraftPayload({
    ...draft,
    version: draft.version + 1,
  })
  const validationError = validateDraftPayload(payload)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const { data, error } = await ctx.supabase
    .from('source_builder_drafts')
    .update({
      draft_name: draft.name.trim() || 'Untitled draft',
      study_nickname: draft.protocolNickname.trim() || null,
      description: draft.description.trim() || null,
      draft_payload: payload,
      updated_by: ctx.user.id,
    })
    .eq('draft_id', draft.id)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'draft')
    .select(
      'draft_id, organization_id, draft_name, study_nickname, description, status, draft_payload, created_at, updated_at',
    )
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: 'Draft not found or not editable.' }
  }

  await insertDraftEvent(ctx.supabase, {
    draftId: draft.id,
    organizationId: ctx.organizationId,
    eventType: 'draft_saved',
    actorUserId: ctx.user.id,
    eventPayload: { version: payload.version },
  })

  revalidatePath('/source-builder')
  return { ok: true, data: rowToDraft(data as DraftRow) }
}

export async function deleteSourceBuilderDraftAction(
  draftId: string,
  organizationId?: string,
): Promise<SourceBuilderDraftActionResult<{ id: string }>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const { data, error } = await ctx.supabase
    .from('source_builder_drafts')
    .update({
      status: 'deleted',
      updated_by: ctx.user.id,
    })
    .eq('draft_id', draftId)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'draft')
    .select('draft_id')
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: 'Draft not found.' }
  }

  await insertDraftEvent(ctx.supabase, {
    draftId,
    organizationId: ctx.organizationId,
    eventType: 'draft_deleted',
    actorUserId: ctx.user.id,
  })

  revalidatePath('/source-builder')
  return { ok: true, data: { id: draftId } }
}
