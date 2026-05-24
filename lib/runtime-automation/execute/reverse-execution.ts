import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { emitRuntimeAutomationReversed } from '@/lib/runtime-automation/emit/automation-events'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function reverseRuntimeAutomationExecution(input: {
  supabase: SupabaseClient
  executionId: string
  actorUserId: string
}): Promise<void> {
  const { data: row, error } = await input.supabase
    .from('runtime_automation_executions')
    .select('*')
    .eq('id', input.executionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('Automation execution not found')
  if (row.status === 'reversed') return

  if (row.workflow_action_id) {
    await logOperationalEvent({
      supabase: input.supabase,
      organizationId: row.organization_id as string,
      studyId: row.study_id as string,
      visitId: (row.visit_id as string) ?? null,
      actorUserId: input.actorUserId,
      eventType: OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_REVERSED,
      payload: {
        workflow_action_id: row.workflow_action_id,
        workflow_cancelled: true,
        execution_id: input.executionId,
      },
    })

    await input.supabase
      .from('subject_workflow_actions')
      .update({
        status: 'cancelled',
        resolution_note: 'Cancelled — runtime automation reversed by coordinator.',
        resolved_at: new Date().toISOString(),
        resolved_by: input.actorUserId,
      })
      .eq('id', row.workflow_action_id as string)
      .in('status', ['open', 'in_progress'])
  }

  await input.supabase
    .from('runtime_automation_executions')
    .update({
      status: 'reversed',
      reversed_at: new Date().toISOString(),
    })
    .eq('id', input.executionId)

  await emitRuntimeAutomationReversed({
    supabase: input.supabase,
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    studySubjectId: row.study_subject_id as string,
    visitId: (row.visit_id as string) ?? null,
    actorUserId: input.actorUserId,
    executionId: input.executionId,
    actionId: row.action_id as string,
  })
}
