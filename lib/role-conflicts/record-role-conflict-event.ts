/**
 * Persist role conflict event + emit ROLE_CONFLICT_DETECTED (audit trail; no global block).
 */

import { observeRoleConflictDetected } from '@/lib/observability/hooks/observe-audit-integrity'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import {
  ROLE_CONFLICT_RESOLUTION,
  roleConflictRequiresJustification,
} from '@/lib/role-conflicts/constants'
import type { RecordRoleConflictEventInput } from '@/lib/role-conflicts/types'
import { redactGuardrailMetadata } from '@/lib/temporal-consistency/redact-metadata'

export type RecordRoleConflictEventResult = {
  eventId: string
  operationalEventId: string | null
  justificationMissing: boolean
}

export async function recordRoleConflictEvent(
  input: RecordRoleConflictEventInput,
): Promise<RecordRoleConflictEventResult> {
  const justificationMissing = roleConflictRequiresJustification({
    resolution: input.resolution,
    justificationRequired: true,
    justification: input.justification,
  })

  if (
    input.resolution === ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION &&
    justificationMissing
  ) {
    throw new Error(
      'recordRoleConflictEvent: justification required (min 10 chars) for allowed_with_justification',
    )
  }

  const metadata = redactGuardrailMetadata(input.metadata ?? {})

  const operationalEventId = await emitClinicalOperationalEvent({
    supabase: input.supabase as never,
    organizationId: input.organizationId,
    studyId: input.studyId ?? input.organizationId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.ROLE_CONFLICT_DETECTED,
    payloadSource: 'role-conflicts',
    mutation: 'role_conflicts.record_event',
    details: {
      workflow_key: input.workflowKey,
      conflict_type: input.conflictType,
      resolution: input.resolution,
      action_attempted: input.actionAttempted,
    },
  }).catch(() => null)

  const { data, error } = await input.supabase
    .from('role_conflict_events')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId ?? null,
      actor_user_id: input.actorUserId,
      workflow_key: input.workflowKey,
      action_attempted: input.actionAttempted,
      conflicting_role: input.conflictingRole ?? null,
      conflict_type: input.conflictType,
      resolution: input.resolution,
      justification: input.justification?.trim() ?? null,
      operational_event_id: operationalEventId,
      metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`recordRoleConflictEvent failed: ${error.message}`)
  }

  const eventId = data.id as string

  observeRoleConflictDetected({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId ?? null,
    actorUserId: input.actorUserId,
    workflowKey: input.workflowKey,
    conflictType: input.conflictType,
    resolution: input.resolution,
    eventId,
    operationalEventId,
    actionAttempted: input.actionAttempted,
  })

  return { eventId, operationalEventId, justificationMissing: false }
}
