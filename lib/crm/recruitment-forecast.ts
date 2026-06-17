import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEnrollmentVelocity } from './enrollment-velocity'
import { loadRecruitmentFunnelSummary } from './recruitment-intelligence'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecruitmentForecastInputs = {
  enrollment_target: number
  enrollment_deadline: string
  randomized_count: number
  qualified_count: number
  current_velocity: number
  screen_failure_rate: number
  funnel_lead_to_randomize_rate: number
}

export type RecruitmentForecast = {
  subjects_remaining: number
  projected_enrollment_date: string | null
  days_to_projected: number | null
  days_to_deadline: number
  required_run_rate: number
  run_rate_gap: number
  leads_required: number
  current_pipeline_coverage: number
  probability_of_hitting_target: number
  risk_classification: 'on_track' | 'at_risk' | 'critical' | 'impossible'
  as_of: string
}

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Sentinel for Infinity to keep JSON serializable
const INF_SENTINEL = 9999

// ---------------------------------------------------------------------------
// computeRecruitmentForecast — pure function, no I/O
// ---------------------------------------------------------------------------

export function computeRecruitmentForecast(inputs: RecruitmentForecastInputs): RecruitmentForecast {
  const {
    enrollment_target,
    enrollment_deadline,
    randomized_count,
    qualified_count,
    current_velocity,
    screen_failure_rate,
    funnel_lead_to_randomize_rate,
  } = inputs

  const as_of = new Date().toISOString()
  const now = Date.now()
  const todayIso = new Date(now).toISOString().split('T')[0]

  const subjects_remaining = Math.max(0, enrollment_target - randomized_count)

  const days_to_deadline = Math.floor((Date.parse(enrollment_deadline) - now) / 86_400_000)
  const weeks_to_deadline = days_to_deadline / 7

  // required_run_rate
  let required_run_rate: number
  if (weeks_to_deadline > 0) {
    required_run_rate = subjects_remaining / weeks_to_deadline
  } else {
    required_run_rate = subjects_remaining > 0 ? INF_SENTINEL : 0
  }

  // projected_enrollment_date
  let projected_enrollment_date: string | null
  let days_to_projected: number | null

  if (subjects_remaining === 0) {
    projected_enrollment_date = todayIso
    days_to_projected = 0
  } else if (current_velocity > 0) {
    const weeks_to_complete = subjects_remaining / current_velocity
    const projectedMs = now + weeks_to_complete * 7 * 86_400_000
    projected_enrollment_date = new Date(projectedMs).toISOString().split('T')[0]
    days_to_projected = Math.ceil(weeks_to_complete * 7)
  } else {
    projected_enrollment_date = null
    days_to_projected = null
  }

  // leads_required
  const effective_conversion =
    funnel_lead_to_randomize_rate * (1 - screen_failure_rate)
  let leads_required: number
  if (effective_conversion > 0) {
    leads_required = Math.ceil(subjects_remaining / effective_conversion)
  } else {
    leads_required = subjects_remaining > 0 ? INF_SENTINEL : 0
  }

  // current_pipeline_coverage
  let current_pipeline_coverage: number
  if (leads_required <= 0) {
    current_pipeline_coverage = 1.0
  } else if (leads_required >= INF_SENTINEL) {
    current_pipeline_coverage = 0.0
  } else {
    current_pipeline_coverage = clamp(qualified_count / leads_required, 0, 2)
  }

  // probability_of_hitting_target
  let probability: number

  if (subjects_remaining === 0) {
    probability = 1.0
  } else {
    const velocity_ratio =
      required_run_rate > 0 && required_run_rate < INF_SENTINEL
        ? clamp(current_velocity / required_run_rate, 0, 1)
        : required_run_rate === 0
          ? 1.0
          : 0.0

    const pipeline_modifier = clamp(current_pipeline_coverage / 2, 0, 0.5)
    probability = clamp(velocity_ratio * 0.7 + pipeline_modifier * 0.6, 0, 1)

    // Deadline adjustment
    if (days_to_deadline < 0) {
      probability = 0.0
    }
  }

  // run_rate_gap: positive = behind, negative = ahead
  const run_rate_gap =
    required_run_rate >= INF_SENTINEL
      ? INF_SENTINEL
      : required_run_rate - current_velocity

  // risk_classification
  let risk_classification: RecruitmentForecast['risk_classification']
  if (probability >= 0.8) {
    risk_classification = 'on_track'
  } else if (probability >= 0.6) {
    risk_classification = 'at_risk'
  } else if (probability >= 0.35) {
    risk_classification = 'critical'
  } else {
    risk_classification = 'impossible'
  }

  return {
    subjects_remaining,
    projected_enrollment_date,
    days_to_projected,
    days_to_deadline,
    required_run_rate,
    run_rate_gap,
    leads_required,
    current_pipeline_coverage,
    probability_of_hitting_target: probability,
    risk_classification,
    as_of,
  }
}

// ---------------------------------------------------------------------------
// loadRecruitmentForecastForStudy
// ---------------------------------------------------------------------------

export async function loadRecruitmentForecastForStudy(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<RecruitmentForecast> {
  // Load study enrollment config
  const { data: configData } = await supabase
    .from('study_enrollment_configs')
    .select('enrollment_target, enrollment_end_date')
    .eq('study_id', studyId)
    .maybeSingle()

  const config = configData as {
    enrollment_target: number | null
    enrollment_end_date: string | null
  } | null

  // If no config, return a trivial on_track result
  if (!config || config.enrollment_target == null || config.enrollment_end_date == null) {
    return computeRecruitmentForecast({
      enrollment_target: 0,
      enrollment_deadline: new Date().toISOString(),
      randomized_count: 0,
      qualified_count: 0,
      current_velocity: 0,
      screen_failure_rate: 0,
      funnel_lead_to_randomize_rate: 0,
    })
  }

  // Count randomized subjects
  const { data: subjectsData } = await supabase
    .from('study_subjects')
    .select('enrollment_status')
    .eq('study_id', studyId)

  const subjects = (subjectsData as { enrollment_status: string }[] | null) ?? []

  const randomized_count = subjects.filter((s) => s.enrollment_status === 'randomized').length

  // Screen failure rate: screen_failed / (screen_failed + screened + randomized)
  const screeningStages = ['screen_failed', 'screened', 'randomized']
  const atScreening = subjects.filter((s) => screeningStages.includes(s.enrollment_status)).length
  const screenFailed = subjects.filter((s) => s.enrollment_status === 'screen_failed').length
  const screen_failure_rate = atScreening > 0 ? screenFailed / atScreening : 0

  // Qualified leads count (via patient_study_matches)
  // Fetch matched lead IDs first, then query patient_leads
  const { data: matchedLeads } = await supabase
    .from('patient_study_matches')
    .select('patient_lead_id')
    .eq('study_id', studyId)

  const matchedLeadIds = ((matchedLeads as { patient_lead_id: string }[] | null) ?? []).map(
    (r) => r.patient_lead_id,
  )

  let qualified_count = 0
  if (matchedLeadIds.length > 0) {
    const { data: qualifiedData } = await supabase
      .from('patient_leads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('stage', 'qualified')
      .is('archived_at', null)
      .in('id', matchedLeadIds)

    qualified_count = ((qualifiedData as unknown[] | null) ?? []).length
  }

  // Enrollment velocity
  const velocity = await loadEnrollmentVelocity(supabase, organizationId, studyId)
  const current_velocity = velocity.current_velocity

  // Funnel summary for overall conversion rate
  const funnel = await loadRecruitmentFunnelSummary(supabase, organizationId, { studyId })
  const funnel_lead_to_randomize_rate = funnel.overall_conversion_rate

  return computeRecruitmentForecast({
    enrollment_target: config.enrollment_target,
    enrollment_deadline: config.enrollment_end_date,
    randomized_count,
    qualified_count,
    current_velocity,
    screen_failure_rate,
    funnel_lead_to_randomize_rate,
  })
}
