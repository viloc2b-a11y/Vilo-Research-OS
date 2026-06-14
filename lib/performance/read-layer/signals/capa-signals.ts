import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type CapaSignalRow = Record<string, unknown>

export type CapaSignals = {
  capaSignals: RawSignal<CapaSignalRow>
}

export async function loadCapaOverdueSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<CapaSignals> {
  const today = new Date().toISOString().slice(0, 10)

  if (scope.studyIds.length === 0) {
    return { capaSignals: { source: 'capa_actions', rows: [], error: null } }
  }

  const { data, error } = await client
    .from('capa_actions')
    .select('id, organization_id, study_id, deviation_id, capa_status, due_date, created_at, protocol_deviations(subject_id, study_subjects(subject_identifier))')
    .in('study_id', scope.studyIds)
    .in('capa_status', ['open', 'in_progress', 'under_review'])
    .lt('due_date', today)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  if (error) {
    return {
      capaSignals: {
        source: 'capa_actions',
        rows: [],
        error: { source: 'capa_actions', message: error.message },
      },
    }
  }

  const rows: CapaSignalRow[] = (data ?? []).map((row) => {
    const dueDate = row.due_date as string | null
    const ageHours = dueDate
      ? Math.max(0, Math.round((Date.now() - new Date(dueDate).getTime()) / 3600000))
      : 0
    const deviation = (Array.isArray(row.protocol_deviations)
      ? row.protocol_deviations[0]
      : row.protocol_deviations) as Record<string, unknown> | null
    const subjectId = (deviation?.subject_id as string | null) ?? null
    const subjectRecord = deviation
      ? ((Array.isArray(deviation.study_subjects)
          ? deviation.study_subjects[0]
          : deviation.study_subjects) as Record<string, unknown> | null)
      : null
    const subjectIdentifier = (subjectRecord?.subject_identifier as string | null) ?? 'Subject'

    return {
      organization_id: row.organization_id,
      study_id: row.study_id,
      study_subject_id: subjectId,
      subject_identifier: subjectIdentifier,
      study_name: row.study_id as string,
      signal_source: `capa_actions:${row.id as string}`,
      signal_entity_id: row.id,
      signal_created_at: (row.created_at as string | null) ?? today,
      signal_kind: 'capa_overdue',
      signal_age_hours: ageHours,
      detail_text: `CAPA action overdue${dueDate ? ` (due ${dueDate.slice(0, 10)})` : ''}: ${row.capa_status as string} — corrective action required.`,
    }
  })

  return { capaSignals: { source: 'capa_actions', rows, error: null } }
}
