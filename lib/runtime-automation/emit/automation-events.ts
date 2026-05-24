import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import {
  observeAutomationApplied,
  observeAutomationOverridden,
  observeAutomationProposed,
  observeAutomationReversed,
} from '@/lib/observability/hooks/observe-runtime-automation'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import type { ProposedAutomationAction, RuntimeAutomationPlan } from '@/lib/runtime-automation/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function emitRuntimeAutomationProposed(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  actorUserId: string | null
  plan: RuntimeAutomationPlan
}): Promise<void> {
  await emitClinicalOperationalEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_PROPOSED,
    payloadSource: 'runtime-automation',
    mutation: 'runtime_automation.propose',
    subjectId: input.studySubjectId,
    details: {
      plan_id: input.plan.planId,
      triggered_count: input.plan.triggeredRules.length,
      proposed_count: input.plan.proposedActions.length,
      adapted_urgency: input.plan.adaptedUrgency.adaptedUrgencyScore,
    },
  })
  observeAutomationProposed(
    {
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId: input.studySubjectId,
      visitId: input.visitId,
      actorUserId: input.actorUserId,
      planId: input.plan.planId,
    },
    {
      proposed_count: input.plan.proposedActions.length,
      triggered_count: input.plan.triggeredRules.length,
    },
  )
}

export async function emitRuntimeAutomationApplied(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  actorUserId: string
  action: ProposedAutomationAction
  executionId: string
  workflowActionId?: string | null
}): Promise<string | null> {
  const { buildOperationalEventPayload } = await import('@/lib/operations/event-payload')
  const payload = buildOperationalEventPayload({
    source: 'runtime-automation',
    mutation: 'runtime_automation.apply',
    subjectId: input.studySubjectId,
    details: {
      execution_id: input.executionId,
      action_id: input.action.id,
      rule_id: input.action.ruleId,
      action_kind: input.action.kind,
      workflow_action_id: input.workflowActionId ?? null,
    },
  })

  const { data, error } = await input.supabase
    .from('operational_events')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      visit_id: input.visitId,
      event_type: OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_APPLIED,
      actor_user_id: input.actorUserId,
      payload,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  observeAutomationApplied({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    executionId: input.executionId,
    actionId: input.action.id,
  })
  return (data?.id as string) ?? null
}

export async function emitRuntimeAutomationReversed(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  actorUserId: string
  executionId: string
  actionId: string
}): Promise<void> {
  await emitClinicalOperationalEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_REVERSED,
    payloadSource: 'runtime-automation',
    mutation: 'runtime_automation.reverse',
    subjectId: input.studySubjectId,
    details: { execution_id: input.executionId, action_id: input.actionId },
  })
  observeAutomationReversed({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    executionId: input.executionId,
    actionId: input.actionId,
  })
}

export async function emitRuntimeAutomationOverridden(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  actorUserId: string
  executionId: string
  actionId: string
  reason?: string
}): Promise<void> {
  await emitClinicalOperationalEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.RUNTIME_AUTOMATION_OVERRIDDEN,
    payloadSource: 'runtime-automation',
    mutation: 'runtime_automation.override',
    subjectId: input.studySubjectId,
    details: {
      execution_id: input.executionId,
      action_id: input.actionId,
      reason: input.reason ?? null,
    },
  })
  observeAutomationOverridden({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    executionId: input.executionId,
    actionId: input.actionId,
  })
}
