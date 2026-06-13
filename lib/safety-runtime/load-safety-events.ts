import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSafetyEventRow,
  type SafetyEventRow,
  type SafetyEventType,
  type SafetyEventStatus,
  type SourceType,
  type Severity,
  type Relatedness,
} from './safety-types'

export type LoadSafetyEventsFilters = {
  organizationId: string
  studyId?: string
  subjectId?: string
  eventType?: SafetyEventType
  eventStatus?: SafetyEventStatus
  sourceType?: SourceType
  severity?: Severity
  relatedness?: Relatedness
}

export async function loadSafetyEvents(
  supabase: SupabaseClient,
  filters: LoadSafetyEventsFilters,
): Promise<SafetyEventRow[]> {
  let query = supabase.from('safety_events').select('*')

  query = query.eq('organization_id', filters.organizationId)

  if (filters.studyId) {
    query = query.eq('study_id', filters.studyId)
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType)
  }

  if (filters.eventStatus) {
    query = query.eq('event_status', filters.eventStatus)
  }

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType)
  }

  if (filters.severity) {
    query = query.eq('severity', filters.severity)
  }

  if (filters.relatedness) {
    query = query.eq('relatedness', filters.relatedness)
  }

  const { data, error } = await query
    .order('opened_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapSafetyEventRow(row as Record<string, unknown>),
  )
}

export async function loadSafetyEvent(
  supabase: SupabaseClient,
  eventId: string,
  organizationId: string,
): Promise<SafetyEventRow | null> {
  const { data, error } = await supabase
    .from('safety_events')
    .select('*')
    .eq('id', eventId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapSafetyEventRow(data as Record<string, unknown>) : null
}
