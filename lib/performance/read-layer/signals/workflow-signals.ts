import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { OVERDUE_WORKFLOW_QUERY_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type OverdueWorkflowRow = Record<string, unknown>

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function loadOverdueWorkflowActions(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<OverdueWorkflowRow>> {
  const today = todayIsoDate()
  const { data, error } = await client
    .from('subject_workflow_actions')
    .select(
      `
      id,
      study_id,
      study_subject_id,
      title,
      priority,
      due_date,
      status,
      study_subjects(subject_identifier),
      studies(name)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('status', ['open', 'in_progress'])
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(OVERDUE_WORKFLOW_QUERY_LIMIT)

  if (error) {
    return {
      source: 'overdue_workflow',
      rows: [],
      error: { source: 'overdue_workflow', message: error.message },
    }
  }

  return { source: 'overdue_workflow', rows: (data ?? []) as OverdueWorkflowRow[], error: null }
}
