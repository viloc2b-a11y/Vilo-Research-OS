import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { workflowCreateEventType } from '@/lib/operations/workflow-events'
import type { createServerClient } from '@/lib/supabase/server'
import type { SubjectWorkflowActionType } from '@/lib/subject/workflow/types'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

/**
 * Spine emission for subject_workflow_actions inserts (UI, engine, automation).
 */
export async function emitWorkflowActionCreatedEvent(input: {
  supabase: Supabase
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  procedureExecutionId?: string | null
  actorUserId: string | null
  workflowActionId: string
  actionType: SubjectWorkflowActionType | string
  title: string
  assignedRole?: string | null
  origin?: string
}): Promise<void> {
  const actionType = input.actionType as SubjectWorkflowActionType
  const eventType =
    workflowCreateEventType(actionType) ?? OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED

  await logOperationalEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    procedureExecutionId: input.procedureExecutionId ?? null,
    actorUserId: input.actorUserId,
    eventType,
    payload: {
      workflow_action_id: input.workflowActionId,
      study_subject_id: input.studySubjectId,
      title: input.title,
      action_type: actionType,
      assigned_role: input.assignedRole ?? null,
      origin: input.origin ?? 'workflow_materialize',
    },
  })
}
