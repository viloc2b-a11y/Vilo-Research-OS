import type { SubjectFinancialRuntime, VisitFinancialRuntime } from '@/lib/financial-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertVisitFinancialRuntimeProjection(
  supabase: SupabaseClient,
  financial: VisitFinancialRuntime,
): Promise<void> {
  const { error } = await supabase.from('visit_financial_runtime_projections').upsert({
    visit_id: financial.visitId,
    organization_id: financial.organizationId,
    study_id: financial.studyId,
    study_subject_id: financial.studySubjectId,
    computed_at: financial.computedAt,
    financial_version: financial.financialVersion,
    expected: financial.expected,
    executed: financial.executed,
    earned: financial.earned,
    leakage: financial.leakage,
    coordinator_economics: financial.coordinatorEconomics,
    unscheduled_burden: financial.unscheduledBurden,
    amendment_impact: financial.amendmentImpact,
    procedure_attributions: financial.procedureAttributions,
    expected_procedure_count: financial.expected.procedureCount,
    executed_procedure_count: financial.executed.procedureCompletedCount,
    earned_procedure_count: financial.earned.procedureEarnedCount,
    leakage_item_count: financial.leakage.length,
    leakage_score: financial.leakageScore,
    earned_rate_basis_points: financial.earnedRateBasisPoints,
    visit_financial_burden_score: financial.visitFinancialBurdenScore,
    safeguards: financial.safeguards,
    snapshot: financial.snapshot,
  })

  if (error) throw new Error(error.message)
}

export async function upsertSubjectFinancialRuntimeProjection(
  supabase: SupabaseClient,
  financial: SubjectFinancialRuntime,
): Promise<void> {
  const snapshot = {
    ...financial.snapshot,
    safeguards: financial.safeguards,
  }
  const row = {
    study_subject_id: financial.studySubjectId,
    organization_id: financial.organizationId,
    study_id: financial.studyId,
    computed_at: financial.computedAt,
    financial_version: financial.financialVersion,
    expected: financial.expected,
    executed: financial.executed,
    earned: financial.earned,
    leakage: financial.leakage,
    coordinator_economics: financial.coordinatorEconomics,
    unscheduled_burden: financial.unscheduledBurden,
    amendment_impact: financial.amendmentImpact,
    expected_procedure_count: financial.expected.procedureCount,
    executed_procedure_count: financial.executed.procedureCompletedCount,
    earned_procedure_count: financial.earned.procedureEarnedCount,
    leakage_item_count: financial.leakage.length,
    leakage_score: financial.leakageScore,
    earned_rate_basis_points: financial.earnedRateBasisPoints,
    safeguards: financial.safeguards,
    snapshot,
  }

  let { error } = await supabase.from('subject_financial_runtime_projections').upsert(row)

  if (error && /safeguards/i.test(error.message)) {
    const { safeguards: _omit, ...withoutSafeguards } = row
    ;({ error } = await supabase.from('subject_financial_runtime_projections').upsert(withoutSafeguards))
  }

  if (error) throw new Error(error.message)
}
