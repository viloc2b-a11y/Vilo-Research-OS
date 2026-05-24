import {
  chronologyToReplayEntries,
  loadOperationalChronologyForReplay,
} from '@/lib/runtime-replay/load-chronology'
import type { ReplayTimelineEntry, ReplayTimelineSegment } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildWorkflowQuerySegment(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId?: string | null
}): Promise<ReplayTimelineSegment> {
  const visitIds = input.visitId ? [input.visitId] : undefined

  const rows = await loadOperationalChronologyForReplay({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitIds,
    eventTypes: ['QUERY_CREATED', 'QUERY_RESOLVED', 'FOLLOW_UP_CREATED'],
    limit: 200,
  })

  const entries: ReplayTimelineEntry[] = chronologyToReplayEntries(
    rows,
    'workflow_query',
  )

  let wfQuery = input.supabase
    .from('subject_workflow_actions')
    .select(
      'id, action_type, title, status, visit_id, procedure_execution_id, source_response_set_id, created_at, resolved_at',
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: true })

  if (input.visitId) {
    wfQuery = wfQuery.or(`visit_id.is.null,visit_id.eq.${input.visitId}`)
  }

  const { data: actions } = await wfQuery

  for (const action of actions ?? []) {
    entries.push({
      id: `workflow:${action.id as string}`,
      kind: 'workflow_action',
      segmentType: 'workflow_query',
      occurredAt: (action.resolved_at as string) ?? (action.created_at as string),
      label: `${action.action_type as string}: ${action.title as string}`,
      detail: `Workflow status: ${action.status as string}.`,
      visitId: (action.visit_id as string | null) ?? null,
      procedureExecutionId: (action.procedure_execution_id as string | null) ?? null,
      sourceResponseSetId: (action.source_response_set_id as string | null) ?? null,
      workflowActionId: action.id as string,
    })
  }

  return {
    segmentType: 'workflow_query',
    label: 'Workflow & query chain',
    entries: entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  }
}
