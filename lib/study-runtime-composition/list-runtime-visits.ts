import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapRuntimeVisitRow,
  mapVisitProcedureRow,
  type RuntimeVisitView,
} from './runtime-composition-types'

export type ListRuntimeVisitsFilters = {
  organizationId: string
  studyId: string
  status?: string | null
}

export async function listRuntimeVisits(
  supabase: SupabaseClient,
  filters: ListRuntimeVisitsFilters,
): Promise<RuntimeVisitView[]> {
  let visitQuery = supabase
    .from('study_runtime_visits')
    .select('*')
    .eq('organization_id', filters.organizationId)
    .eq('study_id', filters.studyId)
    .order('sequence_order', { ascending: true })

  if (filters.status) {
    visitQuery = visitQuery.eq('status', filters.status)
  }

  const { data: visits, error: visitError } = await visitQuery
  if (visitError) throw new Error(visitError.message)
  if (!visits?.length) return []

  const visitIds = visits.map((visit) => String(visit.id))
  const { data: procedures, error: procedureError } = await supabase
    .from('study_runtime_visit_procedures')
    .select(
      `
      *,
      procedure_library!inner (
        procedure_code,
        procedure_name
      )
    `,
    )
    .eq('organization_id', filters.organizationId)
    .eq('study_id', filters.studyId)
    .in('visit_id', visitIds)
    .order('procedure_order', { ascending: true })

  if (procedureError) throw new Error(procedureError.message)

  const proceduresByVisit = new Map<string, ReturnType<typeof mapVisitProcedureRow>[]>()
  for (const row of procedures ?? []) {
    const library = row.procedure_library as { procedure_code: string; procedure_name: string }
    const mapped = mapVisitProcedureRow({
      ...(row as Record<string, unknown>),
      procedure_code: library.procedure_code,
      procedure_name: library.procedure_name,
    })
    const list = proceduresByVisit.get(mapped.visitId) ?? []
    list.push(mapped)
    proceduresByVisit.set(mapped.visitId, list)
  }

  return visits.map((visit) => {
    const mappedVisit = mapRuntimeVisitRow(visit as Record<string, unknown>)
    return {
      ...mappedVisit,
      procedures: proceduresByVisit.get(mappedVisit.id) ?? [],
    }
  })
}
