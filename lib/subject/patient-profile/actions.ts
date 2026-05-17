'use server'

import { revalidatePath } from 'next/cache'
import {
  getOrganizationMemberships,
  getSessionUser,
} from '@/lib/auth/session'
import type {
  MedicationCatalogHit,
  PathologyCatalogHit,
  PatientProfileActionResult,
  SubjectConmedRow,
  SubjectMedicalHistoryRow,
} from '@/lib/subject/patient-profile/types'
import { createServerClient } from '@/lib/supabase/server'

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, ' ').trim()
}

async function resolveOrgContext(organizationId: string) {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false as const, error: 'Sign in required.' }
  }

  const orgId = organizationId.trim()
  if (!orgId) {
    return { ok: false as const, error: 'Organization is required.' }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!memberships.some((m) => m.organization_id === orgId)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }

  const supabase = await createServerClient()
  return { ok: true as const, user, organizationId: orgId, supabase }
}

async function assertSubjectInOrg(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  studySubjectId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id, organization_id')
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: 'Subject not found in this organization.' }
  return { ok: true as const }
}

function subjectPath(studySubjectId: string) {
  return `/subjects/${studySubjectId}`
}

function mapHistoryRow(row: Record<string, unknown>): SubjectMedicalHistoryRow {
  const lib = row.pathology_library as
    | { common_name: string; medical_name: string | null; icd10_code: string | null }
    | { common_name: string; medical_name: string | null; icd10_code: string | null }[]
    | null

  const pathology = Array.isArray(lib) ? lib[0] : lib
  const custom = (row.custom_condition_name as string | null) ?? null
  const displayName = pathology?.common_name ?? custom ?? 'Condition'

  return {
    subjectHistoryId: row.subject_history_id as string,
    organizationId: row.organization_id as string,
    studySubjectId: row.study_subject_id as string,
    pathologyId: (row.pathology_id as string | null) ?? null,
    customConditionName: custom,
    startDate: (row.onset_date as string | null) ?? null,
    ongoing: Boolean(row.ongoing),
    stopDate: (row.end_date as string | null) ?? null,
    clinicallySignificant:
      row.clinically_significant === null || row.clinically_significant === undefined
        ? null
        : Boolean(row.clinically_significant),
    comments: (row.comments as string | null) ?? null,
    displayName,
    libraryLabel: pathology
      ? [pathology.common_name, pathology.medical_name, pathology.icd10_code]
          .filter(Boolean)
          .join(' · ')
      : null,
    updatedAt: row.updated_at as string,
  }
}

function mapConmedRow(row: Record<string, unknown>): SubjectConmedRow {
  const lib = row.medication_library as
    | {
        medication_name: string
        brand_name: string | null
        drug_class: string | null
        route: string | null
      }
    | {
        medication_name: string
        brand_name: string | null
        drug_class: string | null
        route: string | null
      }[]
    | null

  const med = Array.isArray(lib) ? lib[0] : lib
  const custom = (row.custom_medication_name as string | null) ?? null
  const displayName = med?.medication_name ?? custom ?? 'Medication'

  return {
    conmedId: row.conmed_id as string,
    organizationId: row.organization_id as string,
    studySubjectId: row.study_subject_id as string,
    medicationId: (row.medication_id as string | null) ?? null,
    customMedicationName: custom,
    indicationHistoryId: (row.indication_history_id as string | null) ?? null,
    indicationText: (row.indication_text as string | null) ?? null,
    dose: (row.dose as string | null) ?? null,
    doseUnit: (row.dose_unit as string | null) ?? null,
    frequency: (row.frequency as string | null) ?? null,
    route: (row.route as string | null) ?? null,
    startDate: (row.start_date as string | null) ?? null,
    ongoing: Boolean(row.ongoing),
    stopDate: (row.stop_date as string | null) ?? null,
    comments: (row.comments as string | null) ?? null,
    displayName,
    libraryLabel: med
      ? [med.medication_name, med.brand_name, med.drug_class].filter(Boolean).join(' · ')
      : null,
    updatedAt: row.updated_at as string,
  }
}

export async function searchPathologyCatalogAction(
  query: string,
): Promise<PatientProfileActionResult<PathologyCatalogHit[]>> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const q = escapeIlike(query)
  if (q.length < 2) return { ok: true, data: [] }

  const supabase = await createServerClient()
  const pattern = `%${q}%`
  const { data, error } = await supabase
    .from('pathology_library')
    .select('pathology_id, common_name, medical_name, icd10_code, system')
    .eq('active_flag', true)
    .or(
      `common_name.ilike.${pattern},medical_name.ilike.${pattern},synonyms.ilike.${pattern}`,
    )
    .order('common_name')
    .limit(25)

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      pathologyId: row.pathology_id as string,
      commonName: row.common_name as string,
      medicalName: (row.medical_name as string | null) ?? null,
      icd10Code: (row.icd10_code as string | null) ?? null,
      system: row.system as string,
    })),
  }
}

export async function searchMedicationCatalogAction(
  query: string,
): Promise<PatientProfileActionResult<MedicationCatalogHit[]>> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const q = escapeIlike(query)
  if (q.length < 2) return { ok: true, data: [] }

  const supabase = await createServerClient()
  const pattern = `%${q}%`
  const { data, error } = await supabase
    .from('medication_library')
    .select('medication_id, medication_name, brand_name, drug_class, route, dosage_form')
    .eq('active_flag', true)
    .or(
      `medication_name.ilike.${pattern},brand_name.ilike.${pattern},drug_class.ilike.${pattern}`,
    )
    .order('medication_name')
    .limit(25)

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      medicationId: row.medication_id as string,
      medicationName: row.medication_name as string,
      brandName: (row.brand_name as string | null) ?? null,
      drugClass: (row.drug_class as string | null) ?? null,
      route: (row.route as string | null) ?? null,
      dosageForm: (row.dosage_form as string | null) ?? null,
    })),
  }
}

export async function listSubjectMedicalHistoryAction(
  studySubjectId: string,
  organizationId: string,
): Promise<PatientProfileActionResult<SubjectMedicalHistoryRow[]>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const subjectCheck = await assertSubjectInOrg(ctx.supabase, studySubjectId, organizationId)
  if (!subjectCheck.ok) return subjectCheck

  const { data, error } = await ctx.supabase
    .from('subject_medical_history')
    .select(
      `
      subject_history_id,
      organization_id,
      study_subject_id,
      pathology_id,
      custom_condition_name,
      onset_date,
      ongoing,
      end_date,
      clinically_significant,
      comments,
      updated_at,
      pathology_library ( common_name, medical_name, icd10_code )
    `,
    )
    .eq('study_subject_id', studySubjectId)
    .eq('organization_id', organizationId)
    .order('ongoing', { ascending: false })
    .order('onset_date', { ascending: false, nullsFirst: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map((row) => mapHistoryRow(row as Record<string, unknown>)) }
}

export async function listSubjectConmedsAction(
  studySubjectId: string,
  organizationId: string,
): Promise<PatientProfileActionResult<SubjectConmedRow[]>> {
  const ctx = await resolveOrgContext(organizationId)
  if (!ctx.ok) return ctx

  const subjectCheck = await assertSubjectInOrg(ctx.supabase, studySubjectId, organizationId)
  if (!subjectCheck.ok) return subjectCheck

  const { data, error } = await ctx.supabase
    .from('subject_concomitant_medications')
    .select(
      `
      conmed_id,
      organization_id,
      study_subject_id,
      medication_id,
      custom_medication_name,
      indication_history_id,
      indication_text,
      dose,
      dose_unit,
      frequency,
      route,
      start_date,
      ongoing,
      stop_date,
      comments,
      updated_at,
      medication_library ( medication_name, brand_name, drug_class, route )
    `,
    )
    .eq('study_subject_id', studySubjectId)
    .eq('organization_id', organizationId)
    .order('ongoing', { ascending: false })
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map((row) => mapConmedRow(row as Record<string, unknown>)) }
}

type SaveHistoryInput = {
  organizationId: string
  studySubjectId: string
  subjectHistoryId?: string | null
  pathologyId?: string | null
  customConditionName?: string | null
  startDate?: string | null
  ongoing: boolean
  stopDate?: string | null
  clinicallySignificant?: boolean | null
  comments?: string | null
}

function validateHistoryInput(input: SaveHistoryInput): string | null {
  const hasLibrary = Boolean(input.pathologyId?.trim())
  const custom = input.customConditionName?.trim() ?? ''
  if (!hasLibrary && !custom) {
    return 'Select a condition from the catalog or enter a custom condition name.'
  }
  if (!input.ongoing && input.stopDate && input.startDate && input.stopDate < input.startDate) {
    return 'Stop date must be on or after start date.'
  }
  return null
}

export async function saveSubjectMedicalHistoryAction(
  input: SaveHistoryInput,
): Promise<PatientProfileActionResult<SubjectMedicalHistoryRow>> {
  const validationError = validateHistoryInput(input)
  if (validationError) return { ok: false, error: validationError }

  const ctx = await resolveOrgContext(input.organizationId)
  if (!ctx.ok) return ctx

  const subjectCheck = await assertSubjectInOrg(
    ctx.supabase,
    input.studySubjectId,
    input.organizationId,
  )
  if (!subjectCheck.ok) return subjectCheck

  const endDate = input.ongoing ? null : input.stopDate?.trim() || null
  const payload = {
    organization_id: input.organizationId,
    study_subject_id: input.studySubjectId,
    pathology_id: input.pathologyId?.trim() || null,
    custom_condition_name: input.pathologyId?.trim()
      ? null
      : input.customConditionName?.trim() || null,
    onset_date: input.startDate?.trim() || null,
    ongoing: input.ongoing,
    end_date: endDate,
    clinically_significant: input.clinicallySignificant ?? null,
    comments: input.comments?.trim() || null,
  }

  const historyId = input.subjectHistoryId?.trim()

  if (historyId) {
    const { data, error } = await ctx.supabase
      .from('subject_medical_history')
      .update({
        pathology_id: payload.pathology_id,
        custom_condition_name: payload.custom_condition_name,
        onset_date: payload.onset_date,
        ongoing: payload.ongoing,
        end_date: payload.end_date,
        clinically_significant: payload.clinically_significant,
        comments: payload.comments,
      })
      .eq('subject_history_id', historyId)
      .eq('study_subject_id', input.studySubjectId)
      .eq('organization_id', input.organizationId)
      .select(
        `
        subject_history_id,
        organization_id,
        study_subject_id,
        pathology_id,
        custom_condition_name,
        onset_date,
        ongoing,
        end_date,
        clinically_significant,
        comments,
        updated_at,
        pathology_library ( common_name, medical_name, icd10_code )
      `,
      )
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Medical history row not found.' }
    revalidatePath(subjectPath(input.studySubjectId))
    return { ok: true, data: mapHistoryRow(data as Record<string, unknown>) }
  }

  const { data, error } = await ctx.supabase
    .from('subject_medical_history')
    .insert({
      ...payload,
      created_by: ctx.user.id,
    })
    .select(
      `
      subject_history_id,
      organization_id,
      study_subject_id,
      pathology_id,
      custom_condition_name,
      onset_date,
      ongoing,
      end_date,
      clinically_significant,
      comments,
      updated_at,
      pathology_library ( common_name, medical_name, icd10_code )
    `,
    )
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath(subjectPath(input.studySubjectId))
  return { ok: true, data: mapHistoryRow(data as Record<string, unknown>) }
}

type SaveConmedInput = {
  organizationId: string
  studySubjectId: string
  conmedId?: string | null
  medicationId?: string | null
  customMedicationName?: string | null
  indicationHistoryId?: string | null
  indicationText?: string | null
  dose?: string | null
  doseUnit?: string | null
  frequency?: string | null
  route?: string | null
  startDate?: string | null
  ongoing: boolean
  stopDate?: string | null
  comments?: string | null
}

function validateConmedInput(input: SaveConmedInput): string | null {
  const hasLibrary = Boolean(input.medicationId?.trim())
  const custom = input.customMedicationName?.trim() ?? ''
  if (!hasLibrary && !custom) {
    return 'Select a medication from the catalog or enter a custom medication name.'
  }
  if (!input.ongoing && input.stopDate && input.startDate && input.stopDate < input.startDate) {
    return 'Stop date must be on or after start date.'
  }
  return null
}

export async function saveSubjectConmedAction(
  input: SaveConmedInput,
): Promise<PatientProfileActionResult<SubjectConmedRow>> {
  const validationError = validateConmedInput(input)
  if (validationError) return { ok: false, error: validationError }

  const ctx = await resolveOrgContext(input.organizationId)
  if (!ctx.ok) return ctx

  const subjectCheck = await assertSubjectInOrg(
    ctx.supabase,
    input.studySubjectId,
    input.organizationId,
  )
  if (!subjectCheck.ok) return subjectCheck

  const stopDate = input.ongoing ? null : input.stopDate?.trim() || null
  const payload = {
    organization_id: input.organizationId,
    study_subject_id: input.studySubjectId,
    medication_id: input.medicationId?.trim() || null,
    custom_medication_name: input.medicationId?.trim()
      ? null
      : input.customMedicationName?.trim() || null,
    indication_history_id: input.indicationHistoryId?.trim() || null,
    indication_text: input.indicationText?.trim() || null,
    dose: input.dose?.trim() || null,
    dose_unit: input.doseUnit?.trim() || null,
    frequency: input.frequency?.trim() || null,
    route: input.route?.trim() || null,
    start_date: input.startDate?.trim() || null,
    ongoing: input.ongoing,
    stop_date: stopDate,
    comments: input.comments?.trim() || null,
  }

  const conmedId = input.conmedId?.trim()

  if (conmedId) {
    const { data, error } = await ctx.supabase
      .from('subject_concomitant_medications')
      .update(payload)
      .eq('conmed_id', conmedId)
      .eq('study_subject_id', input.studySubjectId)
      .eq('organization_id', input.organizationId)
      .select(
        `
        conmed_id,
        organization_id,
        study_subject_id,
        medication_id,
        custom_medication_name,
        indication_history_id,
        indication_text,
        dose,
        dose_unit,
        frequency,
        route,
        start_date,
        ongoing,
        stop_date,
        comments,
        updated_at,
        medication_library ( medication_name, brand_name, drug_class, route )
      `,
      )
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Concomitant medication row not found.' }
    revalidatePath(subjectPath(input.studySubjectId))
    return { ok: true, data: mapConmedRow(data as Record<string, unknown>) }
  }

  const { data, error } = await ctx.supabase
    .from('subject_concomitant_medications')
    .insert({
      ...payload,
      created_by: ctx.user.id,
    })
    .select(
      `
      conmed_id,
      organization_id,
      study_subject_id,
      medication_id,
      custom_medication_name,
      indication_history_id,
      indication_text,
      dose,
      dose_unit,
      frequency,
      route,
      start_date,
      ongoing,
      stop_date,
      comments,
      updated_at,
      medication_library ( medication_name, brand_name, drug_class, route )
    `,
    )
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath(subjectPath(input.studySubjectId))
  return { ok: true, data: mapConmedRow(data as Record<string, unknown>) }
}
