import { describe, test, expect, vi } from 'vitest'
import { loadEnrollmentVelocity } from '@/lib/crm/enrollment-velocity'

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function makeSupabaseMock(rows: object[], error: object | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  }

  for (const key of ['from', 'select', 'eq', 'is']) {
    chain[key].mockReturnValue(chain)
  }

  ;(chain as unknown as { then: ReturnType<typeof vi.fn> }).then = vi.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => {
      resolve({ data: rows, error })
      return Promise.resolve({ data: rows, error })
    },
  )

  return chain
}

/**
 * Build a created_at timestamp for a subject enrolled N weeks ago.
 * The date is set to the Wednesday of that week (middle of week)
 * to avoid boundary issues.
 */
function weeksAgoIso(weeksAgo: number): string {
  const d = new Date()
  // Go to this week's Monday
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  // Subtract full weeks
  d.setUTCDate(d.getUTCDate() - weeksAgo * 7)
  // Move to Wednesday to be safely inside the week
  d.setUTCDate(d.getUTCDate() + 2)
  d.setUTCHours(12, 0, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadEnrollmentVelocity', () => {
  test('weekly_series length matches weeksBack (default 8)', async () => {
    const supabase = makeSupabaseMock([]) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    expect(result.weekly_series).toHaveLength(8)
  })

  test('weekly_series length matches custom weeksBack', async () => {
    const supabase = makeSupabaseMock([]) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1', { weeksBack: 12 })

    expect(result.weekly_series).toHaveLength(12)
  })

  test('current_velocity is average of last 4 weeks', async () => {
    // Place subjects: 4 in week-1, 2 in week-2, 0 in week-3, 0 in week-4
    // Weeks 5-8 also 0. Current velocity = (4 + 2 + 0 + 0) / 4 = 1.5
    const rows = [
      ...Array.from({ length: 4 }, () => ({ created_at: weeksAgoIso(0) })), // this week (last in series)
      ...Array.from({ length: 2 }, () => ({ created_at: weeksAgoIso(1) })), // last week
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    // last 4 weeks: [0, 0, 2, 4] avg = 6/4 = 1.5
    expect(result.current_velocity).toBeCloseTo(1.5)
  })

  test('velocity_trend is stalled when all weeks are 0', async () => {
    const supabase = makeSupabaseMock([]) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    expect(result.velocity_trend).toBe('stalled')
    expect(result.current_velocity).toBe(0)
    expect(result.peak_velocity).toBe(0)
  })

  test('velocity_trend is accelerating when recent > older * 1.1', async () => {
    // weeks 3-4 ago: 1 each → olderAvg = 2
    // weeks 1-2 ago: 5 each → recentAvg = 10
    // 10 > 2 * 1.1 = 2.2 → accelerating
    const rows = [
      { created_at: weeksAgoIso(3) },
      { created_at: weeksAgoIso(4) },
      ...Array.from({ length: 5 }, () => ({ created_at: weeksAgoIso(1) })),
      ...Array.from({ length: 5 }, () => ({ created_at: weeksAgoIso(0) })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    expect(result.velocity_trend).toBe('accelerating')
  })

  test('velocity_trend is decelerating when recent < older * 0.9', async () => {
    // weeks 3-4 ago: 5 each → olderAvg = 10
    // weeks 1-2 ago: 1 each → recentAvg = 2
    // 2 < 10 * 0.9 = 9 → decelerating
    const rows = [
      ...Array.from({ length: 5 }, () => ({ created_at: weeksAgoIso(3) })),
      ...Array.from({ length: 5 }, () => ({ created_at: weeksAgoIso(4) })),
      { created_at: weeksAgoIso(1) },
      { created_at: weeksAgoIso(0) },
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    expect(result.velocity_trend).toBe('decelerating')
  })

  test('empty study (no subjects) → zeros and stalled', async () => {
    const supabase = makeSupabaseMock([]) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-empty')

    expect(result.current_velocity).toBe(0)
    expect(result.peak_velocity).toBe(0)
    expect(result.velocity_trend).toBe('stalled')
    expect(result.weekly_series.every((w) => w.randomized_this_week === 0)).toBe(true)
    expect(result.weekly_series.every((w) => w.cumulative === 0)).toBe(true)
  })

  test('cumulative is a running total across weeks', async () => {
    // 2 subjects in week-7, 3 in week-6 (from oldest bucket perspective)
    const rows = [
      ...Array.from({ length: 2 }, () => ({ created_at: weeksAgoIso(7) })),
      ...Array.from({ length: 3 }, () => ({ created_at: weeksAgoIso(6) })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadEnrollmentVelocity
    >[0]

    const result = await loadEnrollmentVelocity(supabase, 'org-1', 'study-1')

    // cumulative should be non-decreasing
    for (let i = 1; i < result.weekly_series.length; i++) {
      expect(result.weekly_series[i].cumulative).toBeGreaterThanOrEqual(
        result.weekly_series[i - 1].cumulative,
      )
    }

    // Total enrolled should be 5
    const last = result.weekly_series[result.weekly_series.length - 1]
    expect(last.cumulative).toBe(5)
  })
})
