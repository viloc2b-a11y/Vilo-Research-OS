/**
 * Data-capture signals (source status, findings).
 *
 * Phase 7A: visit source/review status counts are aggregated in visit-signals.
 * Reserved for Phase 7C scoring inputs.
 */

import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type DataCaptureSignals = {
  findings: RawSignal<Record<string, never>>
}

export async function loadDataCaptureSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<DataCaptureSignals> {
  void client
  void scope
  return {
    findings: { source: 'data_capture_findings', rows: [], error: null },
  }
}
