import { describe, test, expect, vi } from 'vitest'
import { loadCoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

/**
 * Creates a stateful Supabase mock where each `.then()` call pops the next
 * result from a queue. This lets us mock multiple sequential queries.
 */
function makeMultiResultMock(results: Array<{ data: unknown[]; error: null }>) {
  let callIndex = 0

  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
  }

  for (const key of ['from', 'select', 'eq', 'is', 'gte']) {
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
const ACTOR_ID = 'actor-1'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadCoordinatorRecruitmentStats', () => {
  test('leads_assigned counts only leads assigned to this actor', async () => {
    // Query 1: patient_leads (3 assigned leads)
    // Query 2: patient_lead_stage_history (leads_advanced)
    // Query 3: patient_lead_stage_history to_stage=pre_screen
    // Query 4: patient_lead_stage_history to_stage=qualified
    const supabase = makeMultiResultMock([
      { data: [{ id: '1' }, { id: '2' }, { id: '3' }], error: null }, // leads_assigned
      { data: [], error: null }, // leads_advanced_in_period
      { data: [], error: null }, // pre_screens_completed
      { data: [], error: null }, // qualified_in_period
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.leads_assigned).toBe(3)
    expect(result.actor_id).toBe(ACTOR_ID)
    expect(result.period_days).toBe(30)
  })

  test('conversion_rate is 0 when leads_assigned is 0 (no division by zero)', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // leads_assigned = 0
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ id: 'h1' }], error: null }, // qualified_in_period = 1
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.leads_assigned).toBe(0)
    expect(result.qualified_in_period).toBe(1)
    expect(result.conversion_rate).toBe(0) // no division by zero
  })

  test('qualified_in_period only counts transitions TO qualified in period', async () => {
    const supabase = makeMultiResultMock([
      { data: [{ id: 'l1' }, { id: 'l2' }], error: null }, // 2 leads assigned
      { data: [{ id: 'h1' }, { id: 'h2' }], error: null }, // 2 advanced
      { data: [], error: null }, // 0 pre_screens
      { data: [{ id: 'q1' }], error: null }, // 1 qualified
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.qualified_in_period).toBe(1)
    expect(result.conversion_rate).toBeCloseTo(1 / 2)
  })

  test('pre_screens_completed only counts transitions TO pre_screen by this actor', async () => {
    const supabase = makeMultiResultMock([
      { data: [{ id: 'l1' }], error: null }, // leads_assigned
      { data: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }], error: null }, // leads_advanced = 3
      { data: [{ id: 'p1' }, { id: 'p2' }], error: null }, // pre_screens = 2
      { data: [], error: null }, // qualified = 0
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.pre_screens_completed).toBe(2)
    expect(result.leads_advanced_in_period).toBe(3)
  })

  test('leads_advanced is total stage transitions by actor in period', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // leads_assigned = 0
      { data: Array.from({ length: 5 }, (_, i) => ({ id: `h${i}` })), error: null }, // 5 transitions
      { data: [], error: null },
      { data: [], error: null },
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.leads_advanced_in_period).toBe(5)
  })

  test('contact_attempts_in_period is 0 (TODO: not yet queried from DB)', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.contact_attempts_in_period).toBe(0)
  })

  test('custom periodDays is reflected in result', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID, 90)

    expect(result.period_days).toBe(90)
  })
})
