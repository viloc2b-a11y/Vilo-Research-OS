import { describe, test, expect, vi } from 'vitest'
import { loadCoordinatorRecruitmentStats, loadAllCoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'

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

// Query order for loadCoordinatorRecruitmentStats (5 queries total):
//   1. patient_leads             → leads_assigned
//   2. patient_lead_stage_history → leads_advanced_in_period
//   3. patient_lead_contact_log  → contact_attempts_in_period
//   4. patient_lead_stage_history to_stage=pre_screen → pre_screens_completed
//   5. patient_lead_stage_history to_stage=qualified  → qualified_in_period

describe('loadCoordinatorRecruitmentStats', () => {
  test('leads_assigned counts only leads assigned to this actor', async () => {
    const supabase = makeMultiResultMock([
      { data: [{ id: '1' }, { id: '2' }, { id: '3' }], error: null }, // leads_assigned
      { data: [], error: null }, // leads_advanced_in_period
      { data: [], error: null }, // contact_attempts_in_period
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
      { data: [], error: null }, // leads_advanced_in_period
      { data: [], error: null }, // contact_attempts_in_period
      { data: [], error: null }, // pre_screens
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
      { data: [], error: null }, // 0 contact attempts
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
      { data: [], error: null }, // 0 contact attempts
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
      { data: [], error: null }, // contact attempts
      { data: [], error: null }, // pre_screens
      { data: [], error: null }, // qualified
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.leads_advanced_in_period).toBe(5)
  })

  test('contact_attempts_in_period returns real count from patient_lead_contact_log', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // leads_assigned
      { data: [], error: null }, // leads_advanced
      { data: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], error: null }, // 3 contact attempts
      { data: [], error: null }, // pre_screens
      { data: [], error: null }, // qualified
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID)

    expect(result.contact_attempts_in_period).toBe(3)
  })

  test('contact_attempts_in_period is 0 when no contact log entries in period', async () => {
    const supabase = makeMultiResultMock([
      { data: [], error: null }, // leads_assigned
      { data: [], error: null }, // leads_advanced
      { data: [], error: null }, // no contact log entries
      { data: [], error: null }, // pre_screens
      { data: [], error: null }, // qualified
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
      { data: [], error: null },
    ]) as unknown as Parameters<typeof loadCoordinatorRecruitmentStats>[0]

    const result = await loadCoordinatorRecruitmentStats(supabase, ORG_ID, ACTOR_ID, 90)

    expect(result.period_days).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// loadAllCoordinatorRecruitmentStats — mock helper
// ---------------------------------------------------------------------------

/**
 * The multi-coordinator function makes exactly 3 Supabase queries:
 *   1. patient_leads             (assigned leads per actor)
 *   2. patient_lead_stage_history (period stats per actor)
 *   3. patient_lead_contact_log  (contact attempts per actor in period)
 *
 * Provide contactLogRows to override the default empty contact log.
 */
function makeAllStatsMock(
  leadsRows: Array<{ assigned_user_id: string }>,
  historyRows: Array<{ actor_id: string; to_stage: string }>,
  contactLogRows: Array<{ actor_user_id: string }> = [],
) {
  const results = [
    { data: leadsRows, error: null },
    { data: historyRows, error: null },
    { data: contactLogRows, error: null },
  ]
  let callIndex = 0

  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
    not: vi.fn(),
  }

  for (const key of ['from', 'select', 'eq', 'is', 'gte', 'not']) {
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

  return chain as unknown as Parameters<typeof loadAllCoordinatorRecruitmentStats>[0]
}

const ORG_ALL = 'org-all'

// ---------------------------------------------------------------------------
// Tests for loadAllCoordinatorRecruitmentStats
// ---------------------------------------------------------------------------

describe('loadAllCoordinatorRecruitmentStats', () => {
  test('returns one entry per coordinator with assigned leads', async () => {
    const supabase = makeAllStatsMock(
      [
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-b' },
        { assigned_user_id: 'actor-a' },
      ],
      [],
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results).toHaveLength(2)
    const actorIds = results.map((r) => r.actor_id).sort()
    expect(actorIds).toEqual(['actor-a', 'actor-b'])
  })

  test('two actors have separate leads_assigned counts', async () => {
    const supabase = makeAllStatsMock(
      [
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-b' },
      ],
      [],
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    const a = results.find((r) => r.actor_id === 'actor-a')
    const b = results.find((r) => r.actor_id === 'actor-b')
    expect(a?.leads_assigned).toBe(2)
    expect(b?.leads_assigned).toBe(1)
  })

  test('actor with assigned leads but no stage history in period gets leads_advanced_in_period = 0', async () => {
    const supabase = makeAllStatsMock(
      [{ assigned_user_id: 'actor-a' }],
      [], // no stage history
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results[0].leads_advanced_in_period).toBe(0)
    expect(results[0].pre_screens_completed).toBe(0)
    expect(results[0].qualified_in_period).toBe(0)
  })

  test('returns empty array when no leads have assigned_user_id set', async () => {
    // The function queries with .not('assigned_user_id', 'is', null) so we
    // simulate an empty response from the DB.
    const supabase = makeAllStatsMock([], [])
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results).toHaveLength(0)
  })

  test('conversion_rate is correctly computed: qualified_in_period / leads_assigned', async () => {
    const supabase = makeAllStatsMock(
      [
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-a' },
        { assigned_user_id: 'actor-a' },
      ], // 4 leads assigned
      [
        { actor_id: 'actor-a', to_stage: 'qualified' },
        { actor_id: 'actor-a', to_stage: 'qualified' },
      ], // 2 qualified in period
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results[0].leads_assigned).toBe(4)
    expect(results[0].qualified_in_period).toBe(2)
    expect(results[0].conversion_rate).toBeCloseTo(2 / 4)
  })

  test('pre_screens and qualified are counted correctly from history', async () => {
    const supabase = makeAllStatsMock(
      [{ assigned_user_id: 'actor-a' }],
      [
        { actor_id: 'actor-a', to_stage: 'pre_screen' },
        { actor_id: 'actor-a', to_stage: 'pre_screen' },
        { actor_id: 'actor-a', to_stage: 'qualified' },
        { actor_id: 'actor-a', to_stage: 'contacted' }, // another stage — counts toward advanced
      ],
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results[0].pre_screens_completed).toBe(2)
    expect(results[0].qualified_in_period).toBe(1)
    expect(results[0].leads_advanced_in_period).toBe(4)
  })

  test('period_days is reflected in each result entry', async () => {
    const supabase = makeAllStatsMock(
      [{ assigned_user_id: 'actor-a' }],
      [],
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL, 90)
    expect(results[0].period_days).toBe(90)
  })

  test('contact_attempts_in_period returns real count per actor from contact log', async () => {
    const supabase = makeAllStatsMock(
      [{ assigned_user_id: 'actor-a' }, { assigned_user_id: 'actor-b' }],
      [],
      [
        { actor_user_id: 'actor-a' },
        { actor_user_id: 'actor-a' },
        { actor_user_id: 'actor-b' },
      ],
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    const a = results.find((r) => r.actor_id === 'actor-a')
    const b = results.find((r) => r.actor_id === 'actor-b')
    expect(a?.contact_attempts_in_period).toBe(2)
    expect(b?.contact_attempts_in_period).toBe(1)
  })

  test('contact_attempts_in_period is 0 when no contact log entries exist in period', async () => {
    const supabase = makeAllStatsMock(
      [{ assigned_user_id: 'actor-a' }],
      [],
      [], // empty contact log
    )
    const results = await loadAllCoordinatorRecruitmentStats(supabase, ORG_ALL)
    expect(results[0].contact_attempts_in_period).toBe(0)
  })
})
