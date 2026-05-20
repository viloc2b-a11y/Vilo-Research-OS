/**
 * Operational event signals (audit / chronology).
 *
 * Phase 7A: no event row reads feed /performance yet. Reserved for Phase 7E.
 */

import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type EventSignals = {
  events: RawSignal<Record<string, never>>
}

export async function loadEventSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<EventSignals> {
  void client
  void scope
  return {
    events: { source: 'operational_events', rows: [], error: null },
  }
}
