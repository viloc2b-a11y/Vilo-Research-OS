import { describe, test, expect, vi } from 'vitest'
import {
  loadRecruitmentFunnelSummary,
  loadSourceEffectiveness,
} from '@/lib/crm/recruitment-intelligence'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Supabase query mock that resolves to { data, error }.
 * Supports one or two calls with different results (callCount-based).
 */
function makeSupabaseMock(rows: object[], error: object | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
  }

  // All builder methods return the chain itself
  for (const key of ['from', 'select', 'eq', 'is', 'in', 'gte']) {
    chain[key].mockReturnValue(chain)
  }

  // The final awaited call resolves with data
  ;(chain as unknown as { then: ReturnType<typeof vi.fn> }).then = vi.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => {
      resolve({ data: rows, error })
      return Promise.resolve({ data: rows, error })
    },
  )

  return chain
}

// ---------------------------------------------------------------------------
// loadRecruitmentFunnelSummary
// ---------------------------------------------------------------------------

describe('loadRecruitmentFunnelSummary', () => {
  test('correctly computes percent_of_entry and drop_off_from_previous', async () => {
    // 10 leads, 6 contacted, 3 qualified, 1 randomized
    const rows = [
      ...Array.from({ length: 10 }, () => ({ stage: 'lead' })),
      ...Array.from({ length: 6 }, () => ({ stage: 'contacted' })),
      ...Array.from({ length: 3 }, () => ({ stage: 'qualified' })),
      ...Array.from({ length: 1 }, () => ({ stage: 'randomized' })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadRecruitmentFunnelSummary
    >[0]

    const result = await loadRecruitmentFunnelSummary(supabase, 'org-1')

    const leadStage = result.stages.find((s) => s.stage === 'lead')!
    const contactedStage = result.stages.find((s) => s.stage === 'contacted')!
    const qualifiedStage = result.stages.find((s) => s.stage === 'qualified')!
    const randomizedStage = result.stages.find((s) => s.stage === 'randomized')!

    expect(leadStage.count).toBe(10)
    expect(contactedStage.count).toBe(6)
    expect(qualifiedStage.count).toBe(3)
    expect(randomizedStage.count).toBe(1)

    // percent_of_entry = count / lead_count
    expect(contactedStage.percent_of_entry).toBeCloseTo(6 / 10)
    expect(qualifiedStage.percent_of_entry).toBeCloseTo(3 / 10)

    // drop_off_from_previous
    // lead → 0 (first stage)
    expect(leadStage.drop_off_from_previous).toBe(0)
    // contacted → lead - contacted = 10 - 6 = 4
    expect(contactedStage.drop_off_from_previous).toBe(4)
  })

  test('overall_conversion_rate = terminal_converted / total_leads', async () => {
    const rows = [
      ...Array.from({ length: 20 }, () => ({ stage: 'lead' })),
      ...Array.from({ length: 4 }, () => ({ stage: 'randomized' })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadRecruitmentFunnelSummary
    >[0]

    const result = await loadRecruitmentFunnelSummary(supabase, 'org-1')

    expect(result.total_leads).toBe(24)
    expect(result.terminal_converted).toBe(4)
    expect(result.overall_conversion_rate).toBeCloseTo(4 / 24)
  })

  test('zero leads → all counts 0 and conversion_rate 0', async () => {
    const supabase = makeSupabaseMock([]) as unknown as Parameters<
      typeof loadRecruitmentFunnelSummary
    >[0]

    const result = await loadRecruitmentFunnelSummary(supabase, 'org-1')

    expect(result.total_leads).toBe(0)
    expect(result.terminal_converted).toBe(0)
    expect(result.overall_conversion_rate).toBe(0)
    for (const s of result.stages) {
      expect(s.count).toBe(0)
      expect(s.percent_of_entry).toBe(0)
    }
  })

  test('error from supabase returns empty funnel', async () => {
    const supabase = makeSupabaseMock([], { message: 'DB error' }) as unknown as Parameters<
      typeof loadRecruitmentFunnelSummary
    >[0]

    const result = await loadRecruitmentFunnelSummary(supabase, 'org-1')

    expect(result.total_leads).toBe(0)
    expect(result.stages).toHaveLength(8) // all 8 stages with 0 counts
  })
})

// ---------------------------------------------------------------------------
// loadSourceEffectiveness
// ---------------------------------------------------------------------------

describe('loadSourceEffectiveness', () => {
  test('computes top_source and top_converting_source from 2 sources', async () => {
    // Source A: 10 leads, 2 randomized → rate=0.2
    // Source B: 6 leads, 3 randomized → rate=0.5
    const rows = [
      ...Array.from({ length: 10 }, () => ({
        stage: 'lead',
        recruitment_source_channel: 'source_a',
        campaign_id: null,
      })),
      ...Array.from({ length: 2 }, () => ({
        stage: 'randomized',
        recruitment_source_channel: 'source_a',
        campaign_id: null,
      })),
      ...Array.from({ length: 6 }, () => ({
        stage: 'lead',
        recruitment_source_channel: 'source_b',
        campaign_id: null,
      })),
      ...Array.from({ length: 3 }, () => ({
        stage: 'randomized',
        recruitment_source_channel: 'source_b',
        campaign_id: null,
      })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadSourceEffectiveness
    >[0]

    const result = await loadSourceEffectiveness(supabase, 'org-1')

    // top_source = source with most total leads
    // source_a: 12 total, source_b: 9 total → top = source_a
    expect(result.top_source).toBe('source_a')

    // top_converting_source = highest rate with >= 5 leads
    // source_a rate = 2/12 ≈ 0.167, source_b rate = 3/9 ≈ 0.333
    // Both have >= 5 leads → top_converting = source_b
    expect(result.top_converting_source).toBe('source_b')
  })

  test('unattributed_count correctly counts leads with null source channel', async () => {
    const rows = [
      { stage: 'lead', recruitment_source_channel: null, campaign_id: null },
      { stage: 'lead', recruitment_source_channel: null, campaign_id: null },
      { stage: 'lead', recruitment_source_channel: 'digital', campaign_id: null },
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadSourceEffectiveness
    >[0]

    const result = await loadSourceEffectiveness(supabase, 'org-1')

    expect(result.unattributed_count).toBe(2)
  })

  test('top_converting_source requires minimum 5 leads to qualify', async () => {
    // source_a: 4 leads, 4 randomized → 100% rate but only 4 leads → excluded
    // source_b: 5 leads, 1 randomized → 20% rate but qualifies
    const rows = [
      ...Array.from({ length: 4 }, () => ({
        stage: 'randomized',
        recruitment_source_channel: 'source_a',
        campaign_id: null,
      })),
      ...Array.from({ length: 5 }, () => ({
        stage: 'lead',
        recruitment_source_channel: 'source_b',
        campaign_id: null,
      })),
      { stage: 'randomized', recruitment_source_channel: 'source_b', campaign_id: null },
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadSourceEffectiveness
    >[0]

    const result = await loadSourceEffectiveness(supabase, 'org-1')

    // source_a is excluded because it has only 4 leads
    expect(result.top_converting_source).toBe('source_b')
  })

  test('top_converting_source is null when no source has >= 5 leads', async () => {
    const rows = [
      ...Array.from({ length: 4 }, () => ({
        stage: 'randomized',
        recruitment_source_channel: 'source_a',
        campaign_id: null,
      })),
    ]

    const supabase = makeSupabaseMock(rows) as unknown as Parameters<
      typeof loadSourceEffectiveness
    >[0]

    const result = await loadSourceEffectiveness(supabase, 'org-1')

    expect(result.top_converting_source).toBeNull()
  })
})
