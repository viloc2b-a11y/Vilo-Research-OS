import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { BLOCKED_PROCEDURES_RISK_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type BlockedProcedureRow = Record<string, unknown>

export async function loadBlockedProcedures(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<BlockedProcedureRow>> {
  const { data, error } = await client
    .from('procedure_executions')
    .select(
      `
      id,
      study_id,
      organization_id,
      visits(id, study_subject_id, study_subjects(subject_identifier)),
      studies(name),
      procedure_definitions(label, code)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .eq('validation_status', 'blocked')
    .limit(BLOCKED_PROCEDURES_RISK_LIMIT)

  if (error) {
    return {
      source: 'blocked_detail',
      rows: [],
      error: { source: 'blocked_detail', message: error.message },
    }
  }

  return { source: 'blocked_detail', rows: (data ?? []) as BlockedProcedureRow[], error: null }
}
