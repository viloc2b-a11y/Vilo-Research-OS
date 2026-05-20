/**
 * Subject-level signals (enrollment counts, risk markers).
 *
 * Phase 7A: per-study subject counts live in study-signals (loadStudyCardCounts).
 * This module is reserved for future subject-scoped row reads (Phase 7C scoring).
 */

import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type SubjectSignals = {
  /** Placeholder — no additional subject row reads in Phase 7A. */
  markers: RawSignal<Record<string, never>>
}

export async function loadSubjectSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<SubjectSignals> {
  void client
  void scope
  return {
    markers: { source: 'subject_markers', rows: [], error: null },
  }
}
