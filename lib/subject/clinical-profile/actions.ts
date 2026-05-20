'use server'
// lib/subject/clinical-profile/actions.ts
// Server actions for all 5 Subject Clinical Profile sections.
// Every mutation:
//   1. Authenticates the session user.
//   2. Resolves and validates the organization_id from the subject record (no placeholder UUIDs).
//   3. Writes an audit event via writeProfileEvent() (ALCOA+).
//   4. Revalidates canonical subject chart paths (tab + legacy redirect route).
// change_reason is required for 'updated' and 'status_changed' events.

import { subjectChartRevalidatePaths } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeProfileEvent } from './audit'
import type {
  MedicalHistoryInput,
  ConMedInput,
  AllergyInput,
  SurgicalHistoryInput,
  LifestyleInput,
} from './types'

// ---------------------------------------------------------------------------
// Auth + tenancy guard
// ---------------------------------------------------------------------------

/**
 * Resolves the authenticated user and the real organization_id for a study
 * subject.  Throws a safe 401/403 error on any mismatch — never relies on a
 * placeholder UUID or on the DB trigger alone.
 *
 * Returns { userId, organizationId } so callers can include the correct
 * organization_id in every INSERT without touching the trigger.
 */
async function resolveActorAndOrg(study_subject_id: string): Promise<{
  userId: string
  organizationId: string
}> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Resolve the real organization_id from the subject record.
  // RLS ensures the current user can only see subjects in their org.
  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('organization_id')
    .eq('id', study_subject_id)
    .maybeSingle()

  if (error || !subject) {
    throw new Error('Access denied: subject not found or not accessible.')
  }

  return {
    userId: user.id,
    organizationId: subject.organization_id as string,
  }
}

async function revalidateProfilePaths(study_subject_id: string) {
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

// ---------------------------------------------------------------------------
// Medical History
// ---------------------------------------------------------------------------

export async function addMedicalHistory(
  study_subject_id: string,
  input: MedicalHistoryInput,
): Promise<{ id: string }> {
  const { userId, organizationId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_medical_history')
    .insert({
      organization_id: organizationId,
      study_subject_id,
      created_by: userId,
      ...input,
    })
    .select('subject_history_id')
    .single()

  if (error) throw new Error(`addMedicalHistory: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'medical_history',
    record_id: data.subject_history_id,
    event_type: 'created',
    after_snapshot: { ...input, study_subject_id },
    source_attribution: input.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
  return { id: data.subject_history_id }
}

export async function updateMedicalHistory(
  subject_history_id: string,
  study_subject_id: string,
  input: Partial<MedicalHistoryInput> & { change_reason: string },
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_medical_history')
    .select('*')
    .eq('subject_history_id', subject_history_id)
    .single()
  if (fetchError) throw new Error(`updateMedicalHistory fetch: ${fetchError.message}`)

  const { change_reason, ...fields } = input
  const { error } = await supabase
    .from('subject_medical_history')
    .update(fields)
    .eq('subject_history_id', subject_history_id)

  if (error) throw new Error(`updateMedicalHistory: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'medical_history',
    record_id: subject_history_id,
    event_type: 'updated',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, ...fields } as Record<string, unknown>,
    change_reason,
    source_attribution: input.source_attribution ?? before.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
}

export async function resolveMedicalHistory(
  subject_history_id: string,
  study_subject_id: string,
  end_date: string | null,
  change_reason: string,
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_medical_history')
    .select('*')
    .eq('subject_history_id', subject_history_id)
    .single()
  if (fetchError) throw new Error(`resolveMedicalHistory fetch: ${fetchError.message}`)

  const { error } = await supabase
    .from('subject_medical_history')
    .update({ status: 'resolved', ongoing: false, end_date })
    .eq('subject_history_id', subject_history_id)

  if (error) throw new Error(`resolveMedicalHistory: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'medical_history',
    record_id: subject_history_id,
    event_type: 'status_changed',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, status: 'resolved', ongoing: false, end_date } as Record<string, unknown>,
    change_reason,
  })

  await revalidateProfilePaths(study_subject_id)
}

export async function verifyProfileEntry(
  section: 'medical_history' | 'conmeds' | 'allergies' | 'surgical_history',
  record_id: string,
  study_subject_id: string,
  actor_role: string,
): Promise<void> {
  const { userId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const tableMap = {
    medical_history: 'subject_medical_history',
    conmeds: 'subject_concomitant_medications',
    allergies: 'subject_allergies',
    surgical_history: 'subject_surgical_history',
  } as const

  const pkMap = {
    medical_history: 'subject_history_id',
    conmeds: 'conmed_id',
    allergies: 'allergy_id',
    surgical_history: 'surgical_history_id',
  } as const

  const table = tableMap[section]
  const pk = pkMap[section]

  const { data: before, error: fetchError } = await supabase
    .from(table)
    .select('*')
    .eq(pk, record_id)
    .single()
  if (fetchError) throw new Error(`verifyProfileEntry fetch: ${fetchError.message}`)

  const { error } = await supabase
    .from(table)
    .update({ verified_by: userId, verified_at: new Date().toISOString() })
    .eq(pk, record_id)

  if (error) throw new Error(`verifyProfileEntry: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section,
    record_id,
    event_type: 'verified',
    actor_role,
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, verified_by: userId, verified_at: new Date().toISOString() } as Record<string, unknown>,
  })

  await revalidateProfilePaths(study_subject_id)
}

// ---------------------------------------------------------------------------
// ConMeds
// ---------------------------------------------------------------------------

export async function addConMed(
  study_subject_id: string,
  input: ConMedInput,
): Promise<{ id: string }> {
  const { userId, organizationId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_concomitant_medications')
    .insert({
      organization_id: organizationId,
      study_subject_id,
      created_by: userId,
      ...input,
    })
    .select('conmed_id')
    .single()

  if (error) throw new Error(`addConMed: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'conmeds',
    record_id: data.conmed_id,
    event_type: 'created',
    after_snapshot: { ...input, study_subject_id } as Record<string, unknown>,
    source_attribution: input.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
  return { id: data.conmed_id }
}

export async function updateConMed(
  conmed_id: string,
  study_subject_id: string,
  input: Partial<ConMedInput> & { change_reason: string },
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_concomitant_medications')
    .select('*')
    .eq('conmed_id', conmed_id)
    .single()
  if (fetchError) throw new Error(`updateConMed fetch: ${fetchError.message}`)

  const { change_reason, ...fields } = input
  const { error } = await supabase
    .from('subject_concomitant_medications')
    .update(fields)
    .eq('conmed_id', conmed_id)

  if (error) throw new Error(`updateConMed: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'conmeds',
    record_id: conmed_id,
    event_type: 'updated',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, ...fields } as Record<string, unknown>,
    change_reason,
    source_attribution: input.source_attribution ?? before.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
}

export async function discontinueConMed(
  conmed_id: string,
  study_subject_id: string,
  stop_date: string | null,
  reason_stopped: string,
  change_reason: string,
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_concomitant_medications')
    .select('*')
    .eq('conmed_id', conmed_id)
    .single()
  if (fetchError) throw new Error(`discontinueConMed fetch: ${fetchError.message}`)

  const { error } = await supabase
    .from('subject_concomitant_medications')
    .update({ status: 'discontinued', ongoing: false, stop_date, reason_stopped })
    .eq('conmed_id', conmed_id)

  if (error) throw new Error(`discontinueConMed: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'conmeds',
    record_id: conmed_id,
    event_type: 'status_changed',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, status: 'discontinued', ongoing: false, stop_date, reason_stopped } as Record<string, unknown>,
    change_reason,
  })

  await revalidateProfilePaths(study_subject_id)
}

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------

export async function addAllergy(
  study_subject_id: string,
  input: AllergyInput,
): Promise<{ id: string }> {
  const { userId, organizationId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_allergies')
    .insert({
      organization_id: organizationId,
      study_subject_id,
      created_by: userId,
      ...input,
    })
    .select('allergy_id')
    .single()

  if (error) throw new Error(`addAllergy: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'allergies',
    record_id: data.allergy_id,
    event_type: 'created',
    after_snapshot: { ...input, study_subject_id } as Record<string, unknown>,
    source_attribution: input.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
  return { id: data.allergy_id }
}

export async function updateAllergy(
  allergy_id: string,
  study_subject_id: string,
  input: Partial<AllergyInput> & { change_reason: string },
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_allergies')
    .select('*')
    .eq('allergy_id', allergy_id)
    .single()
  if (fetchError) throw new Error(`updateAllergy fetch: ${fetchError.message}`)

  const { change_reason, ...fields } = input
  const { error } = await supabase
    .from('subject_allergies')
    .update(fields)
    .eq('allergy_id', allergy_id)

  if (error) throw new Error(`updateAllergy: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'allergies',
    record_id: allergy_id,
    event_type: 'updated',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, ...fields } as Record<string, unknown>,
    change_reason,
  })

  await revalidateProfilePaths(study_subject_id)
}

// ---------------------------------------------------------------------------
// Surgical History
// ---------------------------------------------------------------------------

export async function addSurgicalHistory(
  study_subject_id: string,
  input: SurgicalHistoryInput,
): Promise<{ id: string }> {
  const { userId, organizationId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('subject_surgical_history')
    .insert({
      organization_id: organizationId,
      study_subject_id,
      created_by: userId,
      date_precision: input.date_precision ?? 'exact',
      ...input,
    })
    .select('surgical_history_id')
    .single()

  if (error) throw new Error(`addSurgicalHistory: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'surgical_history',
    record_id: data.surgical_history_id,
    event_type: 'created',
    after_snapshot: { ...input, study_subject_id } as Record<string, unknown>,
    source_attribution: input.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
  return { id: data.surgical_history_id }
}

export async function updateSurgicalHistory(
  surgical_history_id: string,
  study_subject_id: string,
  input: Partial<SurgicalHistoryInput> & { change_reason: string },
): Promise<void> {
  await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  const { data: before, error: fetchError } = await supabase
    .from('subject_surgical_history')
    .select('*')
    .eq('surgical_history_id', surgical_history_id)
    .single()
  if (fetchError) throw new Error(`updateSurgicalHistory fetch: ${fetchError.message}`)

  const { change_reason, ...fields } = input
  const { error } = await supabase
    .from('subject_surgical_history')
    .update(fields)
    .eq('surgical_history_id', surgical_history_id)

  if (error) throw new Error(`updateSurgicalHistory: ${error.message}`)

  await writeProfileEvent({
    study_subject_id,
    section: 'surgical_history',
    record_id: surgical_history_id,
    event_type: 'updated',
    before_snapshot: before as Record<string, unknown>,
    after_snapshot: { ...before, ...fields } as Record<string, unknown>,
    change_reason,
  })

  await revalidateProfilePaths(study_subject_id)
}

// ---------------------------------------------------------------------------
// Lifestyle (upsert)
// ---------------------------------------------------------------------------

export async function upsertLifestyle(
  study_subject_id: string,
  input: LifestyleInput,
): Promise<void> {
  const { userId, organizationId } = await resolveActorAndOrg(study_subject_id)
  const supabase = await createServerClient()

  // Fetch existing for before_snapshot
  const { data: existing } = await supabase
    .from('subject_lifestyle')
    .select('*')
    .eq('study_subject_id', study_subject_id)
    .maybeSingle()

  const { error } = await supabase
    .from('subject_lifestyle')
    .upsert(
      {
        organization_id: organizationId,
        study_subject_id,
        last_updated_by: userId,
        ...input,
      },
      { onConflict: 'study_subject_id' },
    )

  if (error) throw new Error(`upsertLifestyle: ${error.message}`)

  // Fetch the resulting row for the after_snapshot
  const { data: after } = await supabase
    .from('subject_lifestyle')
    .select('*')
    .eq('study_subject_id', study_subject_id)
    .single()

  await writeProfileEvent({
    study_subject_id,
    section: 'lifestyle',
    record_id: after?.lifestyle_id ?? study_subject_id,
    event_type: existing ? 'updated' : 'created',
    before_snapshot: existing ? (existing as Record<string, unknown>) : null,
    after_snapshot: (after ?? input) as Record<string, unknown>,
    source_attribution: input.source_attribution,
  })

  await revalidateProfilePaths(study_subject_id)
}
