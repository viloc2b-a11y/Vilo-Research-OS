import { createServerClient } from '@/lib/supabase/server'
import { loadSubjectLabTimeline, type SubjectLabTimelineItem } from './load-subject-lab-timeline'
import {
  normalizeSourceLabObservations,
  type LabVisitRow,
  type PublishedLabFieldRow,
  type SourceLabResponseRow,
  type SourceLabSetRow,
} from './normalize-source-lab-observations'
import { deriveLongitudinalLabRuntime } from './longitudinal-lab-runtime'
import type { LongitudinalLabRuntime } from './types'

const LAB_SET_LIMIT = 250
const LAB_RESPONSE_LIMIT = 1200

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function loadPublishedFieldSections(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  fieldIds: string[],
): Promise<PublishedLabFieldRow[]> {
  if (fieldIds.length === 0) return []
  const { data, error } = await supabase
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
    const section = one(row.published_source_sections as unknown as { section_name?: string; source_type?: string }[] | { section_name?: string; source_type?: string } | null)
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

export type SubjectLongitudinalLabLoadResult = {
  runtime: LongitudinalLabRuntime | null
  documents: SubjectLabTimelineItem[]
  error: string | null
}

export async function loadSubjectLongitudinalLabs(input: {
  studySubjectId: string
  organizationId: string
  studyId?: string | null
}): Promise<SubjectLongitudinalLabLoadResult> {
  const supabase = await createServerClient()

  const visitsResult = await supabase
    .from('visits')
    .select('id, scheduled_date, actual_date, completed_at, visit_definitions(label, code)')
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .order('scheduled_date', { ascending: true, nullsFirst: false })

  if (visitsResult.error) {
    const documents = await loadSubjectLabTimeline({
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
      studyId: input.studyId ?? null,
    })
    return {
      runtime: null,
      documents: documents.items,
      error: visitsResult.error.message,
    }
  }

  const visitRows = (visitsResult.data ?? []) as LabVisitRow[]
  const visitsById = new Map<string, LabVisitRow>(visitRows.map((row) => [row.id, row]))
  let setRequest = supabase
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
      )
    `,
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .order('opened_at', { ascending: false })
    .limit(LAB_SET_LIMIT)

  if (input.studyId) {
    setRequest = setRequest.eq('study_id', input.studyId)
  }

  const setsResult = await setRequest
  if (setsResult.error) {
    const documents = await loadSubjectLabTimeline({
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
      studyId: input.studyId ?? null,
    })
    return {
      runtime: null,
      documents: documents.items,
      error: setsResult.error.message,
    }
  }

  const setRows = (setsResult.data ?? []) as SourceLabSetRow[]
  const setIds = setRows.map((row) => row.id)
  if (setIds.length === 0) {
    const documents = await loadSubjectLabTimeline({
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
      studyId: input.studyId ?? null,
    })
    return {
      runtime: null,
      documents: documents.items,
      error: null,
    }
  }

  const responsesResult = await supabase
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
    .eq('organization_id', input.organizationId)
    .in('response_set_id', setIds)
    .eq('is_current', true)
    .order('captured_at', { ascending: true })
    .limit(LAB_RESPONSE_LIMIT)

  if (responsesResult.error) {
    const documents = await loadSubjectLabTimeline({
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
      studyId: input.studyId ?? null,
    })
    return {
      runtime: null,
      documents: documents.items,
      error: responsesResult.error.message,
    }
  }

  const responses = (responsesResult.data ?? []) as SourceLabResponseRow[]
  const fieldIds = [...new Set(responses.map((row) => row.source_field_id))]
  const publishedFields = await loadPublishedFieldSections(supabase, fieldIds)

  const runtime = deriveLongitudinalLabRuntime(
    normalizeSourceLabObservations({
      sets: setRows,
      responses,
      publishedFields,
      visitsById,
    }),
  )

  const documents = await loadSubjectLabTimeline({
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId ?? null,
  })

  return {
    runtime,
    documents: documents.items,
    error: null,
  }
}
