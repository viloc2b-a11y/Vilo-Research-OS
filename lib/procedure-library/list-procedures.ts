import type { SupabaseClient } from '@supabase/supabase-js'
import { mapProcedureRow, type ProcedureLibraryRow } from './procedure-types'

export type ListProceduresFilters = {
  organizationId?: string | null
  libraryScope?: 'global' | 'organization' | 'all'
  status?: string | null
  category?: string | null
  search?: string | null
  limit?: number
}

export async function listProcedures(
  supabase: SupabaseClient,
  filters: ListProceduresFilters = {},
): Promise<ProcedureLibraryRow[]> {
  const scope = filters.libraryScope ?? 'all'

  if (scope === 'all' && filters.organizationId) {
    const [globalResult, orgResult] = await Promise.all([
      supabase.from('procedure_library').select('*').eq('library_scope', 'global'),
      supabase
        .from('procedure_library')
        .select('*')
        .eq('library_scope', 'organization')
        .eq('organization_id', filters.organizationId),
    ])
    if (globalResult.error) throw new Error(globalResult.error.message)
    if (orgResult.error) throw new Error(orgResult.error.message)
    const combined = [...(globalResult.data ?? []), ...(orgResult.data ?? [])]
    return applyProcedureFilters(combined, filters)
  }

  let query = supabase.from('procedure_library').select('*').order('procedure_name', { ascending: true })

  if (scope === 'global') {
    query = query.eq('library_scope', 'global')
  } else if (scope === 'organization') {
    query = query.eq('library_scope', 'organization')
    if (filters.organizationId) {
      query = query.eq('organization_id', filters.organizationId)
    }
  } else {
    query = query.eq('library_scope', 'global')
  }

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category) query = query.eq('procedure_category', filters.category)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`procedure_name.ilike.%${term}%,procedure_code.ilike.%${term}%`)
  }
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapProcedureRow(row as Record<string, unknown>))
}

function applyProcedureFilters(
  rows: Record<string, unknown>[],
  filters: ListProceduresFilters,
): ProcedureLibraryRow[] {
  let filtered = rows
  if (filters.status) {
    filtered = filtered.filter((row) => row.status === filters.status)
  }
  if (filters.category) {
    filtered = filtered.filter((row) => row.procedure_category === filters.category)
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    filtered = filtered.filter(
      (row) =>
        String(row.procedure_name).toLowerCase().includes(term)
        || String(row.procedure_code).toLowerCase().includes(term),
    )
  }
  filtered.sort((a, b) => String(a.procedure_name).localeCompare(String(b.procedure_name)))
  if (filters.limit) filtered = filtered.slice(0, filters.limit)
  return filtered.map((row) => mapProcedureRow(row))
}
