import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { visitDetailPath } from '@/lib/subject/chart-paths'

export type VisitModality = 'site' | 'phone' | 'remote' | 'home' | 'off_site'

export type ConditionalProcedureOption = {
  mapId: string
  procedureDefinitionId: string
  procedureLabel: string
  conditionLabel: string | null
  isRequired: boolean
}

export type InstantiateConditionalProcedureResult =
  | { ok: true; procedureExecutionId: string }
  | { ok: false; error: string }

export type InstantiateConditionalFormState = {
  ok: boolean
  message: string | null
}

export const INITIAL_INSTANTIATE_CONDITIONAL_STATE: InstantiateConditionalFormState = {
  ok: false,
  message: null,
}

export async function instantiateConditionalProcedureFormAction(
  _prev: InstantiateConditionalFormState,
  formData: FormData,
): Promise<InstantiateConditionalFormState> {
  const organizationId = formData.get('organization_id')
  const visitId = formData.get('visit_id')
  const mapId = formData.get('map_id')
  if (
    typeof organizationId !== 'string'
    || typeof visitId !== 'string'
    || typeof mapId !== 'string'
    || !organizationId
    || !visitId
    || !mapId
  ) {
    return { ok: false, message: 'Missing visit or procedure map context.' }
  }
  const result = await instantiateConditionalProcedureAction(organizationId, visitId, mapId)
  if (!result.ok) return { ok: false, message: result.error }
  return { ok: true, message: 'Conditional procedure instantiated.' }
}

export async function loadConditionalProcedureOptions(input: {
  visitId: string
  organizationId: string
}): Promise<ConditionalProcedureOption[]> {
  const supabase = await createServerClient()

  const { data: visit } = await supabase
    .from('visits')
    .select('id, study_id, visit_definition_id')
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!visit) return []

  const { data: maps } = await supabase
    .from('visit_def_procedure_map')
    .select(
      `
      id,
      procedure_definition_id,
      is_required,
      is_conditional,
      condition_label,
      procedure_definitions(code, label)
    `,
    )
    .eq('study_id', visit.study_id)
    .eq('visit_definition_id', visit.visit_definition_id)
    .eq('is_conditional', true)
    .order('sort_order', { ascending: true })

  if (!maps?.length) return []

  const { data: existing } = await supabase
    .from('procedure_executions')
    .select('procedure_definition_id')
    .eq('visit_id', input.visitId)

  const existingIds = new Set((existing ?? []).map((r) => r.procedure_definition_id as string))

  return maps
    .filter((m) => !existingIds.has(m.procedure_definition_id as string))
    .map((m) => {
      const proc = Array.isArray(m.procedure_definitions)
        ? m.procedure_definitions[0]
        : m.procedure_definitions
      const label =
        (proc as { label?: string; code?: string } | null)?.label
        ?? (proc as { label?: string; code?: string } | null)?.code
        ?? 'Procedure'
      return {
        mapId: m.id as string,
        procedureDefinitionId: m.procedure_definition_id as string,
        procedureLabel: label,
        conditionLabel: (m.condition_label as string | null) ?? null,
        isRequired: Boolean(m.is_required),
      }
    })
}

export async function instantiateConditionalProcedureAction(
  organizationId: string,
  visitId: string,
  visitDefProcedureMapId: string,
): Promise<InstantiateConditionalProcedureResult> {
  'use server'

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('instantiate_conditional_procedure_execution', {
    p_organization_id: organizationId,
    p_visit_id: visitId,
    p_visit_def_procedure_map_id: visitDefProcedureMapId,
  })

  if (error) return { ok: false, error: error.message }

  const result = data as {
    ok?: boolean
    error?: string
    procedure_execution_id?: string
  } | null

  if (!result?.ok) {
    return { ok: false, error: result?.error ?? 'Conditional procedure could not be instantiated.' }
  }

  if (!result.procedure_execution_id) {
    return { ok: false, error: 'Procedure execution id missing from RPC response.' }
  }

  revalidatePath(visitDetailPath(visitId))
  return { ok: true, procedureExecutionId: result.procedure_execution_id }
}

export function formatVisitModalityLabel(modality: string | null | undefined): string {
  const value = modality?.trim() || 'site'
  return value.replace(/_/g, ' ')
}
