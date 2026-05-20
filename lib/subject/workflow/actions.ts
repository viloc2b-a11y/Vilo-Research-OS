'use server'

import { revalidatePath } from 'next/cache'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import {
  workflowCreateEventType,
  workflowResolveEventType,
} from '@/lib/operations/workflow-events'
import { createServerClient } from '@/lib/supabase/server'
import type { SubjectWorkflowActionType, SubjectWorkflowPriority } from '@/lib/subject/workflow/types'

export type WorkflowActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_WORKFLOW_ACTION_STATE: WorkflowActionState = {
  ok: false,
  message: null,
}

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length ? text : null
}

async function assertOrg(organizationId: string | null) {
  if (!organizationId) return { ok: false as const, error: 'Missing organization.' }
  const user = await getSessionUser()
  if (!user) return { ok: false as const, error: 'Sign in required.' }
  const memberships = await getOrganizationMemberships(user.id)
  if (!memberships.some((m) => m.organization_id === organizationId)) {
    return { ok: false as const, error: 'You are not a member of this organization.' }
  }
  return { ok: true as const, user }
}

function revalidateWorkflowPaths(studyId: string | null, subjectId: string | null, visitId: string | null) {
  if (studyId && subjectId) {
    revalidatePath(`/studies/${studyId}/subjects/${subjectId}`)
    revalidatePath(`/studies/${studyId}/subjects/${subjectId}/visits`)
  }
  if (visitId) revalidatePath(`/visits/${visitId}`)
}

export async function createSubjectWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const organizationId = clean(formData.get('organization_id'))
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('study_subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const procedureExecutionId = clean(formData.get('procedure_execution_id'))
  const sourceResponseSetId = clean(formData.get('source_response_set_id'))
  const sourceSectionKey = clean(formData.get('source_section_key'))
  const title = clean(formData.get('title'))
  const description = clean(formData.get('description'))
  const dueDate = clean(formData.get('due_date'))
  const assignedRole = clean(formData.get('assigned_role'))
  const actionType = (clean(formData.get('action_type')) ?? 'action') as SubjectWorkflowActionType
  const priority = (clean(formData.get('priority')) ?? 'normal') as SubjectWorkflowPriority

  if (!studyId || !subjectId || !title) {
    return { ok: false, message: 'Study, subject, and title are required.' }
  }

  const access = await assertOrg(organizationId)
  if (!access.ok) return { ok: false, message: access.error }

  const supabase = await createServerClient()
  const { data: created, error } = await supabase
    .from('subject_workflow_actions')
    .insert({
      organization_id: organizationId,
      study_id: studyId,
      study_subject_id: subjectId,
      visit_id: visitId,
      procedure_execution_id: procedureExecutionId,
      source_response_set_id: sourceResponseSetId,
      source_section_key: sourceSectionKey,
      action_type: actionType,
      priority,
      title,
      description,
      assigned_role: assignedRole,
      due_date: dueDate,
      created_by: access.user.id,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: error.message }

  const chronologyType = workflowCreateEventType(actionType)
  if (chronologyType) {
    await logOperationalEvent({
      supabase,
      organizationId: organizationId!,
      studyId,
      visitId,
      procedureExecutionId,
      actorUserId: access.user.id,
      eventType: chronologyType,
      payload: {
        workflow_action_id: created.id,
        title,
        action_type: actionType,
        assigned_role: assignedRole,
      },
    })
  }
  revalidateWorkflowPaths(studyId, subjectId, visitId)
  return { ok: true, message: 'Workflow action created.' }
}

export async function resolveSubjectWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const actionId = clean(formData.get('workflow_action_id'))
  const organizationId = clean(formData.get('organization_id'))
  const studyId = clean(formData.get('study_id'))
  const subjectId = clean(formData.get('study_subject_id'))
  const visitId = clean(formData.get('visit_id'))
  const resolutionNote = clean(formData.get('resolution_note'))

  if (!actionId) return { ok: false, message: 'Missing workflow action.' }
  const access = await assertOrg(organizationId)
  if (!access.ok) return { ok: false, message: access.error }

  const supabase = await createServerClient()

  const { data: existing } = await supabase
    .from('subject_workflow_actions')
    .select('id, action_type, visit_id, procedure_execution_id, study_id, title')
    .eq('id', actionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const { error } = await supabase
    .from('subject_workflow_actions')
    .update({
      status: 'resolved',
      resolved_by: access.user.id,
      resolution_note: resolutionNote,
    })
    .eq('id', actionId)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, message: error.message }

  if (existing) {
    const resolveType = workflowResolveEventType(
      existing.action_type as SubjectWorkflowActionType,
    )
    if (resolveType) {
      await logOperationalEvent({
        supabase,
        organizationId: organizationId!,
        studyId: existing.study_id as string,
        visitId: (existing.visit_id as string | null) ?? null,
        procedureExecutionId: (existing.procedure_execution_id as string | null) ?? null,
        actorUserId: access.user.id,
        eventType: resolveType,
        payload: {
          workflow_action_id: existing.id,
          title: existing.title,
          resolution_note: resolutionNote,
        },
      })
    }
  }
  revalidateWorkflowPaths(studyId, subjectId, visitId)
  return { ok: true, message: 'Workflow action resolved.' }
}
