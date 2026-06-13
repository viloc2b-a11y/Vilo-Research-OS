import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolDeviationRow,
  type ProtocolDeviationRow,
  type DeviationType,
  type DeviationStatus,
  type DeviationSeverity,
} from './deviation-types'

export type LoadDeviationsFilters = {
  organizationId: string
  studyId?: string
  subjectId?: string
  deviationType?: DeviationType
  status?: DeviationStatus
  severity?: DeviationSeverity
}

export async function loadDeviations(
  supabase: SupabaseClient,
  filters: LoadDeviationsFilters,
): Promise<ProtocolDeviationRow[]> {
  let query = supabase.from('protocol_deviations').select('*')

  query = query.eq('organization_id', filters.organizationId)

  if (filters.studyId) {
    query = query.eq('study_id', filters.studyId)
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.deviationType) {
    query = query.eq('deviation_type', filters.deviationType)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.severity) {
    query = query.eq('severity', filters.severity)
  }

  const { data, error } = await query
    .order('opened_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapProtocolDeviationRow(row as Record<string, unknown>),
  )
}

export async function loadDeviation(
  supabase: SupabaseClient,
  deviationId: string,
  organizationId: string,
): Promise<ProtocolDeviationRow | null> {
  const { data, error } = await supabase
    .from('protocol_deviations')
    .select('*')
    .eq('id', deviationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapProtocolDeviationRow(data as Record<string, unknown>) : null
}
