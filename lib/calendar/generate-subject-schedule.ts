import { createServerClient } from '@/lib/supabase/server'
import { addCalendarDays } from '@/lib/visits/calculateVisitWindows'

export type GenerateSubjectScheduleInput = {
  organizationId: string
  studyId: string
  subjectId: string
  anchorVisitDefinitionId: string
  anchorStudyDay: number
  anchorDate: string
  assignedUserId?: string | null
}

export type GenerateSubjectScheduleResult = {
  ok: boolean
  createdCount: number
  updatedCount: number
  skippedManualOverrideCount: number
  skippedExistingCount: number
  error?: string
}

type VisitDefinitionRow = {
  id: string
  code: string | null
  label: string | null
  sort_order: number | null
  target_day: number | null
  window_min_offset: number | null
  window_max_offset: number | null
}

type ScheduledVisitRow = {
  id: string
  visit_definition_id: string
  manual_override: boolean | null
}

function normalizeStudyDay(definition: VisitDefinitionRow, fallbackIndex: number): number {
  if (typeof definition.target_day === 'number' && Number.isFinite(definition.target_day)) {
    return Math.trunc(definition.target_day)
  }
  return fallbackIndex + 1
}

function normalizeVisitNumber(definition: VisitDefinitionRow): string | null {
  if (definition.code) return definition.code
  const match = definition.label?.match(/\bvisit\s*([0-9a-z.-]+)/i)
  return match?.[1] ?? null
}

function normalizeModality(definition: VisitDefinitionRow): 'onsite' | 'phone' | 'remote' | 'vendor' | 'unspecified' {
  const text = `${definition.code ?? ''} ${definition.label ?? ''}`.toLowerCase()
  if (text.includes('phone') || text.includes('call')) return 'phone'
  if (text.includes('remote') || text.includes('tele')) return 'remote'
  if (text.includes('vendor')) return 'vendor'
  if (text.trim()) return 'onsite'
  return 'unspecified'
}

export async function generateSubjectSchedule(
  input: GenerateSubjectScheduleInput,
): Promise<GenerateSubjectScheduleResult> {
  const supabase = await createServerClient()
  const anchorStudyDay = Math.trunc(input.anchorStudyDay)
  const empty = {
    createdCount: 0,
    updatedCount: 0,
    skippedManualOverrideCount: 0,
    skippedExistingCount: 0,
  }

  if (!Number.isFinite(anchorStudyDay)) {
    return { ok: false, ...empty, error: 'anchorStudyDay must be a valid integer.' }
  }

  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id')
    .eq('id', input.subjectId)
    .eq('study_id', input.studyId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (subjectError) return { ok: false, ...empty, error: subjectError.message }
  if (!subject) {
    return { ok: false, ...empty, error: 'Subject not found in the requested study and organization.' }
  }

  const { data: definitions, error: definitionsError } = await supabase
    .from('visit_definitions')
    .select('id, code, label, sort_order, target_day, window_min_offset, window_max_offset')
    .eq('study_id', input.studyId)
    .eq('organization_id', input.organizationId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (definitionsError) return { ok: false, ...empty, error: definitionsError.message }

  const allDefinitions = (definitions ?? []) as VisitDefinitionRow[]
  if (!allDefinitions.some((definition) => definition.id === input.anchorVisitDefinitionId)) {
    return { ok: false, ...empty, error: 'Anchor visit definition does not belong to this study.' }
  }

  const candidateDefinitions = allDefinitions
    .map((definition, index) => ({
      definition,
      studyDay: normalizeStudyDay(definition, index),
    }))
    .filter((item) => item.studyDay >= anchorStudyDay)

  if (candidateDefinitions.length === 0) {
    return { ok: true, ...empty }
  }

  const definitionIds = candidateDefinitions.map((item) => item.definition.id)
  const { data: existingRows, error: existingError } = await supabase
    .from('scheduled_visits')
    .select('id, visit_definition_id, manual_override')
    .eq('subject_id', input.subjectId)
    .in('visit_definition_id', definitionIds)

  if (existingError) return { ok: false, ...empty, error: existingError.message }

  const existingByDefinitionId = new Map(
    ((existingRows ?? []) as ScheduledVisitRow[]).map((row) => [row.visit_definition_id, row]),
  )

  let createdCount = 0
  let updatedCount = 0
  let skippedManualOverrideCount = 0
  const skippedExistingCount = 0

  for (const { definition, studyDay } of candidateDefinitions) {
    const existing = existingByDefinitionId.get(definition.id)
    if (existing?.manual_override) {
      skippedManualOverrideCount += 1
      continue
    }

    const idealDate = addCalendarDays(input.anchorDate, studyDay - anchorStudyDay)
    const payload = {
      organization_id: input.organizationId,
      study_id: input.studyId,
      subject_id: input.subjectId,
      visit_definition_id: definition.id,
      visit_name: definition.label ?? definition.code ?? 'Protocol visit',
      visit_number: normalizeVisitNumber(definition),
      study_day: studyDay,
      ideal_date: idealDate,
      window_open_date: addCalendarDays(idealDate, definition.window_min_offset ?? 0),
      window_close_date: addCalendarDays(idealDate, definition.window_max_offset ?? 0),
      status: 'upcoming',
      modality: normalizeModality(definition),
      assigned_user_id: input.assignedUserId ?? null,
      generated_from_protocol: true,
    }

    if (existing) {
      const updatePayload = {
        organization_id: payload.organization_id,
        study_id: payload.study_id,
        subject_id: payload.subject_id,
        visit_definition_id: payload.visit_definition_id,
        visit_name: payload.visit_name,
        visit_number: payload.visit_number,
        study_day: payload.study_day,
        ideal_date: payload.ideal_date,
        window_open_date: payload.window_open_date,
        window_close_date: payload.window_close_date,
        modality: payload.modality,
        assigned_user_id: payload.assigned_user_id,
        generated_from_protocol: payload.generated_from_protocol,
      }
      const { error } = await supabase
        .from('scheduled_visits')
        .update(updatePayload)
        .eq('id', existing.id)
        .eq('manual_override', false)

      if (error) {
        return {
          ok: false,
          createdCount,
          updatedCount,
          skippedManualOverrideCount,
          skippedExistingCount,
          error: error.message,
        }
      }
      updatedCount += 1
      continue
    }

    const { error } = await supabase.from('scheduled_visits').insert(payload)
    if (error) {
      return {
        ok: false,
        createdCount,
        updatedCount,
        skippedManualOverrideCount,
        skippedExistingCount,
        error: error.message,
      }
    }
    createdCount += 1
    existingByDefinitionId.set(definition.id, {
      id: definition.id,
      visit_definition_id: definition.id,
      manual_override: false,
    })
  }

  return {
    ok: true,
    createdCount,
    updatedCount,
    skippedManualOverrideCount,
    skippedExistingCount,
  }
}
