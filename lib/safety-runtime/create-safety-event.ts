import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSafetyEventRow,
  SOURCE_TYPE,
  type CreateSafetyEventInput,
  type SafetyEventRow,
} from './safety-types'
import { generateSafetyTasks } from './generate-safety-tasks'
import { persistSafetyTasks } from './persist-safety-tasks'

export async function createSafetyEvent(
  supabase: SupabaseClient,
  actorId: string,
  input: CreateSafetyEventInput,
): Promise<SafetyEventRow> {
  const now = new Date().toISOString()
  const isClassified = input.eventType != null
  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    subject_id: input.subjectId,
    visit_id: input.visitId ?? null,
    event_type: input.eventType ?? null,
    event_status: isClassified ? 'open' : 'candidate',
    source_type: input.sourceType ?? SOURCE_TYPE.MANUAL,
    description: input.description,
    severity: input.severity ?? null,
    relatedness: input.relatedness ?? null,
    requires_follow_up: input.requiresFollowUp ?? false,
    opened_at: input.openedAt ?? now,
    created_by: actorId,
    updated_by: actorId,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('safety_events')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create safety event: ${error?.message ?? 'Unknown error'}`,
    )
  }

  const event = mapSafetyEventRow(data as Record<string, unknown>)

  // Auto-generate compliance tasks based on event type and severity.
  const tasks = generateSafetyTasks({
    eventId: event.id,
    organizationId: event.organizationId,
    eventType: event.eventType,
    severity: event.severity,
    eventDate: new Date(event.openedAt),
  })

  await persistSafetyTasks({ supabase, tasks })

  return event
}
