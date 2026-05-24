/**
 * Bridge missing VISIT_CHECKED_IN spine events for visits already in active status
 * (e.g. legacy in_progress rows created before gateway check-in).
 */

import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { normalizeOperationalEventType } from '@/lib/runtime-integrity/event-registry/normalize'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_VISIT_STATUSES = new Set(['checked_in', 'in_progress', 'completed', 'locked'])

export type EnsureVisitCheckInChronologyResult = {
  bridged: boolean
  skipped: boolean
  reason: string
}

export async function ensureVisitCheckInChronology(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  actorUserId: string | null
}): Promise<EnsureVisitCheckInChronologyResult> {
  const { data: visit, error: visitErr } = await input.supabase
    .from('visits')
    .select('visit_status')
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (visitErr) {
    return { bridged: false, skipped: true, reason: visitErr.message }
  }
  if (!visit) {
    return { bridged: false, skipped: true, reason: 'visit not found' }
  }

  const status = visit.visit_status as string
  if (!ACTIVE_VISIT_STATUSES.has(status)) {
    return {
      bridged: false,
      skipped: true,
      reason: `visit status ${status} does not require check-in chronology`,
    }
  }

  const { data: events } = await input.supabase
    .from('operational_events')
    .select('event_type')
    .eq('visit_id', input.visitId)
    .eq('organization_id', input.organizationId)

  const hasCheckIn = (events ?? []).some(
    (row) =>
      normalizeOperationalEventType(row.event_type as string).canonical ===
      OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN,
  )

  if (hasCheckIn) {
    return { bridged: false, skipped: true, reason: 'VISIT_CHECKED_IN already present' }
  }

  await ClinicalMutationGateway.emitVisit({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN,
    payloadSource: 'visit-check-in-chronology-bridge',
    mutation: 'visits.check_in_chronology_bridge',
    details: {
      chronology_bridge: true,
      visit_status_at_bridge: status,
      checked_in_at: null,
      product_boundary: 'compensating_chronology_no_status_change',
    },
  })

  return { bridged: true, skipped: false, reason: 'VISIT_CHECKED_IN chronology bridge emitted' }
}
