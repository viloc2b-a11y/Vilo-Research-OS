/**
 * Break-glass access request foundation (v0: record + spine event only; no permission expansion).
 */

import { observeBreakGlassAccessRequested } from '@/lib/observability/hooks/observe-compliance-guardrails'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { validateBreakGlassAccessRequest } from '@/lib/break-glass/validate-request'
import type {
  BreakGlassAccessRequestInput,
  BreakGlassAccessRequestResult,
} from '@/lib/break-glass/types'
import { BREAK_GLASS_STATUS } from '@/lib/break-glass/constants'
import { coordinatorMessageFromError, logCoordinatorRuntimeError } from '@/lib/runtime-errors'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function requestBreakGlassAccess(
  input: BreakGlassAccessRequestInput,
): Promise<BreakGlassAccessRequestResult> {
  const errors = validateBreakGlassAccessRequest(input)
  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const supabase = input.supabase as SupabaseClient
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt.toISOString()
      : new Date(input.expiresAt).toISOString()

  const notifiedUserIds = input.notifiedUserIds ?? []

  const { data, error } = await supabase
    .from('break_glass_access_events')
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      study_id: input.studyId ?? null,
      study_subject_id: input.studySubjectId ?? null,
      visit_id: input.visitId ?? null,
      procedure_execution_id: input.procedureExecutionId ?? null,
      workflow_key: input.workflowKey,
      base_authority_level: input.baseAuthorityLevel ?? null,
      effective_authority_level: input.effectiveAuthorityLevel ?? null,
      access_scope: input.accessScope,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      justification: input.justification.trim(),
      approval_mode: input.approvalMode,
      approved_by: input.approvalMode === 'self_granted' ? input.actorUserId : null,
      notified_user_ids: notifiedUserIds,
      status: BREAK_GLASS_STATUS.ACTIVE,
      expires_at: expiresAt,
      post_review_required: input.postReviewRequired ?? true,
    })
    .select('id')
    .single()

  if (error) {
    logCoordinatorRuntimeError('break_glass.request_access', error)
    return {
      ok: false,
      errors: [
        coordinatorMessageFromError(error, {
          context: 'break_glass.request_access',
          fallbackMessage: 'Could not record emergency access request.',
        }),
      ],
    }
  }

  const eventId = data.id as string

  const studyId = input.studyId as string

  const operationalEventId = await emitClinicalOperationalEvent({
    supabase: supabase as never,
    organizationId: input.organizationId,
    studyId,
    visitId: input.visitId ?? null,
    procedureExecutionId: input.procedureExecutionId ?? null,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.BREAK_GLASS_ACCESS_REQUESTED,
    payloadSource: 'break-glass',
    mutation: 'break_glass.request_access',
    subjectId: input.studySubjectId ?? null,
    details: {
      break_glass_event_id: eventId,
      workflow_key: input.workflowKey,
      access_scope: input.accessScope,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      approval_mode: input.approvalMode,
      expires_at: expiresAt,
    },
  })

  if (operationalEventId) {
    await supabase
      .from('break_glass_access_events')
      .update({ operational_event_id: operationalEventId })
      .eq('id', eventId)
  }

  observeBreakGlassAccessRequested({
    supabase,
    organizationId: input.organizationId,
    studyId,
    actorUserId: input.actorUserId,
    eventId,
    operationalEventId,
    workflowKey: input.workflowKey,
    baseAuthorityLevel: input.baseAuthorityLevel ?? null,
    effectiveAuthorityLevel: input.effectiveAuthorityLevel ?? null,
    accessScope: input.accessScope,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    approvalMode: input.approvalMode,
    studySubjectId: input.studySubjectId ?? null,
    visitId: input.visitId ?? null,
    procedureExecutionId: input.procedureExecutionId ?? null,
  })

  return { ok: true, eventId, operationalEventId }
}
