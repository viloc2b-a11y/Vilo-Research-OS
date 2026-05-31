import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

type ToggleMode = 'disable_fields' | 'enable_fields' | 'disable_section' | 'set_applicability'
export type ApplicabilityStatus = 'applicable' | 'not_applicable' | 'skipped' | 'missed' | 'contraindicated' | 'protocol_exception' | 'medical_exception'

export async function toggleFieldState(params: {
  supabase: Supabase
  procedure: {
    id: string
    organization_id: string
    study_id: string
    visit_id: string
    is_signed?: boolean | null
    is_locked?: boolean | null
  }
  actorUserId: string
  mode: ToggleMode
  reason?: string | null
  applicabilityStatus?: ApplicabilityStatus
}) {
  const { data: current, error: readError } = await params.supabase
    .from('procedure_executions')
    .select(`
      id,
      organization_id,
      study_id,
      visit_id,
      is_signed,
      is_locked,
      fields_disabled_at,
      section_disabled_at,
      applicability_status
    `)
    .eq('id', params.procedure.id)
    .eq('organization_id', params.procedure.organization_id)
    .maybeSingle()

  if (readError) return { ok: false as const, error: readError.message }
  if (!current) return { ok: false as const, error: 'Procedure not found.' }
  if (current.is_signed || current.is_locked) {
    return { ok: false as const, error: 'Signed or locked procedures cannot be reopened from this control.' }
  }

  const now = new Date().toISOString()
  const reason = params.reason?.trim() || null
  const hadSectionDisabled = Boolean(current.section_disabled_at)
  const hadFieldsDisabled = Boolean(current.fields_disabled_at)
  const previousApplicability = current.applicability_status || 'applicable'

  let update: Record<string, unknown> = {}
  
  if (params.mode === 'set_applicability' && params.applicabilityStatus) {
    if (params.applicabilityStatus === 'applicable') {
      update = {
        applicability_status: 'applicable',
        applicability_reason: null,
        applicability_set_by: null,
        applicability_set_at: null,
        previous_applicability_status: previousApplicability,
        fields_disabled_at: null,
        fields_disabled_by: null,
        fields_disabled_reason: null,
        section_disabled_at: null,
        section_disabled_by: null,
        section_disabled_reason: null,
        reopened_at: now,
        reopened_by: params.actorUserId,
      }
    } else {
      update = {
        applicability_status: params.applicabilityStatus,
        applicability_reason: reason,
        applicability_set_by: params.actorUserId,
        applicability_set_at: now,
        previous_applicability_status: previousApplicability,
      }
    }
  } else if (params.mode === 'disable_fields') {
    update = { fields_disabled_at: now, fields_disabled_by: params.actorUserId, fields_disabled_reason: reason }
  } else if (params.mode === 'enable_fields') {
    update = {
      fields_disabled_at: null,
      fields_disabled_by: null,
      fields_disabled_reason: null,
      section_disabled_at: null,
      section_disabled_by: null,
      section_disabled_reason: null,
      applicability_status: 'applicable',
      applicability_reason: null,
      applicability_set_by: null,
      applicability_set_at: null,
      reopened_at: now,
      reopened_by: params.actorUserId,
    }
  } else if (params.mode === 'disable_section') {
    update = { section_disabled_at: now, section_disabled_by: params.actorUserId, section_disabled_reason: reason }
  }

  const { error } = await params.supabase
    .from('procedure_executions')
    .update(update)
    .eq('id', params.procedure.id)
    .eq('organization_id', params.procedure.organization_id)

  if (error) return { ok: false as const, error: error.message }

  const chronology: Array<{ type: string; payload?: Record<string, unknown> }> = []
  
  if (params.mode === 'set_applicability' && params.applicabilityStatus) {
    if (params.applicabilityStatus === 'applicable') {
      chronology.push({ 
        type: OPERATIONAL_EVENT_TYPES.APPLICABILITY_REVERTED, 
        payload: { reason, previous_status: previousApplicability, new_status: 'applicable' } 
      })
      if (hadFieldsDisabled || hadSectionDisabled || previousApplicability !== 'applicable') {
        chronology.push({ type: OPERATIONAL_EVENT_TYPES.PROCEDURE_REOPENED, payload: { reason } })
      }
    } else {
      chronology.push({ 
        type: OPERATIONAL_EVENT_TYPES.PROCEDURE_APPLICABILITY_CHANGED, 
        payload: { reason, previous_status: previousApplicability, new_status: params.applicabilityStatus } 
      })
    }
  } else if (params.mode === 'disable_fields') {
    chronology.push({ type: OPERATIONAL_EVENT_TYPES.FIELD_LOCKED, payload: { reason } })
  } else if (params.mode === 'disable_section') {
    chronology.push({ type: OPERATIONAL_EVENT_TYPES.SECTION_DISABLED, payload: { reason } })
  } else {
    chronology.push({ type: OPERATIONAL_EVENT_TYPES.FIELD_UNLOCKED, payload: { reason } })
    if (hadSectionDisabled) {
      chronology.push({ type: OPERATIONAL_EVENT_TYPES.SECTION_ENABLED, payload: { reason } })
    }
    if (hadFieldsDisabled || hadSectionDisabled) {
      chronology.push({ type: OPERATIONAL_EVENT_TYPES.PROCEDURE_REOPENED, payload: { reason } })
    }
  }

  for (const entry of chronology) {
    await logProcedureOperationalEvent({
      supabase: params.supabase,
      procedure: current,
      actorUserId: params.actorUserId,
      eventType: entry.type,
      payload: { reason, occurred_at: now, ...entry.payload },
    })
  }

  return { ok: true as const }
}
