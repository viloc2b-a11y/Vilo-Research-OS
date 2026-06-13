import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLongitudinalLabResultRow,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'

export async function loadLabResults(
  supabase: SupabaseClient,
  organizationId: string,
  subjectId: string,
  labTestCode?: string,
): Promise<LongitudinalLabResultRow[]> {
  let query = supabase
    .from('longitudinal_lab_results')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('subject_id', subjectId)
    .order('collection_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (labTestCode) {
    query = query.eq('lab_test_code', labTestCode)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLongitudinalLabResultRow(row as Record<string, unknown>))
}

export async function loadLabResultById(
  supabase: SupabaseClient,
  organizationId: string,
  resultId: string,
): Promise<LongitudinalLabResultRow | null> {
  const { data, error } = await supabase
    .from('longitudinal_lab_results')
    .select('*')
    .eq('id', resultId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapLongitudinalLabResultRow(data as Record<string, unknown>) : null
}
