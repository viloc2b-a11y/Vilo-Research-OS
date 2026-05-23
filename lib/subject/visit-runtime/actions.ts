'use server'

import { revalidatePath } from 'next/cache'
import { createVisitNote } from '@/lib/visit-runtime/createVisitNote'
import { resolveProcedureContext } from '@/lib/visit-runtime/context'
import { signProcedure } from '@/lib/visit-runtime/signProcedure'
import { toggleFieldState } from '@/lib/visit-runtime/toggleFieldState'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import type { VisitRuntimeActionState } from '@/lib/subject/visit-runtime/types'
import { getOrganizationMemberships } from '@/lib/auth/session'
import { canEditClinicalSource, canViewUnblindedData } from '@/lib/rbac/permissions'
import { responseSetHasUnblindedSourceFields } from '@/lib/source/blinding'

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

export async function signProcedureAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const memberships = await getOrganizationMemberships(ctx.user.id)
  if (!canEditClinicalSource(memberships, ctx.procedure.organization_id)) {
    return { ok: false, message: 'You do not have permission to sign clinical source.' }
  }

  const hasUnblindedSource = await responseSetHasUnblindedSourceFields(ctx.supabase, {
    organizationId: ctx.procedure.organization_id,
    procedureExecutionId: ctx.procedure.id,
  })
  if (hasUnblindedSource && !canViewUnblindedData(memberships, ctx.procedure.organization_id)) {
    return {
      ok: false,
      message: 'This source includes restricted unblinded fields and requires unblinded signing access.',
    }
  }

  const result = await signProcedure({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    actorUserId: ctx.user.id,
    expectedUpdatedAt: clean(formData.get('expected_updated_at')),
  })
  if (!result.ok) return { ok: false, message: result.error }

  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  if ('idempotent' in result && result.idempotent) {
    return { ok: true, message: `Procedure already signed${result.signedAt ? ` at ${result.signedAt}` : ''}.` }
  }
  return { ok: true, message: 'Procedure signed and fields locked.' }
}

export async function addVisitRuntimeNoteAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const noteText = clean(formData.get('note_text'))
  if (!noteText) return { ok: false, message: 'Note text is required.' }

  const result = await createVisitNote({
    supabase: ctx.supabase,
    procedure: ctx.procedure,
    actorUserId: ctx.user.id,
    noteText,
  })

  if (!result.ok) return { ok: false, message: result.error }
  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  return { ok: true, message: 'Note added.' }
}

export async function validateProcedureAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const validation = await validateProcedure({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    responseSetId: clean(formData.get('response_set_id')),
  })

  const { error } = await ctx.supabase
    .from('procedure_executions')
    .update({ validation_status: validation.status })
    .eq('id', ctx.procedure.id)
    .eq('organization_id', ctx.procedure.organization_id)

  if (error) return { ok: false, message: error.message }

  await logProcedureOperationalEvent({
    supabase: ctx.supabase,
    procedure: ctx.procedure,
    actorUserId: ctx.user.id,
    eventType: OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED,
    payload: {
      validation_status: validation.status,
      alert_count: validation.alerts.length,
      response_set_id: validation.responseSetId,
    },
  })

  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  return {
    ok: validation.status === 'clean',
    message: `${validation.status}: ${validation.alerts.length} validation alert(s).`,
  }
}

export async function disablePendingFieldsAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  return toggleProcedureState(formData, 'disable_fields', 'Pending fields disabled.')
}

export async function enableFieldsAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  return toggleProcedureState(formData, 'enable_fields', 'Fields enabled.')
}

export async function disableSectionAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  return toggleProcedureState(formData, 'disable_section', 'Procedure section disabled.')
}

async function toggleProcedureState(
  formData: FormData,
  mode: 'disable_fields' | 'enable_fields' | 'disable_section',
  successMessage: string,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const result = await toggleFieldState({
    supabase: ctx.supabase,
    procedure: ctx.procedure,
    actorUserId: ctx.user.id,
    mode,
    reason: clean(formData.get('disable_reason')),
  })

  if (!result.ok) return { ok: false, message: result.error }
  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  return { ok: true, message: successMessage }
}
