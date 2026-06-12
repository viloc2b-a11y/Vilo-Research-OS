import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { LAB_SIGNAL_RESPONSE_LIMIT, LAB_SIGNAL_SET_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'
import {
  deriveLongitudinalLabRuntime,
} from '@/lib/subject/lab-timeline/longitudinal-lab-runtime'
import {
  normalizeSourceLabObservations,
  type LabVisitRow,
  type PublishedLabFieldRow,
  type SourceLabResponseRow,
  type SourceLabSetRow,
} from '@/lib/subject/lab-timeline/normalize-source-lab-observations'
import { filterDashboardTestDataRows } from '@/lib/dashboard-test-data'

export type LabLongitudinalSignalRow = Record<string, unknown>

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function loadPublishedFieldSections(
  client: SupabaseServerClient,
  fieldIds: string[],
): Promise<PublishedLabFieldRow[]> {
  if (fieldIds.length === 0) return []
  const { data, error } = await client
    .from('published_source_fields')
    .select(
      `
      phase4a_source_field_id,
      source_section_id,
      display_label,
      field_name,
      published_source_sections(section_name, source_type)
    `,
    )
    .in('phase4a_source_field_id', fieldIds)

  if (error || !data) return []

  return data.map((row) => {
    const section = one(
      row.published_source_sections as
        | { section_name?: string; source_type?: string }
        | { section_name?: string; source_type?: string }[]
        | null,
    )
    return {
      phase4a_source_field_id: row.phase4a_source_field_id as string,
      source_section_id: row.source_section_id as string,
      source_section_name: section?.section_name ?? null,
      source_type: section?.source_type ?? null,
      display_label: (row.display_label as string | null) ?? null,
      field_name: (row.field_name as string | null) ?? null,
    }
  })
}

function hoursSince(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 0
  return Math.max(0, Math.round((Date.now() - time) / (60 * 60 * 1000)))
}

function pushRowsFromRuntime(
  rows: LabLongitudinalSignalRow[],
  runtime: ReturnType<typeof deriveLongitudinalLabRuntime>,
  meta: { organizationId: string; studyName: string; subjectIdentifier: string },
) {
  for (const signal of runtime.signals) {
    rows.push({
      organization_id: meta.organizationId,
      study_id: signal.studyId,
      study_subject_id: signal.subjectId,
      subject_identifier: meta.subjectIdentifier,
      study_name: meta.studyName,
      signal_kind: signal.kind,
      signal_source: `longitudinal_labs:${signal.seriesKey}`,
      signal_entity_id: signal.seriesKey,
      signal_created_at: runtime.generatedAt,
      signal_age_hours: hoursSince(runtime.generatedAt),
      detail_text: signal.reason,
      recommended_next_step: signal.recommendedNextStep,
      lab_name: signal.labName,
      visit_id: signal.visitId,
      visit_label: signal.visitLabel,
      series_key: signal.seriesKey,
      severity: signal.severity,
      reason: signal.reason,
      linked_object_href: signal.linkedObjectHref,
      linked_object_label: signal.linkedObjectLabel,
    })
  }
}

export async function loadLabLongitudinalSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<LabLongitudinalSignalRow>> {
  const setResult = await client
    .from('source_response_sets')
    .select(
      `
      id,
      organization_id,
      study_id,
      study_subject_id,
      visit_id,
      procedure_execution_id,
      source_definition_version_id,
      status,
      opened_at,
      submitted_at,
      signed_at,
      locked_at,
      visits(
        id,
        scheduled_date,
        actual_date,
        completed_at,
        visit_definitions(label, code)
      ),
      study_subjects(subject_identifier),
      studies(name, slug, created_source)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .order('opened_at', { ascending: false })
    .limit(LAB_SIGNAL_SET_LIMIT)

  if (setResult.error) {
    return {
      source: 'longitudinal_lab_signals',
      rows: [],
      error: { source: 'longitudinal_lab_signals', message: setResult.error.message },
    }
  }

  const setRows = filterDashboardTestDataRows((setResult.data ?? []) as SourceLabSetRow[])
  if (setRows.length === 0) {
    return { source: 'longitudinal_lab_signals', rows: [], error: null }
  }

  const visitById = new Map<string, LabVisitRow>()
  for (const row of setRows) {
    const visit = one(
      row.visits as
        | LabVisitRow
        | LabVisitRow[]
        | null
        | undefined,
    )
    if (!visit?.id) continue
    visitById.set(visit.id, visit)
  }

  const responsesResult = await client
    .from('source_responses')
    .select(
      `
      id,
      response_set_id,
      source_field_id,
      source_definition_version_id,
      response_sequence,
      captured_at,
      value_text,
      value_number,
      value_boolean,
      value_date,
      value_datetime,
      value_json,
      unit,
      normalized_value,
      source_fields(field_key, label, widget_hint)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('response_set_id', setRows.map((row) => row.id))
    .eq('is_current', true)
    .order('captured_at', { ascending: true })
    .limit(LAB_SIGNAL_RESPONSE_LIMIT)

  if (responsesResult.error) {
    return {
      source: 'longitudinal_lab_signals',
      rows: [],
      error: { source: 'longitudinal_lab_signals', message: responsesResult.error.message },
    }
  }

  const responses = (responsesResult.data ?? []) as SourceLabResponseRow[]
  const fieldIds = [...new Set(responses.map((row) => row.source_field_id))]
  const publishedFields = await loadPublishedFieldSections(client, fieldIds)

  const observations = normalizeSourceLabObservations({
    sets: setRows,
    responses,
    publishedFields,
    visitsById: visitById,
  })

  const metaBySubjectId = new Map<string, { organizationId: string; studyName: string; subjectIdentifier: string }>()
  for (const row of setRows) {
    const subject = one(
      row.study_subjects as
        | { subject_identifier?: string }
        | { subject_identifier?: string }[]
        | null
        | undefined,
    )
    const study = one(row.studies as { name?: string } | { name?: string }[] | null | undefined)
    if (!row.study_subject_id) continue
    metaBySubjectId.set(row.study_subject_id, {
      organizationId: (row.organization_id as string) ?? '',
      studyName: study?.name ?? 'Study',
      subjectIdentifier: subject?.subject_identifier ?? row.study_subject_id,
    })
  }

  const bySubject = new Map<string, typeof observations>()
  for (const observation of observations) {
    const list = bySubject.get(observation.subjectId) ?? []
    list.push(observation)
    bySubject.set(observation.subjectId, list)
  }

  const rows: LabLongitudinalSignalRow[] = []
  for (const [subjectId, subjectObservations] of bySubject.entries()) {
    const runtime = deriveLongitudinalLabRuntime(subjectObservations)
    const meta = metaBySubjectId.get(subjectId) ?? {
      organizationId: '',
      studyName: 'Study',
      subjectIdentifier: subjectId,
    }
    pushRowsFromRuntime(rows, runtime, meta)
  }

  return { source: 'longitudinal_lab_signals', rows, error: null }
}
