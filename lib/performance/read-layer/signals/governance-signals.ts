import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { GOVERNANCE_SIGNALS_RISK_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type GovernanceSignalRow = Record<string, unknown>

export async function loadOpenGovernanceSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<GovernanceSignalRow>> {
  const { data, error } = await client
    .from('governance_signals')
    .select(
      `
      id,
      organization_id,
      study_id,
      study_subject_id,
      visit_id,
      procedure_execution_id,
      source_response_set_id,
      workflow_action_id,
      signal_key,
      signal_type,
      severity,
      status,
      label,
      detail,
      detected_at,
      derivation,
      study_subjects(subject_identifier),
      studies(name)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('status', ['open', 'acknowledged'])
    .in('severity', ['blocker', 'warning'])
    .order('detected_at', { ascending: true })
    .limit(GOVERNANCE_SIGNALS_RISK_LIMIT)

  if (error) {
    return {
      source: 'governance_signals',
      rows: [],
      error: { source: 'governance_signals', message: error.message },
    }
  }

  return {
    source: 'governance_signals',
    rows: (data ?? []) as GovernanceSignalRow[],
    error: null,
  }
}
