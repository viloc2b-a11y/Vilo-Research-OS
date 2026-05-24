/**
 * Phase 1C — Centralized emission for clinical mutations.
 * operational_events is the canonical runtime chronology.
 */

import {
  buildOperationalEventPayload,
  type BuildOperationalPayloadInput,
  type OperationalPayloadSource,
} from '@/lib/operations/event-payload'
import type { OperationalEventType } from '@/lib/operations/event-types'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { observeClinicalMutationEmitted } from '@/lib/observability/hooks/observe-clinical-mutation'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export type ClinicalMutationEmitInput = {
  supabase: Supabase
  organizationId: string
  studyId: string
  eventType: OperationalEventType | string
  actorUserId: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  payloadSource: OperationalPayloadSource
  mutation: string
  subjectId?: string | null
  details?: Record<string, unknown>
}

/**
 * Append an immutable operational event with a standard payload envelope.
 * Throws on insert failure so callers cannot complete mutations silently.
 */
export async function emitClinicalOperationalEvent(
  input: ClinicalMutationEmitInput,
): Promise<string | null> {
  const payload = buildOperationalEventPayload({
    source: input.payloadSource,
    mutation: input.mutation,
    subjectId: input.subjectId,
    details: input.details,
  })

  let sourceOperationalEventId: string | null = null
  try {
    sourceOperationalEventId = await logOperationalEvent({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId,
      procedureExecutionId: input.procedureExecutionId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      payload,
    })
    observeClinicalMutationEmitted({
      ...input,
      sourceOperationalEventId,
      failed: false,
    })
    return sourceOperationalEventId
  } catch (error) {
    observeClinicalMutationEmitted({
      ...input,
      sourceOperationalEventId,
      failed: true,
    })
    throw error
  }
}

export async function emitVisitClinicalEvent(
  params: Omit<ClinicalMutationEmitInput, 'visitId'> & { visitId: string },
): Promise<void> {
  await emitClinicalOperationalEvent(params)
}

export async function emitStudyClinicalEvent(
  params: Omit<ClinicalMutationEmitInput, 'visitId' | 'procedureExecutionId'>,
): Promise<void> {
  await emitClinicalOperationalEvent({
    ...params,
    visitId: null,
    procedureExecutionId: null,
  })
}

/** Bridge profile-domain writes onto the operational spine. */
export async function emitClinicalProfileBridgeEvent(params: {
  supabase: Supabase
  organizationId: string
  studyId: string
  subjectId: string
  actorUserId: string
  eventType: OperationalEventType | string
  payloadSource: OperationalPayloadSource
  mutation: string
  visitId?: string | null
  profileSection: string
  profileEventType: string
  recordId: string
  profileEventId?: string | null
  details?: Record<string, unknown>
}): Promise<void> {
  const details = {
    bridge: 'subject_clinical_profile_events',
    profile_section: params.profileSection,
    profile_event_type: params.profileEventType,
    record_id: params.recordId,
    profile_event_id: params.profileEventId ?? null,
    ...params.details,
  }

  const base = {
    supabase: params.supabase,
    organizationId: params.organizationId,
    studyId: params.studyId,
    actorUserId: params.actorUserId,
    eventType: params.eventType,
    payloadSource: params.payloadSource,
    mutation: params.mutation,
    subjectId: params.subjectId,
    details,
  }

  if (params.visitId) {
    await emitVisitClinicalEvent({ ...base, visitId: params.visitId })
  } else {
    await emitStudyClinicalEvent(base)
  }
}

export const ClinicalMutationGateway = {
  emit: emitClinicalOperationalEvent,
  emitVisit: emitVisitClinicalEvent,
  emitStudy: emitStudyClinicalEvent,
  emitProfileBridge: emitClinicalProfileBridgeEvent,
  buildPayload: buildOperationalEventPayload,
} as const

export type { BuildOperationalPayloadInput }
