import { OPEN_AE_LIFECYCLE, SAFETY_WORKFLOW_TITLE_PATTERN } from '@/lib/safety-continuity/constants'
import type {
  SafetySourceRef,
  UnresolvedSafetyItem,
} from '@/lib/safety-continuity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadUnresolvedAdverseEvents(input: {
  supabase: SupabaseClient
  studySubjectId: string
  organizationId: string
}): Promise<UnresolvedSafetyItem[]> {
  const { data, error } = await input.supabase
    .from('subject_adverse_events')
    .select(
      'ae_id, event_term, severity, seriousness, lifecycle_status, visit_id, created_at',
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('lifecycle_status', [...OPEN_AE_LIFECYCLE])
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    source: 'ae_registry' as const,
    sourceId: row.ae_id as string,
    label: (row.event_term as string) || 'Adverse event',
    detail: `AE ${(row.lifecycle_status as string) ?? 'open'}${row.severity ? ` (${row.severity as string})` : ''}.`,
    severity: row.seriousness ? ('blocker' as const) : ('warning' as const),
    visitId: (row.visit_id as string | null) ?? null,
    seriousness: Boolean(row.seriousness),
    reportedAt: (row.created_at as string | null) ?? null,
  }))
}

export async function loadOpenSafetyWorkflowItems(input: {
  supabase: SupabaseClient
  studySubjectId: string
  organizationId: string
  visitId?: string | null
}): Promise<UnresolvedSafetyItem[]> {
  let query = input.supabase
    .from('subject_workflow_actions')
    .select(
      'id, title, description, status, priority, visit_id, procedure_execution_id, source_response_set_id, created_at',
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('status', ['open', 'in_progress'])

  if (input.visitId) {
    query = query.or(`visit_id.is.null,visit_id.eq.${input.visitId}`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row) => SAFETY_WORKFLOW_TITLE_PATTERN.test((row.title as string) ?? ''))
    .map((row) => ({
      source: 'workflow' as const,
      sourceId: row.id as string,
      label: (row.title as string) || 'Safety workflow',
      detail: (row.description as string) || 'Open safety-related workflow item.',
      severity: row.priority === 'urgent' ? ('blocker' as const) : ('warning' as const),
      visitId: (row.visit_id as string | null) ?? null,
      procedureExecutionId: (row.procedure_execution_id as string | null) ?? null,
      sourceResponseSetId: (row.source_response_set_id as string | null) ?? null,
      reportedAt: (row.created_at as string | null) ?? null,
    }))
}

export async function loadCriticalSourceFindingsForSubject(input: {
  supabase: SupabaseClient
  studySubjectId: string
  organizationId: string
  visitId?: string | null
}): Promise<UnresolvedSafetyItem[]> {
  let setsQuery = input.supabase
    .from('source_response_sets')
    .select('id, visit_id, procedure_execution_id')
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .neq('status', 'archived')

  if (input.visitId) {
    setsQuery = setsQuery.eq('visit_id', input.visitId)
  }

  const { data: sets, error: setsError } = await setsQuery
  if (setsError) throw new Error(setsError.message)

  const setIds = (sets ?? []).map((s) => s.id as string)
  if (setIds.length === 0) return []

  const { data: findings, error } = await input.supabase
    .from('source_response_validation_findings')
    .select('id, response_set_id, message, severity, status')
    .in('response_set_id', setIds)
    .eq('severity', 'error')
    .in('status', ['open', 'acknowledged'])

  if (error) throw new Error(error.message)

  const setById = new Map((sets ?? []).map((s) => [s.id as string, s]))

  return (findings ?? []).map((f) => {
    const set = setById.get(f.response_set_id as string)
    return {
      source: 'source_finding' as const,
      sourceId: f.id as string,
      label: 'Critical source finding',
      detail: (f.message as string) || 'Unresolved validation finding.',
      severity: 'blocker' as const,
      visitId: (set?.visit_id as string | null) ?? null,
      procedureExecutionId: (set?.procedure_execution_id as string | null) ?? null,
      sourceResponseSetId: f.response_set_id as string,
    }
  })
}

export function toSourceRefs(items: UnresolvedSafetyItem[]): SafetySourceRef[] {
  return items.map((item) => ({
    kind: item.source,
    id: item.sourceId,
    visitId: item.visitId ?? null,
  }))
}
