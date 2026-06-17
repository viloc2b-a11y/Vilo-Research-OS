import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSiteBenchmarkReport, type SiteBenchmarkReport } from './score-against-benchmark'
import { loadEnrollmentVelocity } from '../crm/enrollment-velocity'

// ---------------------------------------------------------------------------
// computeSiteBenchmarkValues
// ---------------------------------------------------------------------------

export async function computeSiteBenchmarkValues(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SiteBenchmarkReport> {
  // Load all active studies for this org
  const { data: studyData } = await supabase
    .from('studies')
    .select('id')
    .eq('organization_id', organizationId)

  const studies = (studyData as { id: string }[] | null) ?? []

  // enrollment_rate: average current_velocity across studies (subjects/week)
  let enrollment_rate = 0
  if (studies.length > 0) {
    const velocities = await Promise.all(
      studies.map((s) => loadEnrollmentVelocity(supabase, organizationId, s.id)),
    )
    const totalVelocity = velocities.reduce((sum, v) => sum + v.current_velocity, 0)
    enrollment_rate = totalVelocity / studies.length
  }

  // screen_failure_rate: from study_subjects joined through studies
  // COUNT(screen_failed) / NULLIF(COUNT(screen_failed + screened + randomized), 0)
  const { data: subjectData } = await supabase
    .from('study_subjects')
    .select('enrollment_status, study_id')
    .in(
      'study_id',
      studies.map((s) => s.id),
    )

  const subjects = (subjectData as { enrollment_status: string }[] | null) ?? []

  const screeningStages = ['screen_failed', 'screened', 'randomized']
  const atScreening = subjects.filter((s) => screeningStages.includes(s.enrollment_status)).length
  const screenFailed = subjects.filter((s) => s.enrollment_status === 'screen_failed').length
  const screen_failure_rate = atScreening > 0 ? screenFailed / atScreening : 0

  return buildSiteBenchmarkReport({
    enrollment_rate,
    screen_failure_rate: screen_failure_rate * 100, // benchmarks expect percentage 0–100
  })
}
