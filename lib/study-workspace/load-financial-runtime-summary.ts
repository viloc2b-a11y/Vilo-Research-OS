import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

const FINANCIAL_SAMPLE_LIMIT = 500

export type StudyFinancialRuntimeSummary = {
  projectionCount: number | null
  leakageVisitCount: number | null
  expectedProcedureCount: number | null
  executedProcedureCount: number | null
  earnedProcedureCount: number | null
  leakageItemCount: number | null
  averageEarnedRateBasisPoints: number | null
  maxLeakageScore: number | null
  sampleLimit: number
  unavailable: string[]
}

async function safeExactCount(
  label: string,
  unavailable: string[],
  run: () => Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return null
    }
    return count ?? 0
  } catch (err) {
    unavailable.push(`${label}: ${err instanceof Error ? err.message : 'unavailable'}`)
    return null
  }
}

export async function loadStudyFinancialRuntimeSummary(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyFinancialRuntimeSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [projectionCount, leakageVisitCount] = await Promise.all([
    safeExactCount('Financial projections', unavailable, async () =>
      supabase
        .from('visit_financial_runtime_projections')
        .select('visit_id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId),
    ),
    safeExactCount('Leakage visits', unavailable, async () =>
      supabase
        .from('visit_financial_runtime_projections')
        .select('visit_id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .gt('leakage_score', 0),
    ),
  ])

  let expectedProcedureCount: number | null = null
  let executedProcedureCount: number | null = null
  let earnedProcedureCount: number | null = null
  let leakageItemCount: number | null = null
  let averageEarnedRateBasisPoints: number | null = null
  let maxLeakageScore: number | null = null

  try {
    const { data, error } = await supabase
      .from('visit_financial_runtime_projections')
      .select(
        `
        expected_procedure_count,
        executed_procedure_count,
        earned_procedure_count,
        leakage_item_count,
        leakage_score,
        earned_rate_basis_points
      `,
      )
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .order('computed_at', { ascending: false })
      .limit(FINANCIAL_SAMPLE_LIMIT)

    if (error) {
      unavailable.push(`Financial runtime rollup: ${error.message}`)
    } else {
      const rows = data ?? []
      expectedProcedureCount = rows.reduce(
        (sum, row) => sum + Number(row.expected_procedure_count ?? 0),
        0,
      )
      executedProcedureCount = rows.reduce(
        (sum, row) => sum + Number(row.executed_procedure_count ?? 0),
        0,
      )
      earnedProcedureCount = rows.reduce(
        (sum, row) => sum + Number(row.earned_procedure_count ?? 0),
        0,
      )
      leakageItemCount = rows.reduce(
        (sum, row) => sum + Number(row.leakage_item_count ?? 0),
        0,
      )
      maxLeakageScore = rows.reduce(
        (max, row) => Math.max(max, Number(row.leakage_score ?? 0)),
        0,
      )

      const earnedRateRows = rows.filter(
        (row) => Number.isFinite(Number(row.earned_rate_basis_points)),
      )
      averageEarnedRateBasisPoints =
        earnedRateRows.length > 0
          ? Math.round(
              earnedRateRows.reduce(
                (sum, row) => sum + Number(row.earned_rate_basis_points ?? 0),
                0,
              ) / earnedRateRows.length,
            )
          : 0
    }
  } catch (err) {
    unavailable.push(
      `Financial runtime rollup: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
  }

  return {
    projectionCount,
    leakageVisitCount,
    expectedProcedureCount,
    executedProcedureCount,
    earnedProcedureCount,
    leakageItemCount,
    averageEarnedRateBasisPoints,
    maxLeakageScore,
    sampleLimit: FINANCIAL_SAMPLE_LIMIT,
    unavailable,
  }
}
