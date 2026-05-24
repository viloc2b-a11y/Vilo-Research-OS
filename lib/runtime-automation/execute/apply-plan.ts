import { materializeAutomationWorkflow } from '@/lib/runtime-automation/automate/workflow-materialize'
import {
  emitRuntimeAutomationApplied,
  emitRuntimeAutomationProposed,
} from '@/lib/runtime-automation/emit/automation-events'
import {
  applyBlockedBySafeguards,
} from '@/lib/runtime-automation/safeguards/governance'
import type {
  ApplyAutomationResult,
  ProposedAutomationAction,
  VisitRuntimeAutomation,
} from '@/lib/runtime-automation/types'
import { workflowCreateEventType } from '@/lib/operations/workflow-events'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { buildOperationalEventPayload } from '@/lib/operations/event-payload'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function applyVisitRuntimeAutomationPlan(input: {
  supabase: SupabaseClient
  automation: VisitRuntimeAutomation
  actorUserId: string
  actionIds?: string[]
}): Promise<ApplyAutomationResult> {
  const plan = input.automation.plan

  if (applyBlockedBySafeguards(plan.safeguards)) {
    return {
      applied: 0,
      skipped: plan.proposedActions.length,
      executionIds: [],
      errors: ['Automation apply blocked by governance safeguards.'],
    }
  }

  const toApply = input.actionIds
    ? plan.proposedActions.filter((a) => input.actionIds!.includes(a.id))
    : plan.proposedActions.filter((a) => a.requiresCoordinatorApproval)

  const result: ApplyAutomationResult = {
    applied: 0,
    skipped: 0,
    executionIds: [],
    errors: [],
  }

  for (const action of toApply) {
    if (action.status !== 'proposed') {
      result.skipped += 1
      continue
    }

    try {
      const executionId = await applySingleAutomationAction({
        supabase: input.supabase,
        automation: input.automation,
        action,
        actorUserId: input.actorUserId,
      })
      if (executionId) {
        result.applied += 1
        result.executionIds.push(executionId)
      } else {
        result.skipped += 1
      }
    } catch (e) {
      result.errors.push(`${action.id}: ${e instanceof Error ? e.message : String(e)}`)
      result.skipped += 1
    }
  }

  return result
}

async function applySingleAutomationAction(input: {
  supabase: SupabaseClient
  automation: VisitRuntimeAutomation
  action: ProposedAutomationAction
  actorUserId: string
}): Promise<string | null> {
  const { automation, action } = input
  let workflowActionId: string | null = null

  if (
    action.kind === 'materialize_workflow'
    || action.kind === 'route_pi_review'
    || action.kind === 'route_coordinator_follow_up'
    || action.kind === 'route_operational_escalation'
    || action.kind === 'create_review_requirement'
  ) {
    const wfAction: ProposedAutomationAction = {
      ...action,
      kind: 'materialize_workflow',
      workflowDedupeKey:
        action.workflowDedupeKey ?? `auto:${action.ruleId}:${automation.visitId}:apply`,
    }
    const mat = await materializeAutomationWorkflow({
      supabase: input.supabase,
      organizationId: automation.organizationId,
      studyId: automation.studyId,
      studySubjectId: automation.studySubjectId,
      visitId: automation.visitId,
      action: wfAction,
      actorUserId: input.actorUserId,
    })
    workflowActionId = mat.workflowActionId

    if (workflowActionId && !mat.skipped) {
      const wfEvent = workflowCreateEventType(
        action.kind === 'route_pi_review' ? 'follow_up' : 'follow_up',
      )
      if (wfEvent) {
        await logOperationalEvent({
          supabase: input.supabase,
          organizationId: automation.organizationId,
          studyId: automation.studyId,
          visitId: automation.visitId,
          actorUserId: input.actorUserId,
          eventType: wfEvent,
          payload: buildOperationalEventPayload({
            source: 'runtime-automation',
            mutation: 'runtime_automation.materialize_workflow',
            subjectId: automation.studySubjectId,
            details: { workflow_action_id: workflowActionId, automation_action_id: action.id },
          }),
        })
      }
    }
  }

  const { data: execution, error: execErr } = await input.supabase
    .from('runtime_automation_executions')
    .insert({
      organization_id: automation.organizationId,
      study_id: automation.studyId,
      study_subject_id: automation.studySubjectId,
      visit_id: automation.visitId,
      rule_id: action.ruleId,
      action_id: action.id,
      action_kind: action.kind,
      status: 'applied',
      workflow_action_id: workflowActionId,
      applied_by: input.actorUserId,
      payload: {
        label: action.label,
        detail: action.detail,
        orchestration_action_id: action.orchestrationActionId,
      },
    })
    .select('id')
    .single()

  if (execErr) throw new Error(execErr.message)

  const executionId = execution.id as string

  const eventId = await emitRuntimeAutomationApplied({
    supabase: input.supabase,
    organizationId: automation.organizationId,
    studyId: automation.studyId,
    studySubjectId: automation.studySubjectId,
    visitId: automation.visitId,
    actorUserId: input.actorUserId,
    action,
    executionId,
    workflowActionId,
  })

  if (eventId) {
    await input.supabase
      .from('runtime_automation_executions')
      .update({ operational_event_id: eventId })
      .eq('id', executionId)
  }

  return executionId
}

export async function proposeVisitRuntimeAutomationEvent(input: {
  supabase: SupabaseClient
  automation: VisitRuntimeAutomation
  actorUserId: string | null
}): Promise<void> {
  await emitRuntimeAutomationProposed({
    supabase: input.supabase,
    organizationId: input.automation.organizationId,
    studyId: input.automation.studyId,
    studySubjectId: input.automation.studySubjectId,
    visitId: input.automation.visitId,
    actorUserId: input.actorUserId,
    plan: input.automation.plan,
  })
}
