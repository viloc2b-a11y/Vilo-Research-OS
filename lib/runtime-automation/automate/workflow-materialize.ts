import { emitWorkflowActionCreatedEvent } from '@/lib/operations/emit-workflow-created'
import { buildFinancialRemediationWorkflow } from '@/lib/runtime-automation/automate/financial-remediation'
import { buildSafetyEscalationWorkflow } from '@/lib/runtime-automation/automate/safety-escalation'
import type { ProposedAutomationAction } from '@/lib/runtime-automation/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type MaterializeWorkflowResult = {
  workflowActionId: string | null
  skipped: boolean
  skipReason?: string
}

export async function materializeAutomationWorkflow(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  action: ProposedAutomationAction
  actorUserId: string | null
}): Promise<MaterializeWorkflowResult> {
  if (input.action.kind !== 'materialize_workflow' || !input.action.workflowDedupeKey) {
    return { workflowActionId: null, skipped: true, skipReason: 'not a workflow action' }
  }

  const { data: dup } = await input.supabase
    .from('subject_workflow_actions')
    .select('id')
    .eq('study_subject_id', input.studySubjectId)
    .eq('visit_id', input.visitId)
    .in('status', ['open', 'in_progress'])
    .eq('title', workflowTitleForAction(input.action))
    .maybeSingle()

  if (dup) {
    return { workflowActionId: dup.id as string, skipped: true, skipReason: 'deduped' }
  }

  let wf: ReturnType<typeof buildSafetyEscalationWorkflow> | ReturnType<typeof buildFinancialRemediationWorkflow>

  if (input.action.ruleId.includes('safety')) {
    wf = buildSafetyEscalationWorkflow({
      action: input.action,
      studySubjectId: input.studySubjectId,
    })
  } else if (input.action.ruleId.includes('financial')) {
    wf = buildFinancialRemediationWorkflow({ action: input.action })
  } else {
    wf = {
      title: workflowTitleForAction(input.action),
      description: input.action.detail,
      assignedRole: 'crc' as const,
      priority: 'normal' as const,
      actionType: 'follow_up' as const,
    }
  }

  const due = new Date()
  due.setDate(due.getDate() + (wf.priority === 'urgent' ? 1 : 3))

  const { data: inserted, error } = await input.supabase
    .from('subject_workflow_actions')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      study_subject_id: input.studySubjectId,
      visit_id: input.visitId,
      action_type: wf.actionType,
      status: 'open',
      priority: wf.priority,
      title: wf.title,
      description: `[runtime automation] ${wf.description}`,
      assigned_role: wf.assignedRole,
      due_date: due.toISOString().slice(0, 10),
      created_by: input.actorUserId,
    })
    .select('id')
    .single()

  if (error) {
    return { workflowActionId: null, skipped: true, skipReason: error.message }
  }

  await emitWorkflowActionCreatedEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    workflowActionId: inserted.id as string,
    actionType: wf.actionType,
    title: wf.title,
    assignedRole: wf.assignedRole,
    origin: 'runtime_automation_materialize',
  })

  return { workflowActionId: inserted.id as string, skipped: false }
}

function workflowTitleForAction(action: ProposedAutomationAction): string {
  return `Runtime automation: ${action.label.slice(0, 80)}`
}
