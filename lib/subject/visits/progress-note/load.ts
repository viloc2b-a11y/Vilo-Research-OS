import { loadVisitCloseoutGuards } from '@/lib/subject/visits/progress-note/guards'
import { loadVisitCloseoutEvents } from '@/lib/subject/visits/progress-note/events'
import type {
  VisitCloseoutBundle,
  VisitProgressNoteModel,
} from '@/lib/subject/visits/progress-note/types'
import { createServerClient } from '@/lib/supabase/server'

export async function loadVisitProgressNote(
  visitId: string,
): Promise<VisitProgressNoteModel | null> {
  const bundle = await loadVisitCloseoutBundle(visitId)
  return bundle?.model ?? null
}

export async function loadVisitCloseoutBundle(
  visitId: string,
): Promise<VisitCloseoutBundle | null> {
  const supabase = await createServerClient()

  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select(
      `
      id,
      organization_id,
      visit_review_status,
      coordinator_signed_by_name,
      coordinator_signed_at,
      investigator_signed_by_name,
      investigator_role,
      investigator_signed_at
    `,
    )
    .eq('id', visitId)
    .maybeSingle()

  if (visitErr || !visit) return null

  const { data: note, error: noteErr } = await supabase
    .from('visit_progress_notes')
    .select(
      `
      id,
      note_text,
      coordinator_signature_status,
      coordinator_signed_by_name,
      coordinator_signed_at,
      investigator_review_status,
      investigator_signed_by_name,
      investigator_role,
      investigator_signed_at,
      updated_at
    `,
    )
    .eq('visit_id', visitId)
    .maybeSingle()

  if (noteErr && !noteErr.message.includes('does not exist')) {
    console.error('loadVisitCloseoutBundle', noteErr.message)
  }

  const visitReviewStatus =
    (visit.visit_review_status as VisitProgressNoteModel['visitReviewStatus']) ?? 'draft'

  const model: VisitProgressNoteModel = {
    id: (note?.id as string | null) ?? null,
    visitId: visit.id as string,
    organizationId: visit.organization_id as string,
    noteText: (note?.note_text as string) ?? '',
    visitReviewStatus,
    coordinatorSignatureStatus:
      (note?.coordinator_signature_status as VisitProgressNoteModel['coordinatorSignatureStatus']) ??
      'draft',
    coordinatorSignedByName:
      (note?.coordinator_signed_by_name as string | null) ??
      (visit.coordinator_signed_by_name as string | null),
    coordinatorSignedAt:
      (note?.coordinator_signed_at as string | null) ??
      (visit.coordinator_signed_at as string | null),
    investigatorReviewStatus:
      (note?.investigator_review_status as VisitProgressNoteModel['investigatorReviewStatus']) ??
      'pending',
    investigatorSignedByName:
      (note?.investigator_signed_by_name as string | null) ??
      (visit.investigator_signed_by_name as string | null),
    investigatorRole:
      (note?.investigator_role as VisitProgressNoteModel['investigatorRole']) ??
      (visit.investigator_role as VisitProgressNoteModel['investigatorRole']) ??
      null,
    investigatorSignedAt:
      (note?.investigator_signed_at as string | null) ??
      (visit.investigator_signed_at as string | null),
    updatedAt: (note?.updated_at as string | null) ?? null,
  }

  const coordinatorSigned = model.coordinatorSignatureStatus === 'signed'
  const [events, guards] = await Promise.all([
    loadVisitCloseoutEvents(visitId),
    loadVisitCloseoutGuards(
      visitId,
      model.organizationId,
      model.noteText,
      coordinatorSigned,
    ),
  ])

  const noteLocked =
    coordinatorSigned && visitReviewStatus !== 'reopened'
  const closeoutLocked = visitReviewStatus === 'investigator_signed'

  return {
    model,
    events,
    guards,
    noteLocked,
    closeoutLocked,
  }
}
