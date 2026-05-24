'use server'

import { revalidatePath } from 'next/cache'
import { subjectChartRevalidatePaths } from '@/lib/ops/paths'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { writeProfileEvent } from '@/lib/subject/clinical-profile/audit'
import {
  DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
  resolveClinicalProfileSourceAttribution,
} from '@/lib/subject/clinical-profile/defaults'
import type { SubjectAdverseEventInput } from '@/lib/subject/adverse-events/registry-types'
import { createServerClient } from '@/lib/supabase/server'

async function resolveActorAndOrg(study_subject_id: string): Promise<{
  userId: string
  organizationId: string
  studyId: string
  supabase: Awaited<ReturnType<typeof createServerClient>>
}> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('organization_id, study_id')
    .eq('id', study_subject_id)
    .maybeSingle()

  if (error || !subject) {
    throw new Error('Access denied: subject not found or not accessible.')
  }

  return {
    userId: user.id,
    organizationId: subject.organization_id as string,
    studyId: subject.study_id as string,
    supabase,
  }
}

async function revalidateAePaths(study_subject_id: string) {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('study_subjects')
    .select('study_id')
    .eq('id', study_subject_id)
    .maybeSingle()
  const studyId = (data?.study_id as string | null) ?? null
  for (const path of subjectChartRevalidatePaths(study_subject_id, studyId)) {
    revalidatePath(path)
  }
}

function normalizeInput(input: SubjectAdverseEventInput): SubjectAdverseEventInput {
  return {
    ...input,
    event_term: input.event_term.trim(),
    preferred_term: input.preferred_term?.trim() || null,
    source_attribution: resolveClinicalProfileSourceAttribution(
      input.source_attribution,
      'Subject-reported / AE workspace',
    ),
    visit_id: input.visit_id?.trim() || null,
    onset_date: input.onset_date?.trim() || null,
    resolution_date: input.resolution_date?.trim() || null,
    comments: input.comments?.trim() || null,
  }
}

export async function addSubjectAdverseEvent(
  study_subject_id: string,
  input: SubjectAdverseEventInput,
): Promise<{ id: string }> {
  const payload = normalizeInput(input)
  if (!payload.event_term) throw new Error('AE term is required.')

  const { userId, organizationId, studyId, supabase } = await resolveActorAndOrg(study_subject_id)

  const { data, error } = await supabase
    .from('subject_adverse_events')
    .insert({
      organization_id: organizationId,
      study_subject_id,
      created_by: userId,
      visit_id: payload.visit_id,
      event_term: payload.event_term,
      preferred_term: payload.preferred_term,
      severity: payload.severity,
      seriousness: payload.seriousness ?? false,
      relationship_to_ip: payload.relationship_to_ip,
      lifecycle_status: payload.lifecycle_status ?? 'open',
      onset_date: payload.onset_date,
      resolution_date: payload.resolution_date,
      source_attribution: payload.source_attribution,
      comments: payload.comments,
    })
    .select('ae_id')
    .single()

  if (error) throw new Error(`addSubjectAdverseEvent: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'adverse_events',
    record_id: data.ae_id,
    event_type: 'created',
    after_snapshot: { ...payload, study_subject_id, ae_id: data.ae_id } as Record<
      string,
      unknown
    >,
    source_attribution: payload.source_attribution,
  })

  await ClinicalMutationGateway.emitProfileBridge({
    supabase,
    organizationId,
    studyId,
    subjectId: study_subject_id,
    actorUserId: userId,
    eventType: OPERATIONAL_EVENT_TYPES.ADVERSE_EVENT_CREATED,
    payloadSource: 'adverse-events',
    mutation: 'adverse_events.create',
    visitId: payload.visit_id,
    profileSection: 'adverse_events',
    profileEventType: 'created',
    recordId: data.ae_id,
    details: {
      event_term: payload.event_term,
      severity: payload.severity,
      seriousness: payload.seriousness,
      lifecycle_status: payload.lifecycle_status,
    },
  })

  await revalidateAePaths(study_subject_id)
  return { id: data.ae_id }
}

export async function updateSubjectAdverseEvent(
  ae_id: string,
  study_subject_id: string,
  input: Partial<SubjectAdverseEventInput> & { change_reason: string },
): Promise<void> {
  const { userId, organizationId, studyId, supabase } = await resolveActorAndOrg(study_subject_id)

  const { data: before, error: fetchError } = await supabase
    .from('subject_adverse_events')
    .select('*')
    .eq('ae_id', ae_id)
    .eq('study_subject_id', study_subject_id)
    .single()

  if (fetchError) throw new Error(`updateSubjectAdverseEvent fetch: ${fetchError.message}`)

  const { change_reason, ...rawFields } = input
  const fields: Record<string, unknown> = {}
  if (rawFields.event_term !== undefined) fields.event_term = rawFields.event_term.trim()
  if (rawFields.preferred_term !== undefined) {
    fields.preferred_term = rawFields.preferred_term?.trim() || null
  }
  if (rawFields.severity !== undefined) fields.severity = rawFields.severity
  if (rawFields.seriousness !== undefined) fields.seriousness = rawFields.seriousness
  if (rawFields.relationship_to_ip !== undefined) {
    fields.relationship_to_ip = rawFields.relationship_to_ip
  }
  if (rawFields.lifecycle_status !== undefined) {
    fields.lifecycle_status = rawFields.lifecycle_status
  }
  if (rawFields.visit_id !== undefined) fields.visit_id = rawFields.visit_id?.trim() || null
  if (rawFields.onset_date !== undefined) fields.onset_date = rawFields.onset_date?.trim() || null
  if (rawFields.resolution_date !== undefined) {
    fields.resolution_date = rawFields.resolution_date?.trim() || null
  }
  if (rawFields.source_attribution !== undefined) {
    fields.source_attribution = resolveClinicalProfileSourceAttribution(
      rawFields.source_attribution,
      DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
    )
  }
  if (rawFields.comments !== undefined) fields.comments = rawFields.comments?.trim() || null

  const { error } = await supabase
    .from('subject_adverse_events')
    .update(fields)
    .eq('ae_id', ae_id)
    .eq('study_subject_id', study_subject_id)

  if (error) throw new Error(`updateSubjectAdverseEvent: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'adverse_events',
    record_id: ae_id,
    event_type: 'updated',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, ...fields } as Record<string, unknown>,
    change_reason,
    source_attribution:
      (fields.source_attribution as string | undefined) ??
      (before.source_attribution as string | null),
  })

  await ClinicalMutationGateway.emitProfileBridge({
    supabase,
    organizationId,
    studyId,
    subjectId: study_subject_id,
    actorUserId: userId,
    eventType: OPERATIONAL_EVENT_TYPES.ADVERSE_EVENT_UPDATED,
    payloadSource: 'adverse-events',
    mutation: 'adverse_events.update',
    visitId: (fields.visit_id as string | undefined) ?? (before.visit_id as string | null),
    profileSection: 'adverse_events',
    profileEventType: 'updated',
    recordId: ae_id,
    details: {
      change_reason,
      updated_fields: Object.keys(fields),
      lifecycle_status:
        (fields.lifecycle_status as string | undefined) ??
        (before.lifecycle_status as string | null),
    },
  })

  await revalidateAePaths(study_subject_id)
}
