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
import { validateVisitProcedures } from '@/lib/visit-runtime/validateVisitProcedures'

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

  const now = new Date().toISOString()

  if (!readiness.visitCompletionBlocked) {
    await supabase
      .from('visits')
      .update({
        visit_status: 'completed',
        completed_at: now,
        actual_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', visitId)
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
  const signedAt = new Date().toISOString()

  const notePatch = {
    coordinator_signature_status: 'signed',
    coordinator_signed_by_user_id: user.id,
    coordinator_signed_by_name: signedName,
    coordinator_signed_at: signedAt,
    updated_by: user.id,
  }

  if (note.id) {
    const { error } = await supabase
      .from('visit_progress_notes')
      .update(notePatch)
      .eq('id', note.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('visit_progress_notes').insert({
      organization_id: organizationId,
      visit_id: visitId,
      note_text: note.note_text,
      created_by: user.id,
      ...notePatch,
    })
    if (error) return { ok: false, error: error.message }
  }

  const { error: visitErr } = await supabase
    .from('visits')
    .update({
      visit_review_status: 'coordinator_signed',
      coordinator_signed_by: user.id,
      coordinator_signed_by_name: signedName,
      coordinator_signed_at: signedAt,
    })
    .eq('id', visitId)

  if (visitErr) return { ok: false, error: visitErr.message }

  await appendVisitCloseoutEvent({
    organizationId,
    visitId,
    eventType: 'coordinator_signed',
    actorUserId: user.id,
    actorName: signedName,
  })

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}

export async function reopenCoordinatorProgressNoteAction(input: {
  visitId: string
  organizationId: string
  reopenReason?: string | null
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, reopenReason } = input
  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const { error: noteErr } = await supabase
    .from('visit_progress_notes')
    .update({
      coordinator_signature_status: 'draft',
      coordinator_signed_by_user_id: null,
      coordinator_signed_by_name: null,
      coordinator_signed_at: null,
      investigator_review_status: 'pending',
      investigator_signed_by_user_id: null,
      investigator_signed_by_name: null,
      investigator_role: null,
      investigator_signed_at: null,
    })
    .eq('visit_id', visitId)

  if (noteErr) return { ok: false, error: noteErr.message }

  const { error: visitErr } = await supabase
    .from('visits')
    .update({
      visit_review_status: 'reopened',
      coordinator_signed_by: null,
      coordinator_signed_by_name: null,
      coordinator_signed_at: null,
      investigator_signed_by: null,
      investigator_signed_by_name: null,
      investigator_role: null,
      investigator_signed_at: null,
    })
    .eq('id', visitId)

  if (visitErr) return { ok: false, error: visitErr.message }

  const actorName = await resolveSignerName(user.id)
  await appendVisitCloseoutEvent({
    organizationId,
    visitId,
    eventType: 'coordinator_reopened',
    actorUserId: user.id,
    actorName,
    reopenReason,
  })

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
  const signedAt = new Date().toISOString()

  const { error: noteErr } = await supabase
    .from('visit_progress_notes')
    .update({
      investigator_review_status: 'signed',
      investigator_signed_by_user_id: user.id,
      investigator_signed_by_name: signedName,
      investigator_role: investigatorRole,
      investigator_signed_at: signedAt,
    })
    .eq('visit_id', visitId)

  if (noteErr) return { ok: false, error: noteErr.message }

  const { error: visitErr } = await supabase
    .from('visits')
    .update({
      visit_review_status: 'investigator_signed',
      investigator_signed_by: user.id,
      investigator_signed_by_name: signedName,
      investigator_role: investigatorRole,
      investigator_signed_at: signedAt,
    })
    .eq('id', visitId)

  if (visitErr) return { ok: false, error: visitErr.message }

  await appendVisitCloseoutEvent({
    organizationId,
    visitId,
    eventType: 'investigator_signed',
    actorUserId: user.id,
    actorName: signedName,
  })

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
  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const { error: noteErr } = await supabase
    .from('visit_progress_notes')
    .update({
      investigator_review_status: 'reopened',
      investigator_signed_by_user_id: null,
      investigator_signed_by_name: null,
      investigator_role: null,
      investigator_signed_at: null,
    })
    .eq('visit_id', visitId)

  if (noteErr) return { ok: false, error: noteErr.message }

  const { error: visitErr } = await supabase
    .from('visits')
    .update({
      visit_review_status: 'coordinator_signed',
      investigator_signed_by: null,
      investigator_signed_by_name: null,
      investigator_role: null,
      investigator_signed_at: null,
      visit_status: 'in_progress',
    })
    .eq('id', visitId)

  if (visitErr) return { ok: false, error: visitErr.message }

  const actorName = await resolveSignerName(user.id)
  await appendVisitCloseoutEvent({
    organizationId,
    visitId,
    eventType: 'investigator_reopened',
    actorUserId: user.id,
    actorName,
    reopenReason,
  })

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}
