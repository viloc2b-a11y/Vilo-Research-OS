import { calculateVisitWindows, todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { validateVisitWindow } from '@/lib/visits/validateVisitWindow'
import type { GenerateScheduleResult } from '@/lib/visits/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type VisitDefinitionRow = {
  id: string
  code: string
  label: string
  sort_order: number
  target_day: number | null
  window_min_offset: number | null
  window_max_offset: number | null
}

function resolveTargetDay(def: VisitDefinitionRow, index: number): number {
  if (typeof def.target_day === 'number' && def.target_day > 0) {
    return def.target_day
  }
  return index + 1
}

export async function generateSubjectVisitSchedule(input: {
  supabase: SupabaseClient
  studySubjectId: string
  anchorDate?: string
  force?: boolean
}): Promise<GenerateScheduleResult> {
  const { supabase, studySubjectId, force = false } = input

  const { data: subject, error: subErr } = await supabase
    .from('study_subjects')
    .select(
      'id, organization_id, study_id, schedule_anchor_date, visit_schedule_generated_at, enrollment_status',
    )
    .eq('id', studySubjectId)
    .maybeSingle()

  if (subErr) return { ok: false, error: subErr.message }
  if (!subject) return { ok: false, error: 'Subject not found.' }

  const enrollStatus = subject.enrollment_status as string
  if (!['enrolled', 'randomized', 'completed'].includes(enrollStatus)) {
    return { ok: false, error: 'Visit schedule is generated after enrollment or randomization.' }
  }

  const anchorDate =
    input.anchorDate?.trim() ||
    (subject.schedule_anchor_date as string | null) ||
    todayIsoDate()

  const { data: definitions, error: defErr } = await supabase
    .from('visit_definitions')
    .select(
      'id, code, label, sort_order, target_day, window_min_offset, window_max_offset',
    )
    .eq('study_id', subject.study_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (defErr) return { ok: false, error: defErr.message }
  if (!definitions?.length) {
    return { ok: false, error: 'No visit definitions on this study.' }
  }

  const { data: existingVisits } = await supabase
    .from('visits')
    .select('visit_definition_id')
    .eq('study_subject_id', studySubjectId)

  const existingDefIds = new Set(
    (existingVisits ?? []).map((v) => v.visit_definition_id as string),
  )

  const { data: procedureMaps } = await supabase
    .from('visit_def_procedure_map')
    .select('visit_definition_id, procedure_definition_id, sort_order, is_required')
    .eq('study_id', subject.study_id)
    .order('sort_order', { ascending: true })

  const mapsByVisitDef = new Map<string, typeof procedureMaps>()
  for (const row of procedureMaps ?? []) {
    const vid = row.visit_definition_id as string
    const list = mapsByVisitDef.get(vid) ?? []
    list.push(row)
    mapsByVisitDef.set(vid, list)
  }

  const procedureDefIds = [
    ...new Set((procedureMaps ?? []).map((m) => m.procedure_definition_id as string)),
  ]

  const bindingsByProcedure = new Map<string, string>()
  if (procedureDefIds.length > 0) {
    const { data: bindings } = await supabase
      .from('procedure_source_bindings')
      .select('procedure_definition_id, default_source_definition_version_id')
      .eq('study_id', subject.study_id)
      .in('procedure_definition_id', procedureDefIds)

    for (const b of bindings ?? []) {
      bindingsByProcedure.set(
        b.procedure_definition_id as string,
        b.default_source_definition_version_id as string,
      )
    }
  }

  let createdCount = 0
  const allExist = definitions.every((d) => existingDefIds.has(d.id as string))
  if (allExist && subject.visit_schedule_generated_at && !force) {
    return { ok: true, createdCount: 0, skipped: true }
  }

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i] as VisitDefinitionRow
    if (existingDefIds.has(def.id)) continue

    const targetDay = resolveTargetDay(def, i)
    const windows = calculateVisitWindows({
      anchorDate,
      targetDay,
      windowMinOffset: def.window_min_offset,
      windowMaxOffset: def.window_max_offset,
    })

    const validation = validateVisitWindow({
      scheduledDate: windows.targetDate,
      targetDate: windows.targetDate,
      windowStartDate: windows.windowStartDate,
      windowEndDate: windows.windowEndDate,
    })

    const { data: visit, error: visitErr } = await supabase
      .from('visits')
      .insert({
        organization_id: subject.organization_id,
        study_id: subject.study_id,
        study_subject_id: studySubjectId,
        visit_definition_id: def.id,
        visit_day: windows.visitDay,
        target_date: windows.targetDate,
        scheduled_date: windows.targetDate,
        window_start: windows.windowStartDate,
        window_end: windows.windowEndDate,
        window_status: validation.windowStatus,
        confirmation_status: 'pending',
        visit_status: 'scheduled',
      })
      .select('id')
      .single()

    if (visitErr) return { ok: false, error: visitErr.message }

    const procRows = mapsByVisitDef.get(def.id) ?? []
    for (const procMap of procRows) {
      const procDefId = procMap.procedure_definition_id as string
      const sdvId = bindingsByProcedure.get(procDefId) ?? null
      const { error: peErr } = await supabase.from('procedure_executions').insert({
        organization_id: subject.organization_id,
        study_id: subject.study_id,
        visit_id: visit.id,
        procedure_definition_id: procDefId,
        execution_status: 'pending',
        ...(sdvId ? { source_definition_version_id: sdvId } : {}),
      })
      if (peErr) return { ok: false, error: peErr.message }
    }

    createdCount += 1
    existingDefIds.add(def.id)
  }

  const { error: anchorErr } = await supabase
    .from('study_subjects')
    .update({
      schedule_anchor_date: anchorDate,
      visit_schedule_generated_at: new Date().toISOString(),
    })
    .eq('id', studySubjectId)

  if (anchorErr) return { ok: false, error: anchorErr.message }

  return { ok: true, createdCount, skipped: false }
}
