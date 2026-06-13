import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapCapaActionRow,
  type CapaActionRow,
  type CapaStatus,
} from './capa-types'

export type LoadCapaActionsFilters = {
  organizationId: string
  studyId?: string
  deviationId?: string
  capaStatus?: CapaStatus
}

export async function loadCapaActions(
  supabase: SupabaseClient,
  filters: LoadCapaActionsFilters,
): Promise<CapaActionRow[]> {
  let query = supabase.from('capa_actions').select('*')

  query = query.eq('organization_id', filters.organizationId)

  if (filters.studyId) {
    query = query.eq('study_id', filters.studyId)
  }

  if (filters.deviationId) {
    query = query.eq('deviation_id', filters.deviationId)
  }

  if (filters.capaStatus) {
    query = query.eq('capa_status', filters.capaStatus)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapCapaActionRow(row as Record<string, unknown>),
  )
}

export async function loadCapaAction(
  supabase: SupabaseClient,
  actionId: string,
  organizationId: string,
): Promise<CapaActionRow | null> {
  const { data, error } = await supabase
    .from('capa_actions')
    .select('*')
    .eq('id', actionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapCapaActionRow(data as Record<string, unknown>) : null
}

export async function loadCapaActionByDeviation(
  supabase: SupabaseClient,
  deviationId: string,
  organizationId: string,
): Promise<CapaActionRow | null> {
  const { data, error } = await supabase
    .from('capa_actions')
    .select('*')
    .eq('deviation_id', deviationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapCapaActionRow(data as Record<string, unknown>) : null
}
