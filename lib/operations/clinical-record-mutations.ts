'use server'

import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export async function syncLegacySubjectConsentMirror(input: {
  supabase: Supabase
  subjectId: string
  consentVersionId: string
  signedAt: string
}) {
  const { error } = await input.supabase
    .from('study_subjects')
    .update({ consent_signed_at: input.signedAt, consent_version_id: input.consentVersionId })
    .eq('id', input.subjectId)

  if (error) throw new Error(error.message)
}

export async function syncLegacySubjectPrivacyConsentMirror(input: {
  supabase: Supabase
  subjectId: string
  privacyConsent: boolean
}) {
  const { error } = await input.supabase
    .from('study_subjects')
    .update({ privacy_consent: input.privacyConsent })
    .eq('id', input.subjectId)

  if (error) throw new Error(error.message)
}

export async function createStudySubjectRecord(input: {
  supabase: Supabase
  studyId: string
  payload: Record<string, unknown>
}) {
  const { data: subject, error } = await input.supabase
    .from('study_subjects')
    .insert({
      ...input.payload,
      study_id: input.studyId,
    })
    .select('id')
    .single()

  if (error || !subject) throw new Error(error?.message ?? 'Failed to create study subject.')
  return { id: String(subject.id) }
}

export async function updateStudySubjectRecord(input: {
  supabase: Supabase
  subjectId: string
  payload: Record<string, unknown>
}) {
  const { error } = await input.supabase.from('study_subjects').update(input.payload).eq('id', input.subjectId)
  if (error) throw new Error(error.message)
}

export async function requestProcedureSignatureLink(input: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  studyId: string
  visitId: string
  subjectId: string
  actorUserId: string
  requestId: string
}) {
  const { error } = await input.supabase
    .from('procedure_executions')
    .update({ signature_request_id: input.requestId })
    .eq('id', input.procedureExecutionId)
    .eq('organization_id', input.organizationId)

  if (error) throw new Error(error.message)

  await logProcedureOperationalEvent({
    supabase: input.supabase,
    procedure: {
      id: input.procedureExecutionId,
      organization_id: input.organizationId,
      study_id: input.studyId,
      visit_id: input.visitId,
    },
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.SIGNATURE_REQUESTED,
    payload: {
      signature_request_id: input.requestId,
      subject_id: input.subjectId,
    },
  })
}
