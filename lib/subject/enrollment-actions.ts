'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import {
  createStudySubjectRecord,
  updateStudySubjectRecord,
} from '@/lib/operations/clinical-record-mutations'

export async function validateSubjectIdentifiers(studyId: string, identifiers: { screeningNumber?: string, subjectNumber?: string }) {
  const supabase = await createServerClient()
  
  if (identifiers.screeningNumber) {
    const { data } = await supabase.from('study_subjects').select('id').eq('study_id', studyId).eq('screening_number', identifiers.screeningNumber).single()
    if (data) throw new Error('Screening number already exists in this study.')
  }
  
  if (identifiers.subjectNumber) {
    const { data } = await supabase.from('study_subjects').select('id').eq('study_id', studyId).eq('subject_identifier', identifiers.subjectNumber).single()
    if (data) throw new Error('Subject number already exists in this study.')
  }
  
  return { ok: true }
}

export async function createStudySubject(studyId: string, payload: Record<string, unknown>) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  // Validate identifiers
  await validateSubjectIdentifiers(studyId, {
    screeningNumber: typeof payload.screening_number === 'string' ? payload.screening_number : undefined,
    subjectNumber: typeof payload.subject_identifier === 'string' ? payload.subject_identifier : undefined,
  })

  const supabase = await createServerClient()
  
  const subject = await createStudySubjectRecord({
    supabase,
    studyId,
    payload,
  })

  // Write audit
  await supabase.from('operational_events').insert({
    study_id: studyId,
    entity_id: subject.id,
    entity_type: 'subject',
    event_type: 'subject_enrolled',
    actor_id: sessionUser.id,
    new_state: payload
  })

  return subject
}

export async function generateSubjectVisitSchedule(subjectId: string, studyId: string) {
  const supabase = await createServerClient()
  
  // 1. Get the bound source package for this study
  const { data: visits } = await supabase.from('study_runtime_visits').select('*').eq('study_id', studyId).order('visit_order')
  if (!visits || visits.length === 0) {
    throw new Error('Action Required: Source package is not bound. Cannot generate visit schedule.')
  }

  // 2. Generate the subject's visits mapping
  const subjectVisits = visits.map(v => ({
    study_id: studyId,
    subject_id: subjectId,
    runtime_visit_id: v.id,
    status: 'Pending',
    // ... calculate windows if applicable
  }))

  const { error } = await supabase.from('study_subject_visits').insert(subjectVisits)
  if (error) throw new Error(error.message)

  return { ok: true }
}

export async function updateStudySubject(subjectId: string, payload: Record<string, unknown>) {
  const sessionUser = await getSessionUser()
  const supabase = await createServerClient()
  
  await updateStudySubjectRecord({
    supabase,
    subjectId,
    payload,
  })
  
  await supabase.from('operational_events').insert({
    entity_id: subjectId,
    entity_type: 'subject',
    event_type: 'subject_updated',
    actor_id: sessionUser?.id,
    new_state: payload
  })
  
  return { ok: true }
}
