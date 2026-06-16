import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateBHR } from '@/lib/cliniq-core/analysis/negotiation-engine'

export type AmendmentFinancialExposure = {
  studyId: string
  affectedSubjectCount: number
  amendmentCount: number
  perAmendmentFeeEstimate: number | null
  reconsentPerPatientEstimate: number | null
  totalExposureEstimate: number | null
  certaintyLevel: 'ESTIMATED' | 'REQUIRES_SITE_RATES'
  note: string
}

const DEFAULT_AMEND_PI_HRS = 4
const DEFAULT_AMEND_CRC_HRS = 8
const DEFAULT_RECONSENT_CRC_HRS = 1.5

export async function estimateAmendmentFinancialExposure(
  supabase: SupabaseClient,
  { studyId, organizationId }: { studyId: string; organizationId: string },
): Promise<AmendmentFinancialExposure> {
  const [impactsResult, rateProfileResult, subjectCountResult] = await Promise.allSettled([
    supabase
      .from('amendment_subject_impacts')
      .select('id, protocol_version_id')
      .eq('study_id', studyId),
    supabase
      .from('site_rate_profiles')
      .select('pi_hourly_salary, crc_hourly_salary, benefits_pct, overhead_pct, margin_pct')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .maybeSingle(),
    supabase
      .from('study_subjects')
      .select('id')
      .eq('study_id', studyId),
  ])

  const impacts =
    impactsResult.status === 'fulfilled' ? (impactsResult.value.data ?? []) : []
  const rateProfile =
    rateProfileResult.status === 'fulfilled' ? rateProfileResult.value.data : null
  const subjectCount =
    subjectCountResult.status === 'fulfilled'
      ? (subjectCountResult.value.data?.length ?? 0)
      : 0

  const uniqueAmendments = new Set(
    impacts.map((i) => (i as Record<string, unknown>).protocol_version_id as string),
  )
  const amendmentCount = uniqueAmendments.size
  const affectedSubjectCount = impacts.length

  if (!rateProfile) {
    return {
      studyId,
      affectedSubjectCount,
      amendmentCount,
      perAmendmentFeeEstimate: null,
      reconsentPerPatientEstimate: null,
      totalExposureEstimate: null,
      certaintyLevel: 'REQUIRES_SITE_RATES',
      note: 'Exposure estimate requires site rate profile. Configure rates in the Negotiation portal.',
    }
  }

  const { pi_hourly_salary, crc_hourly_salary, benefits_pct, overhead_pct, margin_pct } = rateProfile as {
    pi_hourly_salary: number
    crc_hourly_salary: number
    benefits_pct: number
    overhead_pct: number
    margin_pct: number
  }

  const bhrPi = calculateBHR(pi_hourly_salary, benefits_pct, overhead_pct, margin_pct)
  const bhrCrc = calculateBHR(crc_hourly_salary, benefits_pct, overhead_pct, margin_pct)

  const perAmendmentFeeEstimate =
    Math.round((DEFAULT_AMEND_PI_HRS * bhrPi + DEFAULT_AMEND_CRC_HRS * bhrCrc) * 100) / 100
  const reconsentPerPatientEstimate =
    Math.round(DEFAULT_RECONSENT_CRC_HRS * bhrCrc * 100) / 100

  const reconsentSubjects = impacts.filter(
    (i) => (i as Record<string, unknown>).requires_reconsent,
  ).length

  const totalExposureEstimate =
    Math.round(
      (perAmendmentFeeEstimate * amendmentCount +
        reconsentPerPatientEstimate * reconsentSubjects) *
        100,
    ) / 100

  return {
    studyId,
    affectedSubjectCount,
    amendmentCount,
    perAmendmentFeeEstimate,
    reconsentPerPatientEstimate,
    totalExposureEstimate,
    certaintyLevel: 'ESTIMATED',
    note: `Estimated using default amendment burden (${DEFAULT_AMEND_PI_HRS}h PI, ${DEFAULT_AMEND_CRC_HRS}h CRC per amendment; ${DEFAULT_RECONSENT_CRC_HRS}h CRC per reconsent). Verify in Negotiation portal.`,
  }
}
