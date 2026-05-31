import { visitDetailPath } from '@/lib/ops/paths'
import type { SubjectAdverseEventTimelineItem } from '@/lib/subject/adverse-events/types'
import type {
  SubjectAdverseEventRecord,
  SubjectAdverseEventVisitOption,
} from '@/lib/subject/adverse-events/registry-types'
import { createServerClient } from '@/lib/supabase/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function mapRelationship(value: string | null): string | null {
  if (!value) return null
  const labels: Record<string, string> = {
    related: 'Related',
    possibly_related: 'Possibly related',
    not_related: 'Not related',
    unlikely: 'Unlikely',
    unknown: 'Unknown',
  }
  return labels[value] ?? value.replace(/_/g, ' ')
}

export function mapRegistryRowToTimelineItem(
  row: SubjectAdverseEventRecord,
  visitLabelById: Map<string, string>,
): SubjectAdverseEventTimelineItem {
  const visitId = row.visit_id
  const visitLabel = visitId ? (visitLabelById.get(visitId) ?? 'Visit') : null

  return {
    id: `subject_registry:${row.ae_id}`,
    sourceKind: 'subject_registry',
    registryId: row.ae_id,
    isEditable: true,
    eventTerm: row.event_term,
    preferredTerm: row.preferred_term ?? row.ae_type,
    severity: row.severity,
    seriousness: row.seriousness,
    relationship: mapRelationship(row.relationship_to_ip),
    relationshipCode: row.relationship_to_ip,
    lifecycleStatus: row.lifecycle_status,
    onsetDate: row.onset_date,
    resolutionDate: row.resolution_date,
    visitId,
    visitLabel,
    sourceAttribution: row.source_attribution?.trim() || 'Subject AE registry',
    lastUpdatedAt: row.updated_at,
    reporter: null,
    isSeriousAdverseEvent: row.seriousness,
    href: visitId ? visitDetailPath(visitId) : null,
    captureHref: null,
    reviewHref: null,
    registryComments: [
      row.comments,
      row.expectedness ? `Expectedness: ${row.expectedness}` : null,
      row.action_taken ? `Action taken: ${row.action_taken}` : null,
      row.outcome ? `Outcome: ${row.outcome}` : null,
      row.requires_pi_si_review ? 'Requires PI/SI review' : null,
    ].filter(Boolean).join('\n') || null,
  }
}

export async function loadSubjectAdverseEventVisitOptions(input: {
  subjectId: string
  organizationId: string
}): Promise<SubjectAdverseEventVisitOption[]> {
  const supabase = await createServerClient()
  const { data: visits } = await supabase
    .from('visits')
    .select('id, visit_definitions(label, code)')
    .eq('study_subject_id', input.subjectId)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (visits ?? []).map((v) => {
    const def = one(v.visit_definitions) as { label?: string; code?: string } | null
    return {
      id: v.id as string,
      label: def?.label ?? def?.code ?? 'Visit',
    }
  })
}

export async function loadSubjectAdverseEventsRegistry(input: {
  subjectId: string
  organizationId: string
}): Promise<{
  rows: SubjectAdverseEventRecord[]
  timelineItems: SubjectAdverseEventTimelineItem[]
  visitOptions: SubjectAdverseEventVisitOption[]
}> {
  const supabase = await createServerClient()
  const visitOptions = await loadSubjectAdverseEventVisitOptions(input)
  const visitLabelById = new Map(visitOptions.map((v) => [v.id, v.label]))

  const { data, error } = await supabase
    .from('subject_adverse_events')
    .select(
      'ae_id, organization_id, study_subject_id, visit_id, event_term, preferred_term, ae_type, severity, seriousness, relationship_to_ip, expectedness, action_taken, outcome, ongoing, requires_pi_si_review, lifecycle_status, onset_date, resolution_date, source_attribution, comments, created_at, updated_at',
    )
    .eq('study_subject_id', input.subjectId)
    .eq('organization_id', input.organizationId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[loadSubjectAdverseEventsRegistry]', error.message)
    return { rows: [], timelineItems: [], visitOptions }
  }

  const rows: SubjectAdverseEventRecord[] = (data ?? []).map((row) => ({
    ae_id: row.ae_id as string,
    organization_id: row.organization_id as string,
    study_subject_id: row.study_subject_id as string,
    visit_id: (row.visit_id as string | null) ?? null,
    event_term: row.event_term as string,
    preferred_term: (row.preferred_term as string | null) ?? null,
    ae_type: (row.ae_type as string | null) ?? null,
    severity: (row.severity as SubjectAdverseEventRecord['severity']) ?? null,
    seriousness: Boolean(row.seriousness),
    relationship_to_ip:
      (row.relationship_to_ip as SubjectAdverseEventRecord['relationship_to_ip']) ?? null,
    expectedness: (row.expectedness as string | null) ?? null,
    action_taken: (row.action_taken as string | null) ?? null,
    outcome: (row.outcome as string | null) ?? null,
    ongoing: Boolean(row.ongoing),
    requires_pi_si_review: Boolean(row.requires_pi_si_review),
    lifecycle_status: row.lifecycle_status as SubjectAdverseEventRecord['lifecycle_status'],
    onset_date: (row.onset_date as string | null) ?? null,
    resolution_date: (row.resolution_date as string | null) ?? null,
    source_attribution: (row.source_attribution as string | null) ?? null,
    comments: (row.comments as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))

  return {
    rows,
    timelineItems: rows.map((row) => mapRegistryRowToTimelineItem(row, visitLabelById)),
    visitOptions,
  }
}
