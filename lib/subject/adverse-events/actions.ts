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
    ae_type: input.ae_type?.trim() || null,
    expectedness: input.expectedness?.trim() || null,
    action_taken: input.action_taken?.trim() || null,
    outcome: input.outcome?.trim() || null,
    comments: input.comments?.trim() || null,
  }
}

export async function addSubjectAdverseEvent(
  study_subject_id: string,
  input: SubjectAdverseEventInput,
): Promise<{ id: string }> {
  const payload = normalizeInput(input)
  if (!payload.event_term) throw new Error('AE term is required.')
  if (payload.ongoing && payload.resolution_date) {
    throw new Error('Adverse event: Stop Date must be empty when Ongoing is selected.')
  }
  if (payload.ongoing === false && !payload.resolution_date) {
    throw new Error('Adverse event: Stop Date is required when Ongoing is not selected.')
  }

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
      ae_type: payload.ae_type,
      severity: payload.severity,
      seriousness: payload.seriousness ?? false,
      relationship_to_ip: payload.relationship_to_ip,
      expectedness: payload.expectedness,
      action_taken: payload.action_taken,
      outcome: payload.outcome,
      ongoing: payload.ongoing ?? !payload.resolution_date,
      requires_pi_si_review: payload.requires_pi_si_review ?? false,
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
  if (rawFields.ongoing && rawFields.resolution_date) {
    throw new Error('Adverse event: Stop Date must be empty when Ongoing is selected.')
  }
  if (rawFields.ongoing === false && !rawFields.resolution_date) {
    throw new Error('Adverse event: Stop Date is required when Ongoing is not selected.')
  }
  const fields: Record<string, unknown> = {}
  if (rawFields.event_term !== undefined) fields.event_term = rawFields.event_term.trim()
  if (rawFields.preferred_term !== undefined) {
    fields.preferred_term = rawFields.preferred_term?.trim() || null
  }
  if (rawFields.severity !== undefined) fields.severity = rawFields.severity
  if (rawFields.seriousness !== undefined) fields.seriousness = rawFields.seriousness
  if (rawFields.ae_type !== undefined) fields.ae_type = rawFields.ae_type?.trim() || null
  if (rawFields.relationship_to_ip !== undefined) {
    fields.relationship_to_ip = rawFields.relationship_to_ip
  }
  if (rawFields.expectedness !== undefined) fields.expectedness = rawFields.expectedness?.trim() || null
  if (rawFields.action_taken !== undefined) fields.action_taken = rawFields.action_taken?.trim() || null
  if (rawFields.outcome !== undefined) fields.outcome = rawFields.outcome?.trim() || null
  if (rawFields.ongoing !== undefined) fields.ongoing = rawFields.ongoing
  if (rawFields.requires_pi_si_review !== undefined) {
    fields.requires_pi_si_review = rawFields.requires_pi_si_review
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
