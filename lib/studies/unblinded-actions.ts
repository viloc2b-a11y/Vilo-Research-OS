'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { canAccessUnblindedStudyArea } from '@/lib/auth/unblinded-guard'

export async function createIPAccountabilityRecord(studyId: string, data: Record<string, unknown>) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const isAllowed = await canAccessUnblindedStudyArea(sessionUser.id, studyId)
  if (!isAllowed) {
    throw new Error('Access Denied: Unblinded delegation required')
  }

  const supabase = await createServerClient()
  const { error } = await supabase.from('study_ip_accountability').insert({
    ...data,
    study_id: studyId,
    performed_by: sessionUser.id
  })

  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function createIPDispensingRecord(studyId: string, subjectId: string, data: Record<string, unknown>) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const isAllowed = await canAccessUnblindedStudyArea(sessionUser.id, studyId)
  if (!isAllowed) {
    throw new Error('Access Denied: Unblinded delegation required')
  }

  const supabase = await createServerClient()
  const { error } = await supabase.from('study_ip_dispensing').insert({
    ...data,
    study_id: studyId,
    subject_id: subjectId,
    dispensed_by: sessionUser.id
  })

  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function downloadUnblindedDocument(studyId: string, documentId: string) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const isAllowed = await canAccessUnblindedStudyArea(sessionUser.id, studyId)
  if (!isAllowed) {
    throw new Error('Access Denied: Unblinded delegation required')
  }

  // Generate signed URL
  return { url: 'https://mock-s3-signed-url/doc.pdf' }
}
