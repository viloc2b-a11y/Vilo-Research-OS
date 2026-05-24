import { normalizeOperationalEventType } from '@/lib/runtime-integrity/event-registry/normalize'
import { SILENT_MUTATION_PATCH_PLAN } from '@/lib/runtime-integrity/detect/silent-mutation-catalog'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ReplayGap = {
  id: string
  kind: 'missing_spine_event' | 'catalogued_silent' | 'unregistered_event_type' | 'low_chronology_coverage'
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail: string
  expectedEventType?: string | null
}

/** Mutations that should produce spine events when execution state changes. */
export const MUTATION_EVENT_EXPECTATIONS: Array<{
  executionSignal: string
  expectedEventTypes: string[]
}> = [
  { executionSignal: 'visit_status_checked_in', expectedEventTypes: ['VISIT_CHECKED_IN'] },
  { executionSignal: 'visit_rescheduled', expectedEventTypes: ['VISIT_RESCHEDULED'] },
  { executionSignal: 'procedure_signed', expectedEventTypes: ['PROCEDURE_SIGNED'] },
  { executionSignal: 'source_submitted', expectedEventTypes: ['SOURCE_RESPONSE_SET_SUBMITTED'] },
  { executionSignal: 'ae_open', expectedEventTypes: ['ADVERSE_EVENT_CREATED', 'ADVERSE_EVENT_UPDATED'] },
]

export function detectCataloguedReplayGaps(): ReplayGap[] {
  return SILENT_MUTATION_PATCH_PLAN.filter((e) => e.status === 'silent' || e.status === 'partial').map(
    (e) => ({
      id: `catalog:${e.id}`,
      kind: 'catalogued_silent' as const,
      severity: e.priority === 'critical' ? 'critical' : e.priority === 'high' ? 'warning' : 'info',
      label: e.mutation,
      detail: e.notes,
      expectedEventType: e.expectedEventType,
    }),
  )
}

export async function detectVisitReplayGaps(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<ReplayGap[]> {
  const gaps: ReplayGap[] = [...detectCataloguedReplayGaps()]

  const { data: visit } = await input.supabase
    .from('visits')
    .select('visit_status, rescheduled_at, visit_review_status')
    .eq('id', input.visitId)
    .maybeSingle()

  const { data: events } = await input.supabase
    .from('operational_events')
    .select('event_type')
    .eq('visit_id', input.visitId)
    .eq('organization_id', input.organizationId)

  const eventTypes = new Set(
    (events ?? []).map((e) => normalizeOperationalEventType(e.event_type as string).canonical),
  )

  if (
    visit
    && ['checked_in', 'in_progress', 'completed', 'locked'].includes(visit.visit_status as string)
    && !eventTypes.has('VISIT_CHECKED_IN')
  ) {
    gaps.push({
      id: 'gap:visit-checked-in-missing',
      kind: 'missing_spine_event',
      severity: 'warning',
      label: 'Check-in without spine event',
      detail: `Visit status is ${visit.visit_status} but VISIT_CHECKED_IN not found in chronology.`,
      expectedEventType: 'VISIT_CHECKED_IN',
    })
  }

  if (visit?.rescheduled_at && !eventTypes.has('VISIT_RESCHEDULED')) {
    gaps.push({
      id: 'gap:visit-rescheduled-missing',
      kind: 'missing_spine_event',
      severity: 'warning',
      label: 'Reschedule without spine event',
      detail: 'Visit has rescheduled_at but VISIT_RESCHEDULED not in chronology.',
      expectedEventType: 'VISIT_RESCHEDULED',
    })
  }

  if (visit?.visit_review_status === 'coordinator_signed' && !eventTypes.has('COORDINATOR_SIGNED')) {
    gaps.push({
      id: 'gap:coordinator-sign-missing',
      kind: 'missing_spine_event',
      severity: 'warning',
      label: 'Coordinator signoff without spine event',
      detail: 'visit_review_status indicates coordinator signed but event missing.',
      expectedEventType: 'COORDINATOR_SIGNED',
    })
  }

  for (const et of eventTypes) {
    const norm = normalizeOperationalEventType(et)
    if (!norm.registered) {
      gaps.push({
        id: `gap:unregistered:${et}`,
        kind: 'unregistered_event_type',
        severity: 'info',
        label: 'Unregistered event type in chronology',
        detail: `Event type "${et}" is not in OPERATIONAL_EVENT_TYPES registry.`,
      })
    }
    if (norm.namingDrift) {
      gaps.push({
        id: `gap:drift:${et}`,
        kind: 'unregistered_event_type',
        severity: 'info',
        label: 'Event naming drift',
        detail: `Non-canonical casing "${et}" — normalize to ${norm.canonical}.`,
        expectedEventType: norm.canonical,
      })
    }
  }

  if ((events ?? []).length === 0 && visit) {
    gaps.push({
      id: 'gap:no-chronology',
      kind: 'low_chronology_coverage',
      severity: 'info',
      label: 'Empty visit chronology',
      detail: 'No operational_events for visit — replay relies on execution tables only.',
    })
  }

  void input.studyId
  return gaps
}
