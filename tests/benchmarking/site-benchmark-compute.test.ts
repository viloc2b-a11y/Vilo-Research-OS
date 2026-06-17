import { describe, test, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock loadEnrollmentVelocity — must be mocked before importing the module
// ---------------------------------------------------------------------------
vi.mock('@/lib/crm/enrollment-velocity', () => ({
  loadEnrollmentVelocity: vi.fn(),
}))

vi.mock('@/lib/benchmarking/score-against-benchmark', () => ({
  buildSiteBenchmarkReport: vi.fn().mockReturnValue({
    scores: [],
    overallTier: 'median',
    categoriesScored: 0,
    outperforming: 0,
    onTarget: 0,
    underperforming: 0,
    critical: 0,
  }),
}))

import { computeSiteBenchmarkValues } from '@/lib/benchmarking/site-benchmark-compute'
import { loadEnrollmentVelocity } from '@/lib/crm/enrollment-velocity'
import { buildSiteBenchmarkReport } from '@/lib/benchmarking/score-against-benchmark'

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function makeMultiResultMock(results: Array<{ data: unknown[]; error: null }>) {
  let callIndex = 0

  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  }

  for (const key of ['from', 'select', 'eq', 'in']) {
    chain[key].mockReturnValue(chain)
  }

  ;(chain as unknown as { then: ReturnType<typeof vi.fn> }).then = vi.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => {
      const result = results[callIndex] ?? { data: [], error: null }
      callIndex++
      resolve(result)
      return Promise.resolve(result)
    },
  )

  return chain
}

const ORG_ID = 'org-1'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSiteBenchmarkValues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(buildSiteBenchmarkReport as ReturnType<typeof vi.fn>).mockReturnValue({
      scores: [],
      overallTier: 'median',
      categoriesScored: 0,
      outperforming: 0,
      onTarget: 0,
      underperforming: 0,
      critical: 0,
    })
  })

  test('enrollment_rate is 0 when no studies exist', async () => {
    // studies query returns []
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // studies
      { data: [], error: null }, // study_subjects
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    await computeSiteBenchmarkValues(supabase, ORG_ID)

    expect(buildSiteBenchmarkReport).toHaveBeenCalledWith(
      expect.objectContaining({ enrollment_rate: 0 }),
    )
  })

  test('screen_failure_rate is 0 when no subjects at screening stages', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // studies
      { data: [], error: null }, // study_subjects
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    await computeSiteBenchmarkValues(supabase, ORG_ID)

    expect(buildSiteBenchmarkReport).toHaveBeenCalledWith(
      expect.objectContaining({ screen_failure_rate: 0 }),
    )
  })

  test('screen_failure_rate: correct formula (failed / total at screening)', async () => {
    // 3 screen_failed, 2 screened, 5 randomized → total at screening = 10
    // rate = 3/10 = 0.3 = 30%
    const subjects = [
      ...Array.from({ length: 3 }, () => ({ enrollment_status: 'screen_failed' })),
      ...Array.from({ length: 2 }, () => ({ enrollment_status: 'screened' })),
      ...Array.from({ length: 5 }, () => ({ enrollment_status: 'randomized' })),
    ]

    const supabase = makeMultiResultMock([
      { data: [], error: null }, // no studies → loadEnrollmentVelocity not called
      { data: subjects, error: null }, // study_subjects
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    // Note: if no studies, subjects query doesn't matter; for this test we
    // need studies to be present. Let's provide one study.
    ;(loadEnrollmentVelocity as ReturnType<typeof vi.fn>).mockResolvedValue({
      weekly_series: [],
      current_velocity: 0,
      peak_velocity: 0,
      velocity_trend: 'stalled',
      as_of: new Date().toISOString(),
    })

    const supabase2 = makeMultiResultMock([
      { data: [{ id: 'study-1' }], error: null }, // studies
      { data: subjects, error: null }, // study_subjects
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    await computeSiteBenchmarkValues(supabase2, ORG_ID)

    // screen_failure_rate = 30 (percent)
    expect(buildSiteBenchmarkReport).toHaveBeenCalledWith(
      expect.objectContaining({
        screen_failure_rate: expect.closeTo(30, 0),
      }),
    )
  })

  test('buildSiteBenchmarkReport is called with computed values', async () => {
    ;(loadEnrollmentVelocity as ReturnType<typeof vi.fn>).mockResolvedValue({
      weekly_series: [],
      current_velocity: 3.5,
      peak_velocity: 5,
      velocity_trend: 'stable',
      as_of: new Date().toISOString(),
    })

    const supabase = makeMultiResultMock([
      { data: [{ id: 'study-1' }, { id: 'study-2' }], error: null }, // 2 studies
      { data: [], error: null }, // study_subjects (no screen failures)
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    await computeSiteBenchmarkValues(supabase, ORG_ID)

    // enrollment_rate = (3.5 + 3.5) / 2 = 3.5
    expect(buildSiteBenchmarkReport).toHaveBeenCalledWith(
      expect.objectContaining({ enrollment_rate: 3.5 }),
    )
  })

  test('returns the SiteBenchmarkReport from buildSiteBenchmarkReport', async () => {
    const mockReport = {
      scores: [],
      overallTier: 'top_quartile' as const,
      categoriesScored: 2,
      outperforming: 1,
      onTarget: 1,
      underperforming: 0,
      critical: 0,
    }
    ;(buildSiteBenchmarkReport as ReturnType<typeof vi.fn>).mockReturnValue(mockReport)

    const supabase = makeMultiResultMock([
      { data: [], error: null }, // studies
      { data: [], error: null }, // study_subjects
    ]) as unknown as Parameters<typeof computeSiteBenchmarkValues>[0]

    const result = await computeSiteBenchmarkValues(supabase, ORG_ID)

    expect(result).toEqual(mockReport)
  })
})
