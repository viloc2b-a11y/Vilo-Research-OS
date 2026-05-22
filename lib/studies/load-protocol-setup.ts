import { createServerClient } from '@/lib/supabase/server'
import { formatCommaSeparatedList } from '@/lib/studies/protocol-primitives'

export type ProtocolSetupVisitRow = {
  id: string
  code: string
  label: string
  eligibleArms: string | null
  eligibleSubjectRoles: string | null
  modality: string | null
}

export type ProtocolSetupMapRow = {
  id: string
  visitLabel: string
  procedureLabel: string
  isConditional: boolean
  conditionLabel: string | null
}

export type ProtocolSetupModel = {
  visits: ProtocolSetupVisitRow[]
  procedureMaps: ProtocolSetupMapRow[]
  error: string | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadProtocolSetupModel(input: {
  studyId: string
  organizationId: string
}): Promise<ProtocolSetupModel> {
  const supabase = await createServerClient()

  const [visitsResult, mapsResult] = await Promise.all([
    supabase
      .from('visit_definitions')
      .select('id, code, label, eligible_arms, eligible_subject_roles, modality')
      .eq('study_id', input.studyId)
      .eq('organization_id', input.organizationId)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true }),
    supabase
      .from('visit_def_procedure_map')
      .select(
        `
        id,
        is_conditional,
        condition_label,
        visit_definitions(code, label),
        procedure_definitions(code, label)
      `,
      )
      .eq('study_id', input.studyId)
      .eq('organization_id', input.organizationId)
      .order('sort_order', { ascending: true }),
  ])

  const errors = [visitsResult.error?.message, mapsResult.error?.message].filter(Boolean)
  if (errors.length) {
    return { visits: [], procedureMaps: [], error: errors.join(' ') }
  }

  const visits: ProtocolSetupVisitRow[] = (visitsResult.data ?? []).map((row) => ({
    id: row.id as string,
    code: (row.code as string) ?? '',
    label: (row.label as string) ?? '',
    eligibleArms: formatCommaSeparatedList(row.eligible_arms as string[] | null),
    eligibleSubjectRoles: formatCommaSeparatedList(row.eligible_subject_roles as string[] | null),
    modality: (row.modality as string | null) ?? null,
  }))

  const procedureMaps: ProtocolSetupMapRow[] = (mapsResult.data ?? []).map((row) => {
    const visit = one(row.visit_definitions) as { code?: string; label?: string } | null
    const procedure = one(row.procedure_definitions) as { code?: string; label?: string } | null
    return {
      id: row.id as string,
      visitLabel: visit?.label ?? visit?.code ?? 'Visit',
      procedureLabel: procedure?.label ?? procedure?.code ?? 'Procedure',
      isConditional: Boolean(row.is_conditional),
      conditionLabel: (row.condition_label as string | null) ?? null,
    }
  })

  return { visits, procedureMaps, error: null }
}
