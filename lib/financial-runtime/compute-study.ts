import { computeSubjectFinancialRuntime } from '@/lib/financial-runtime/compute-subject'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export type SubjectFinancialRow = {
  subjectId: string
  subjectCode: string
  expectedCents: number
  earnedCents: number
  invoicedCents: number
  paidCents: number
  leakageScore: number
}

export type StudyFinancialSummary = {
  studyId: string
  totalExpectedCents: number
  totalEarnedCents: number
  totalInvoicedCents: number
  totalPaidCents: number
  subjectCount: number
  visitCount: number
  earnRate: number
  leakageItemCount: number
  perSubject: SubjectFinancialRow[]
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a procedure count to a "cents" proxy.
 *
 * The financial-runtime layer tracks procedure counts, not dollar amounts.
 * Until an actual pricing layer exists, we use a 1 procedure = 100 cents proxy
 * so that the summary surface shows meaningful relative numbers.
 */
function countToCents(count: number): number {
  return count * 100
}

// ============================================================================
// Study-level rollup
// ============================================================================

export async function computeStudyFinancialSummary(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<StudyFinancialSummary> {
  const { supabase, organizationId, studyId } = args

  // Load all study subjects for this study
  const { data: subjectRows, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, subject_id, subject_code')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (subjectError) {
    throw new Error(`Failed to load study subjects: ${subjectError.message}`)
  }

  const subjects = subjectRows ?? []

  // Load invoice totals per study_subject from financial_invoices
  const { data: invoiceRows } = await supabase
    .from('financial_invoices')
    .select('study_subject_id, total_amount, amount_paid, payment_status')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  // Build per-subject invoice/paid maps (amounts in cents = amount * 100)
  const invoicedBySubject: Record<string, number> = {}
  const paidBySubject: Record<string, number> = {}

  for (const inv of invoiceRows ?? []) {
    const ssid = String(inv.study_subject_id)
    invoicedBySubject[ssid] = (invoicedBySubject[ssid] ?? 0) + Math.round(Number(inv.total_amount ?? 0) * 100)
    paidBySubject[ssid] = (paidBySubject[ssid] ?? 0) + Math.round(Number(inv.amount_paid ?? 0) * 100)
  }

  // Load visit counts per subject
  const { data: visitCountRows } = await supabase
    .from('visits')
    .select('study_subject_id')
    .eq('study_id', studyId)

  const visitCountBySubject: Record<string, number> = {}
  let totalVisitCount = 0

  for (const row of visitCountRows ?? []) {
    const ssid = String(row.study_subject_id)
    visitCountBySubject[ssid] = (visitCountBySubject[ssid] ?? 0) + 1
    totalVisitCount++
  }

  // Compute per-subject financial runtime (procedure counts → cent proxies)
  const perSubject: SubjectFinancialRow[] = []
  let totalExpectedCents = 0
  let totalEarnedCents = 0
  let totalInvoicedCents = 0
  let totalPaidCents = 0
  let totalLeakageItems = 0

  for (const subject of subjects) {
    const ssid = String(subject.id)
    const subjectCode = String(subject.subject_code ?? subject.subject_id ?? ssid)

    let expectedCents = 0
    let earnedCents = 0
    let leakageScore = 0

    try {
      const runtime = await computeSubjectFinancialRuntime({
        supabase,
        organizationId,
        studyId,
        studySubjectId: ssid,
      })
      expectedCents = countToCents(runtime.expected.procedureCount)
      earnedCents = countToCents(runtime.earned.procedureEarnedCount)
      leakageScore = runtime.leakageScore
      totalLeakageItems += runtime.leakage.length
    } catch {
      // Non-fatal: subject may have no visits yet
    }

    const invoicedCents = invoicedBySubject[ssid] ?? 0
    const paidCents = paidBySubject[ssid] ?? 0

    totalExpectedCents += expectedCents
    totalEarnedCents += earnedCents
    totalInvoicedCents += invoicedCents
    totalPaidCents += paidCents

    perSubject.push({
      subjectId: ssid,
      subjectCode,
      expectedCents,
      earnedCents,
      invoicedCents,
      paidCents,
      leakageScore,
    })
  }

  const earnRate = totalExpectedCents > 0 ? totalEarnedCents / totalExpectedCents : 0

  return {
    studyId,
    totalExpectedCents,
    totalEarnedCents,
    totalInvoicedCents,
    totalPaidCents,
    subjectCount: subjects.length,
    visitCount: totalVisitCount,
    earnRate,
    leakageItemCount: totalLeakageItems,
    perSubject,
  }
}
