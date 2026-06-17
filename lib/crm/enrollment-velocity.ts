import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnrollmentVelocityResult = {
  weekly_series: {
    week_start: string
    randomized_this_week: number
    cumulative: number
  }[]
  current_velocity: number
  peak_velocity: number
  velocity_trend: 'accelerating' | 'stable' | 'decelerating' | 'stalled'
  as_of: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday
 * at or before the given date.
 */
function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ... 6=Sat
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().split('T')[0]
}

/**
 * Returns an array of `count` Monday ISO dates going backwards from today.
 * Index 0 = oldest week, index (count-1) = most recent week.
 */
function buildWeekBuckets(weeksBack: number): string[] {
  const today = new Date()
  const mostRecentMonday = getMondayOf(today)
  const buckets: string[] = []

  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(mostRecentMonday + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i * 7)
    buckets.push(d.toISOString().split('T')[0])
  }

  return buckets
}

// ---------------------------------------------------------------------------
// loadEnrollmentVelocity
// ---------------------------------------------------------------------------

export async function loadEnrollmentVelocity(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  options?: { weeksBack?: number },
): Promise<EnrollmentVelocityResult> {
  const weeksBack = options?.weeksBack ?? 8
  const as_of = new Date().toISOString()

  // Query study_subjects for randomized subjects.
  // study_subjects may not have organization_id directly — join through studies if needed.
  // We filter by study_id directly here (which is scoped to the org via the studies table).
  const { data, error } = await supabase
    .from('study_subjects')
    .select('created_at')
    .eq('study_id', studyId)
    .eq('enrollment_status', 'randomized')

  if (error || !data) {
    return emptyVelocityResult(weeksBack, as_of)
  }

  const rows = data as { created_at: string }[]

  // Build week bucket map
  const buckets = buildWeekBuckets(weeksBack)
  const countByWeek = new Map<string, number>()
  for (const b of buckets) countByWeek.set(b, 0)

  // Assign each row to the correct week bucket
  const oldestBucketMs = new Date(buckets[0] + 'T00:00:00Z').getTime()

  for (const row of rows) {
    const d = new Date(row.created_at)
    if (d.getTime() < oldestBucketMs) continue // outside our window
    const monday = getMondayOf(d)
    if (countByWeek.has(monday)) {
      countByWeek.set(monday, (countByWeek.get(monday) ?? 0) + 1)
    }
  }

  // Build weekly_series with cumulative
  let cumulative = 0
  const weekly_series = buckets.map((week_start) => {
    const randomized_this_week = countByWeek.get(week_start) ?? 0
    cumulative += randomized_this_week
    return { week_start, randomized_this_week, cumulative }
  })

  // current_velocity: avg of last 4 weeks
  const last4 = weekly_series.slice(-4)
  const current_velocity = last4.reduce((sum, w) => sum + w.randomized_this_week, 0) / 4

  // peak_velocity: highest single week
  const peak_velocity = Math.max(...weekly_series.map((w) => w.randomized_this_week))

  // velocity_trend: compare last 2 weeks vs weeks 3–4 (older)
  const recentAvg =
    (weekly_series[weekly_series.length - 1]?.randomized_this_week ?? 0) +
    (weekly_series[weekly_series.length - 2]?.randomized_this_week ?? 0)
  const olderAvg =
    (weekly_series[weekly_series.length - 3]?.randomized_this_week ?? 0) +
    (weekly_series[weekly_series.length - 4]?.randomized_this_week ?? 0)

  let velocity_trend: EnrollmentVelocityResult['velocity_trend']
  if (recentAvg === 0 && olderAvg === 0) {
    velocity_trend = 'stalled'
  } else if (recentAvg > olderAvg * 1.1) {
    velocity_trend = 'accelerating'
  } else if (recentAvg < olderAvg * 0.9) {
    velocity_trend = 'decelerating'
  } else {
    velocity_trend = 'stable'
  }

  return {
    weekly_series,
    current_velocity,
    peak_velocity,
    velocity_trend,
    as_of,
  }
}

function emptyVelocityResult(weeksBack: number, as_of: string): EnrollmentVelocityResult {
  const buckets = buildWeekBuckets(weeksBack)
  return {
    weekly_series: buckets.map((week_start) => ({
      week_start,
      randomized_this_week: 0,
      cumulative: 0,
    })),
    current_velocity: 0,
    peak_velocity: 0,
    velocity_trend: 'stalled',
    as_of,
  }
}
