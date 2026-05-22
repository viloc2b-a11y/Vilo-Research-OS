'use server'

import { revalidatePath } from 'next/cache'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { appendVisitCloseoutEvent } from '@/lib/subject/visits/progress-note/events'
import {
  assessProcedureReadiness,
  loadVisitCloseoutGuards,
} from '@/lib/subject/visits/progress-note/guards'
import type {
  InvestigatorRole,
  VisitCloseoutActionResult,
} from '@/lib/subject/visits/progress-note/types'
import { createServerClient } from '@/lib/supabase/server'
import { STALE_WRITE_USER_MESSAGE } from '@/lib/concurrency/stale-write'
import { validateVisitProcedures } from '@/lib/visit-runtime/validateVisitProcedures'
import { canSignClinicalSourceForRole } from '@/lib/rbac/permissions'

const UUID_RE = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

async function resolveSignerName(userId: string) {
  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  return (profile?.display_name as string | null)?.trim() || 'Site user'
}

async function assertVisitWrite(
  visitId: string,
  organizationId: string,
): Promise<
  | { ok: true; studyId: string; subjectId: string }
  | { ok: false; error: string }
> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessOrganization(memberships, organizationId)) {
    return { ok: false, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  const { data: visit, error } = await supabase
    .from('visits')
    .select('id, organization_id, study_id, study_subject_id, visit_review_status, visit_status')
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!visit) return { ok: false, error: 'Visit not found.' }

  return {
    ok: true,
    studyId: visit.study_id as string,
    subjectId: visit.study_subject_id as string,
  }
}

function revalidateVisitPaths(studyId: string, subjectId: string, visitId: string) {
  revalidatePath(`/visits/${visitId}`)
  revalidatePath(`/studies/${studyId}/subjects/${subjectId}/visits`)
  revalidatePath(`/studies/${studyId}/subjects/${subjectId}`)
}

async function applyVisitCompletionCoupling(
  visitId: string,
  organizationId: string,
): Promise<{ autoCompleted: boolean; reasons: string[] }> {
  const supabase = await createServerClient()

  const { data: procedures } = await supabase
    .from('procedure_executions')
    .select('id, is_signed, validation_status')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  const rows = procedures ?? []
  const procedureIds = rows.map((p) => p.id as string)

  let criticalOpenCount = 0
  if (procedureIds.length > 0) {
    const { data: sets } = await supabase
      .from('source_response_sets')
      .select('id')
      .in('procedure_execution_id', procedureIds)

    const setIds = (sets ?? []).map((s) => s.id as string)
    if (setIds.length > 0) {
      const { count } = await supabase
        .from('source_response_validation_findings')
        .select('id', { count: 'exact', head: true })
        .in('response_set_id', setIds)
        .eq('severity', 'error')
        .in('status', ['open', 'acknowledged'])

      criticalOpenCount = count ?? 0
    }
  }

  const readiness = assessProcedureReadiness(
    rows.map((p) => ({
      id: p.id as string,
      is_signed: Boolean(p.is_signed),
      validation_status: (p.validation_status as string) ?? 'incomplete',
    })),
    criticalOpenCount,
  )

  if (!readiness.visitCompletionBlocked) {
    const { data: rpc, error: rpcErr } = await supabase.rpc('complete_visit', {
      p_visit_id: visitId,
    })
    if (rpcErr) {
      return { autoCompleted: false, reasons: [rpcErr.message] }
    }
    const row = rpc as { ok?: boolean; error?: string | null } | null
    if (!row?.ok) {
      return {
        autoCompleted: false,
        reasons: [
          typeof row?.error === 'string' && row.error.length > 0
            ? row.error
            : 'Visit could not be completed — refresh and retry.',
        ],
      }
    }
    return { autoCompleted: true, reasons: [] }
  }

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_status')
    .eq('id', visitId)
    .maybeSingle()

  const terminal = new Set(['completed', 'cancelled', 'locked', 'missed', 'no_show'])
  if (!terminal.has((visit?.visit_status as string) ?? '')) {
    await supabase
      .from('visits')
      .update({ visit_status: 'in_progress' })
      .eq('id', visitId)
  }

  return { autoCompleted: false, reasons: readiness.visitCompletionBlockReasons }
}

export async function saveVisitProgressNoteAction(input: {
  visitId: string
  organizationId: string
  noteText: string
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, noteText } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()

  const { data: existing } = await supabase
    .from('visit_progress_notes')
    .select('id, coordinator_signature_status')
    .eq('visit_id', visitId)
    .maybeSingle()

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_review_status')
    .eq('id', visitId)
    .maybeSingle()

  if (
    existing?.coordinator_signature_status === 'signed'
    && visit?.visit_review_status !== 'reopened'
  ) {
    return { ok: false, error: 'Progress note is signed. Reopen before editing.' }
  }

  if (visit?.visit_review_status === 'investigator_signed') {
    return { ok: false, error: 'Closeout is locked after investigator signature.' }
  }

  const payload = {
    organization_id: organizationId,
    visit_id: visitId,
    note_text: noteText,
    updated_by: user.id,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('visit_progress_notes')
      .update(payload)
      .eq('id', existing.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('visit_progress_notes').insert({
      ...payload,
      created_by: user.id,
    })
    if (error) return { ok: false, error: error.message }
  }

  const actorName = await resolveSignerName(user.id)
  await appendVisitCloseoutEvent({
    organizationId,
    visitId,
    eventType: 'note_saved',
    actorUserId: user.id,
    actorName,
  })

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}

export async function signCoordinatorProgressNoteAction(input: {
  visitId: string
  organizationId: string
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('id, note_text')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (!note?.note_text?.trim()) {
    return { ok: false, error: 'Add a progress note before signing.' }
  }

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note.note_text,
    false,
  )
  if (guards.coordinatorSignBlocked) {
    return { ok: false, error: guards.coordinatorBlockReasons.join(' ') }
  }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_coordinator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: rpcError.message }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    const err = rpc?.error ?? 'Coordinator sign-off failed.'
    return {
      ok: false,
      error: /refresh|changed|blocking|submitted/i.test(err) ? `${err} ${STALE_WRITE_USER_MESSAGE}` : err,
    }
  }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}

export async function reopenCoordinatorProgressNoteAction(input: {
  visitId: string
  organizationId: string
  reopenReason?: string | null
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, reopenReason } = input
  if (!reopenReason?.trim() || reopenReason.trim().length < 3) {
    return { ok: false, error: 'Reopen reason is required (minimum 3 characters).' }
  }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const actorName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'reopen_visit_coordinator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_actor_name: actorName,
      p_reopen_reason: reopenReason ?? null,
    },
  )

  if (rpcError) return { ok: false, error: rpcError.message }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    return {
      ok: false,
      error: rpc?.error?.includes('refresh')
        ? STALE_WRITE_USER_MESSAGE
        : (rpc?.error ?? 'Could not reopen coordinator sign-off.'),
    }
  }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}

export async function signInvestigatorReviewAction(input: {
  visitId: string
  organizationId: string
  investigatorRole: InvestigatorRole
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, investigatorRole } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }
  if (
    investigatorRole !== 'principal_investigator'
    && investigatorRole !== 'sub_investigator'
  ) {
    return { ok: false, error: 'Select an investigator role.' }
  }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  // F-07 fix: enforce investigator role server-side
  // Only pi_sub_i, admin, or owner may sign as investigator.
  const memberships = await getOrganizationMemberships(user.id)
  const orgMembership = memberships.find((m) => m.organization_id === organizationId)
  const allRoles = orgMembership
    ? [orgMembership.role, ...orgMembership.roles].filter(Boolean)
    : []
  const hasInvestigatorRole = allRoles.some((r) => canSignClinicalSourceForRole(r))
  if (!hasInvestigatorRole) {
    return {
      ok: false,
      error:
        'Investigator review requires the pi_sub_i, admin, or owner site role. Contact your site administrator.',
    }
  }

  const supabase = await createServerClient()
  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_review_status')
    .eq('id', visitId)
    .maybeSingle()

  if (
    visit?.visit_review_status !== 'coordinator_signed'
    && visit?.visit_review_status !== 'investigator_signed'
  ) {
    return { ok: false, error: 'Coordinator must sign the progress note first.' }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('note_text, coordinator_signature_status')
    .eq('visit_id', visitId)
    .maybeSingle()

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note?.note_text,
    note?.coordinator_signature_status === 'signed',
  )
  if (guards.investigatorSignBlocked) {
    return { ok: false, error: guards.investigatorBlockReasons.join(' ') }
  }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_investigator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_investigator_role: investigatorRole,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: rpcError.message }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    return { ok: false, error: rpc?.error ?? 'Investigator sign-off failed.' }
  }

  const coupling = await applyVisitCompletionCoupling(visitId, organizationId)

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return {
    ok: true,
    visitAutoCompleted: coupling.autoCompleted,
  }
}

export async function reopenInvestigatorReviewAction(input: {
  visitId: string
  organizationId: string
  reopenReason?: string | null
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, reopenReason } = input
  if (!reopenReason?.trim() || reopenReason.trim().length < 3) {
    return { ok: false, error: 'Reopen reason is required (minimum 3 characters).' }
  }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const actorName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'reopen_visit_investigator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_actor_name: actorName,
      p_reopen_reason: reopenReason,
    },
  )

  if (rpcError) return { ok: false, error: rpcError.message }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    return {
      ok: false,
      error: rpc?.error?.includes('refresh') || rpc?.error?.includes('reason')
        ? (rpc.error ?? STALE_WRITE_USER_MESSAGE)
        : (rpc?.error ?? 'Could not reopen investigator sign-off.'),
    }
  }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}
