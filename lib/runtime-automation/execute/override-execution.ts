import { emitRuntimeAutomationOverridden } from '@/lib/runtime-automation/emit/automation-events'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function overrideRuntimeAutomationExecution(input: {
  supabase: SupabaseClient
  executionId: string
  actorUserId: string
  reason?: string
}): Promise<void> {
  const { data: row, error } = await input.supabase
    .from('runtime_automation_executions')
    .select('*')
    .eq('id', input.executionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('Automation execution not found')
  if (row.status === 'overridden') return

  await input.supabase
    .from('runtime_automation_executions')
    .update({
      status: 'overridden',
      overridden_at: new Date().toISOString(),
      overridden_by: input.actorUserId,
      payload: {
        ...(row.payload as Record<string, unknown>),
        override_reason: input.reason ?? null,
      },
    })
    .eq('id', input.executionId)

  await emitRuntimeAutomationOverridden({
    supabase: input.supabase,
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    studySubjectId: row.study_subject_id as string,
    visitId: (row.visit_id as string) ?? null,
    actorUserId: input.actorUserId,
    executionId: input.executionId,
    actionId: row.action_id as string,
    reason: input.reason,
  })
}
