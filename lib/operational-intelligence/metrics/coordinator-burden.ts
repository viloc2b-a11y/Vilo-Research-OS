import type { CoordinatorBurdenMetrics } from '@/lib/operational-intelligence/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeCoordinatorBurden(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId?: string | null
}): Promise<CoordinatorBurdenMetrics> {
  const today = new Date().toISOString().slice(0, 10)

  let wfQuery = input.supabase
    .from('subject_workflow_actions')
    .select('id, action_type, status, due_date', { count: 'exact' })
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('status', ['open', 'in_progress'])

  if (input.visitId) {
    wfQuery = wfQuery.or(`visit_id.is.null,visit_id.eq.${input.visitId}`)
  }

  const { data: workflows, count: workflowCount } = await wfQuery

  const openQueryCount =
    (workflows ?? []).filter((w) => w.action_type === 'query').length

  const overdueWorkflowCount = (workflows ?? []).filter((w) => {
    const due = w.due_date as string | null
    return due && due < today
  }).length

  const { count: sourceBacklogCount } = await input.supabase
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('status', ['draft', 'in_progress'])

  let findingCount = 0
  const { data: sets } = await input.supabase
    .from('source_response_sets')
    .select('id')
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .neq('status', 'archived')

  const setIds = (sets ?? []).map((s) => s.id as string)
  if (setIds.length > 0) {
    const { count } = await input.supabase
      .from('source_response_validation_findings')
      .select('id', { count: 'exact', head: true })
      .in('response_set_id', setIds)
      .eq('severity', 'error')
      .in('status', ['open', 'acknowledged'])
    findingCount = count ?? 0
  }

  const { count: safetyBurdenCount } = await input.supabase
    .from('subject_adverse_events')
    .select('ae_id', { count: 'exact', head: true })
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .in('lifecycle_status', ['open', 'follow_up'])

  let rescheduleCount = 0
  if (input.visitId) {
    const { count } = await input.supabase
      .from('operational_events')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', input.visitId)
      .eq('event_type', 'VISIT_RESCHEDULED')
    rescheduleCount = count ?? 0
  } else {
    const { data: visitRows } = await input.supabase
      .from('visits')
      .select('id')
      .eq('study_subject_id', input.studySubjectId)
    const ids = (visitRows ?? []).map((v) => v.id as string)
    if (ids.length > 0) {
      const { count } = await input.supabase
        .from('operational_events')
        .select('id', { count: 'exact', head: true })
        .in('visit_id', ids)
        .eq('event_type', 'VISIT_RESCHEDULED')
      rescheduleCount = count ?? 0
    }
  }

  const openWorkflowCount = workflowCount ?? (workflows ?? []).length
  const visitCountForDensity = input.visitId ? 1 : Math.max(1, (sets ?? []).length > 0 ? 1 : 1)
  const queryDensity = Math.round((openQueryCount / visitCountForDensity) * 10) / 10

  const burdenScore = Math.min(
    100,
    openWorkflowCount * 4
      + openQueryCount * 6
      + (sourceBacklogCount ?? 0) * 3
      + findingCount * 8
      + (safetyBurdenCount ?? 0) * 10
      + rescheduleCount * 5
      + overdueWorkflowCount * 7,
  )

  return {
    openWorkflowCount,
    openQueryCount,
    unresolvedFindingCount: findingCount,
    sourceBacklogCount: sourceBacklogCount ?? 0,
    safetyBurdenCount: safetyBurdenCount ?? 0,
    queryDensity,
    rescheduleCount,
    overdueWorkflowCount,
    burdenScore,
  }
}
