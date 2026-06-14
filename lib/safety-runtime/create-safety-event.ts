import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSafetyEventRow,
  SOURCE_TYPE,
  type CreateSafetyEventInput,
  type SafetyEventRow,
} from './safety-types'
import { generateSafetyTasks } from './generate-safety-tasks'
import { persistSafetyTasks } from './persist-safety-tasks'

function computeReportingDeadline(openedAt: string, severity: string | null | undefined): string {
  const base = new Date(openedAt)
  const days = severity === 'severe' ? 1 : 15 // 24h = 1 calendar day
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export async function createSafetyEvent(
  supabase: SupabaseClient,
  actorId: string,
  input: CreateSafetyEventInput,
): Promise<SafetyEventRow> {
  const now = new Date().toISOString()
  const isClassified = input.eventType != null
  const openedAt = input.openedAt ?? now
  const row: Record<string, unknown> = {
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
    opened_at: openedAt,
    created_by: actorId,
    updated_by: actorId,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  }

  if (isClassified && input.eventType === 'sae') {
    row.reporting_deadline_date = computeReportingDeadline(openedAt, input.severity)
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
