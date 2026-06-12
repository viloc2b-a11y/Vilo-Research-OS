import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import {
  UNSIGNED_VISITS_48H_LIMIT,
  WINDOW_CLOSING_TODAY_LIMIT,
} from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'
import { filterDashboardTestDataRows } from '@/lib/dashboard-test-data'

export type DataCaptureSignals = {
  windowClosingToday: RawSignal<Record<string, unknown>>
  unsignedVisitsOver48h: RawSignal<Record<string, unknown>>
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

const VISIT_RISK_SELECT = `
  id,
  organization_id,
  study_id,
  study_subject_id,
  visit_status,
  window_status,
  scheduled_date,
  target_date,
  window_end,
  completed_at,
  source_status,
  study_subjects(subject_identifier),
  studies(name, slug, created_source),
  visit_definitions(label, code)
`

async function loadWindowClosingToday(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<Record<string, unknown>>> {
  const { data, error } = await client
    .from('visits')
    .select(VISIT_RISK_SELECT)
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .eq('window_end', todayIsoDate())
    .not('visit_status', 'in', '(completed,cancelled,locked)')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(WINDOW_CLOSING_TODAY_LIMIT)

  if (error) {
    return {
      source: 'window_closing_today',
      rows: [],
      error: { source: 'window_closing_today', message: error.message },
    }
  }

  return { source: 'window_closing_today', rows: filterDashboardTestDataRows(data ?? []), error: null }
}

async function loadUnsignedVisitsOver48h(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<Record<string, unknown>>> {
  const { data, error } = await client
    .from('visits')
    .select(VISIT_RISK_SELECT)
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .neq('source_status', 'signed')
    .not('completed_at', 'is', null)
    .lt('completed_at', hoursAgoIso(48))
    .order('completed_at', { ascending: true, nullsFirst: false })
    .limit(UNSIGNED_VISITS_48H_LIMIT)

  if (error) {
    return {
      source: 'unsigned_visits_48h',
      rows: [],
      error: { source: 'unsigned_visits_48h', message: error.message },
    }
  }

  return { source: 'unsigned_visits_48h', rows: filterDashboardTestDataRows(data ?? []), error: null }
}

export async function loadDataCaptureSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<DataCaptureSignals> {
  const [windowClosingToday, unsignedVisitsOver48h] = await Promise.all([
    loadWindowClosingToday(client, scope),
    loadUnsignedVisitsOver48h(client, scope),
  ])

  return {
    windowClosingToday,
    unsignedVisitsOver48h,
  }
}
