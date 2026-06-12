import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { FINANCIAL_LEAKAGE_RISK_LIMIT } from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'
import { filterDashboardTestDataRows } from '@/lib/dashboard-test-data'

export type FinancialLeakageRiskRow = Record<string, unknown>

export async function loadFinancialLeakageRiskSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<FinancialLeakageRiskRow>> {
  const { data, error } = await client
    .from('visit_financial_runtime_projections')
    .select(
      `
      visit_id,
      organization_id,
      study_id,
      study_subject_id,
      computed_at,
      expected_procedure_count,
      executed_procedure_count,
      earned_procedure_count,
      leakage_item_count,
      leakage_score,
      earned_rate_basis_points,
      leakage,
      snapshot,
      study_subjects(subject_identifier),
      studies(name, slug, created_source)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .gt('leakage_score', 0)
    .order('leakage_score', { ascending: false })
    .order('computed_at', { ascending: false })
    .limit(FINANCIAL_LEAKAGE_RISK_LIMIT)

  if (error) {
    return {
      source: 'financial_leakage',
      rows: [],
      error: { source: 'financial_leakage', message: error.message },
    }
  }

  return {
    source: 'financial_leakage',
    rows: filterDashboardTestDataRows((data ?? []) as FinancialLeakageRiskRow[]),
    error: null,
  }
}
