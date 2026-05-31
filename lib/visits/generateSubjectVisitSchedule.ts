import { getSessionUser } from '@/lib/auth/session'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import {
  canExecuteStudyRuntime,
  formatStudyRuntimeBlockers,
} from '@/lib/studies/runtime-readiness'
import { enforceConsentForEnrollment } from '@/lib/subject/consent/enforcement'
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
  eligible_arms: string[] | null
  eligible_subject_roles: string[] | null
  modality: string | null
}

function visitDefinitionAppliesToSubject(
  def: VisitDefinitionRow,
  subject: { subject_role?: string | null; randomization_arm?: string | null },
): boolean {
  const role = subject.subject_role?.trim() || 'participant'
  if (def.eligible_subject_roles?.length) {
    if (!def.eligible_subject_roles.includes(role)) return false
  }
  if (def.eligible_arms?.length) {
    if (!subject.randomization_arm?.trim()) return false
    if (!def.eligible_arms.includes(subject.randomization_arm.trim())) return false
  }
  return true
}

function resolveTargetDay(def: VisitDefinitionRow, index: number): number {
  if (typeof def.target_day === 'number' && def.target_day > 0) {
    return def.target_day
  }
  return index + 1
}

async function emitScheduleMaterializedEvent(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  createdCount: number
  skipped: boolean
  anchorDate: string
  channel: 'rpc' | 'legacy_fallback'
  visitIds?: string[]
}) {
  const user = await getSessionUser()
  await ClinicalMutationGateway.emitStudy({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: input.studySubjectId,
    actorUserId: user?.id ?? null,
    eventType: OPERATIONAL_EVENT_TYPES.SCHEDULE_MATERIALIZED,
    payloadSource: 'generate-subject-visit-schedule',
    mutation: 'visits.schedule_materialized',
    details: {
      created_count: input.createdCount,
      skipped: input.skipped,
      anchor_date: input.anchorDate,
      channel: input.channel,
      visit_ids: input.visitIds ?? [],
    },
  })
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
      'id, organization_id, study_id, schedule_anchor_date, visit_schedule_generated_at, enrollment_status, subject_role, randomization_arm',
    )
    .eq('id', studySubjectId)
    .maybeSingle()

  if (subErr) return { ok: false, error: subErr.message }
  if (!subject) return { ok: false, error: 'Subject not found.' }

  const enrollStatus = subject.enrollment_status as string
  if (!['enrolled', 'randomized', 'completed'].includes(enrollStatus)) {
    return { ok: false, error: 'Visit schedule is generated after enrollment or randomization.' }
  }

  const readiness = await canExecuteStudyRuntime({
    supabase,
    studyId: subject.study_id as string,
    organizationId: subject.organization_id as string,
  })

  if (!readiness.canExecute) {
    return {
      ok: false,
      error: `Study runtime is not ready for execution: ${formatStudyRuntimeBlockers(readiness)}`,
    }
  }

  const user = await getSessionUser()
  const consent = await enforceConsentForEnrollment({
    supabase,
    organizationId: subject.organization_id as string,
    studyId: subject.study_id as string,
    subjectId: studySubjectId,
    actorUserId: user?.id ?? null,
  })
  if (!consent.ok) {
    return { ok: false, error: consent.message }
  }

  const anchorForRpc =
    input.anchorDate?.trim() ||
    null

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    'generate_subject_visit_schedule',
    {
      p_study_subject_id: studySubjectId,
      p_anchor_date: anchorForRpc,
      p_force: force,
    },
  )

  if (!rpcErr && rpcRaw && typeof rpcRaw === 'object') {
    const rpc = rpcRaw as {
      ok?: boolean
      error?: string | null
      created_count?: number
      skipped?: boolean
    }
    if (rpc.ok) {
      const createdCount = rpc.created_count ?? 0
      const skipped = rpc.skipped === true
      const anchorDate =
        input.anchorDate?.trim() ||
        (subject.schedule_anchor_date as string | null) ||
        todayIsoDate()

      if (createdCount > 0) {
        await emitScheduleMaterializedEvent({
          supabase,
          organizationId: subject.organization_id as string,
          studyId: subject.study_id as string,
          studySubjectId,
          createdCount,
          skipped,
          anchorDate,
          channel: 'rpc',
        })
      }

      return {
        ok: true,
        createdCount,
        skipped,
      }
    }
    if (rpc.error) {
      return { ok: false, error: rpc.error }
    }
  }

  const rpcUnavailable =
    rpcErr?.code === '42883' ||
    rpcErr?.message?.toLowerCase().includes('function generate_subject_visit_schedule')

  if (rpcErr && !rpcUnavailable) {
    return { ok: false, error: rpcErr.message }
  }

  // Legacy fallback only when generate_subject_visit_schedule RPC is unavailable (pre-0069).
  // Prefer RPC: single transaction; fallback uses best-effort visit delete rollback (P1).

  const anchorDate =
    input.anchorDate?.trim() ||
    (subject.schedule_anchor_date as string | null) ||
    todayIsoDate()

  const { data: definitions, error: defErr } = await supabase
    .from('visit_definitions')
    .select(
      'id, code, label, sort_order, target_day, window_min_offset, window_max_offset, eligible_arms, eligible_subject_roles, modality',
    )
    .eq('study_id', subject.study_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (defErr) return { ok: false, error: defErr.message }
  const applicableDefinitions = (definitions ?? []).filter((def) =>
    visitDefinitionAppliesToSubject(def as VisitDefinitionRow, subject),
  )
  if (!applicableDefinitions.length) {
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
    .select('visit_definition_id, procedure_definition_id, sort_order, is_required, is_conditional')
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
  const createdVisitIds: string[] = []
  const allExist = applicableDefinitions.every((d) => existingDefIds.has(d.id as string))
  if (allExist && subject.visit_schedule_generated_at && !force) {
    return { ok: true, createdCount: 0, skipped: true }
  }

  for (let i = 0; i < applicableDefinitions.length; i++) {
    const def = applicableDefinitions[i] as VisitDefinitionRow
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
        modality: def.modality?.trim() || 'site',
      })
      .select('id')
      .single()

    if (visitErr) {
      if (visitErr.code === '23505') {
        existingDefIds.add(def.id)
        continue
      }
      if (createdVisitIds.length > 0) {
        await supabase.from('visits').delete().in('id', createdVisitIds)
      }
      return { ok: false, error: visitErr.message }
    }
    createdVisitIds.push(visit.id as string)

    const procRows = (mapsByVisitDef.get(def.id) ?? []).filter((row) => !row.is_conditional)
    for (const procMap of procRows) {
      const procDefId = procMap.procedure_definition_id as string
      const sdvId = bindingsByProcedure.get(procDefId) ?? null
      if (procMap.is_required && !sdvId) {
        if (createdVisitIds.length > 0) {
          await supabase.from('visits').delete().in('id', createdVisitIds)
        }
        return {
          ok: false,
          error: 'Required procedure execution was not created because no published source binding resolved for schedule generation.',
        }
      }
      const { error: peErr } = await supabase.from('procedure_executions').insert({
        organization_id: subject.organization_id,
        study_id: subject.study_id,
        visit_id: visit.id,
        procedure_definition_id: procDefId,
        execution_status: 'pending',
        ...(sdvId ? { source_definition_version_id: sdvId } : {}),
      })
      if (peErr) {
        if (createdVisitIds.length > 0) {
          await supabase.from('visits').delete().in('id', createdVisitIds)
        }
        return { ok: false, error: peErr.message }
      }
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

  if (anchorErr) {
    if (createdVisitIds.length > 0) {
      await supabase.from('visits').delete().in('id', createdVisitIds)
    }
    return { ok: false, error: anchorErr.message }
  }

  if (createdCount > 0) {
    await emitScheduleMaterializedEvent({
      supabase,
      organizationId: subject.organization_id as string,
      studyId: subject.study_id as string,
      studySubjectId,
      createdCount,
      skipped: false,
      anchorDate,
      channel: 'legacy_fallback',
      visitIds: createdVisitIds,
    })
  }

  return { ok: true, createdCount, skipped: false }
}

// Schedule generation runs in public.generate_subject_visit_schedule (0069) for transactional safety.
