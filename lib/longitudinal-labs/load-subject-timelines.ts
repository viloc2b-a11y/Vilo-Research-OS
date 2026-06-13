import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSubjectTimelineRow,
  type LongitudinalSubjectTimelineRow,
} from './longitudinal-lab-types'

export async function loadSubjectTimelines(
  supabase: SupabaseClient,
  organizationId: string,
  subjectId: string,
): Promise<LongitudinalSubjectTimelineRow[]> {
  const { data, error } = await supabase
    .from('longitudinal_subject_timelines')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('subject_id', subjectId)
    .order('lab_test_code', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSubjectTimelineRow(row as Record<string, unknown>))
}

export async function loadSubjectTimelineEntry(
  supabase: SupabaseClient,
  organizationId: string,
  subjectId: string,
  labTestCode: string,
): Promise<LongitudinalSubjectTimelineRow | null> {
  const { data, error } = await supabase
    .from('longitudinal_subject_timelines')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('subject_id', subjectId)
    .eq('lab_test_code', labTestCode)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapSubjectTimelineRow(data as Record<string, unknown>) : null
}
