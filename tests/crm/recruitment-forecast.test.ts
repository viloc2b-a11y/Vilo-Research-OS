import { describe, test, expect } from 'vitest'
import { computeRecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { RecruitmentForecastInputs } from '@/lib/crm/recruitment-forecast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  return d.toISOString().split('T')[0]
}

function pastDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return d.toISOString().split('T')[0]
}

function makeInputs(overrides: Partial<RecruitmentForecastInputs> = {}): RecruitmentForecastInputs {
  return {
    enrollment_target: 100,
    enrollment_deadline: futureDate(180),
    randomized_count: 20,
    qualified_count: 30,
    current_velocity: 2, // 2 subjects/week
    screen_failure_rate: 0.2,
    funnel_lead_to_randomize_rate: 0.1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('computeRecruitmentForecast', () => {
  // 1. Zero velocity
  test('zero velocity → projected_enrollment_date is null, risk impossible', () => {
    const result = computeRecruitmentForecast(
      makeInputs({ current_velocity: 0, randomized_count: 0 }),
    )

    expect(result.projected_enrollment_date).toBeNull()
    expect(result.days_to_projected).toBeNull()
    expect(result.risk_classification).toBe('impossible')
  })

  // 2. Deadline already passed with subjects remaining
  test('deadline passed + subjects remaining → probability 0, impossible', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_deadline: pastDate(10),
        randomized_count: 0,
        current_velocity: 2,
      }),
    )

    expect(result.days_to_deadline).toBeLessThan(0)
    expect(result.probability_of_hitting_target).toBe(0)
    expect(result.risk_classification).toBe('impossible')
  })

  // 3. Deadline passed but already complete
  test('deadline passed + complete → probability 1, on_track', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_deadline: pastDate(10),
        randomized_count: 100,
        enrollment_target: 100,
      }),
    )

    expect(result.subjects_remaining).toBe(0)
    expect(result.probability_of_hitting_target).toBe(1)
    expect(result.risk_classification).toBe('on_track')
  })

  // 4. Perfect pipeline coverage → probability >= 0.80, on_track
  test('velocity matches required_run_rate and pipeline is adequate → on_track', () => {
    // 80 remaining, 160 days to deadline = ~22.8 weeks, req = 80/22.8 ≈ 3.5/week
    // current_velocity = 4 (ahead), qualified = 200 (well above required)
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        enrollment_deadline: futureDate(160),
        randomized_count: 20,
        current_velocity: 4,
        qualified_count: 200,
        screen_failure_rate: 0.1,
        funnel_lead_to_randomize_rate: 0.5,
      }),
    )

    expect(result.probability_of_hitting_target).toBeGreaterThanOrEqual(0.8)
    expect(result.risk_classification).toBe('on_track')
  })

  // 5. Poor pipeline coverage pulls probability down even with matching velocity
  test('velocity matches run_rate but zero pipeline → probability < 0.80', () => {
    // 80 remaining, 160 days ≈ 22.8 weeks, required ≈ 3.5/week, velocity = 3.5
    // qualified = 0 → pipeline_modifier = 0, probability = velocity_ratio * 0.7 only
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        enrollment_deadline: futureDate(160),
        randomized_count: 20,
        current_velocity: 3.5,
        qualified_count: 0,
        screen_failure_rate: 0.1,
        funnel_lead_to_randomize_rate: 0.3,
      }),
    )

    expect(result.probability_of_hitting_target).toBeLessThan(0.8)
  })

  // 6. High screen failure rate → leads_required much higher than naive calc
  test('high screen failure rate (0.7) inflates leads_required', () => {
    const lowSfr = computeRecruitmentForecast(
      makeInputs({ screen_failure_rate: 0.05, funnel_lead_to_randomize_rate: 0.4 }),
    )
    const highSfr = computeRecruitmentForecast(
      makeInputs({ screen_failure_rate: 0.7, funnel_lead_to_randomize_rate: 0.4 }),
    )

    expect(highSfr.leads_required).toBeGreaterThan(lowSfr.leads_required)
  })

  // 7. Low screen failure rate → leads_required close to subjects_remaining / funnel_rate
  test('low screen failure rate (0.05) → leads_required near subjects_remaining / funnel_rate', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        randomized_count: 0,
        screen_failure_rate: 0.05,
        funnel_lead_to_randomize_rate: 0.5,
      }),
    )

    // effective_conversion = 0.5 * (1 - 0.05) = 0.475
    // leads_required = ceil(100 / 0.475) = 211
    expect(result.leads_required).toBe(Math.ceil(100 / (0.5 * 0.95)))
  })

  // 8. on_track classification
  test('on_track when probability >= 0.80', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        enrollment_deadline: futureDate(365),
        randomized_count: 20,
        current_velocity: 5,
        qualified_count: 500,
        screen_failure_rate: 0.1,
        funnel_lead_to_randomize_rate: 0.5,
      }),
    )

    expect(result.risk_classification).toBe('on_track')
    expect(result.probability_of_hitting_target).toBeGreaterThanOrEqual(0.8)
  })

  // 9. at_risk classification (probability 0.60–0.79)
  test('at_risk when probability is between 0.60 and 0.79', () => {
    // Tune: just under required velocity but decent pipeline
    // 80 remaining, 112 days = 16 weeks, required = 5/week
    // current_velocity = 4 (80% of required) → velocity_ratio = 0.8
    // qualified = 20, effective_conversion = 0.3 * 0.8 = 0.24, leads_required = ceil(80/0.24) = 334
    // coverage = 20/334 ≈ 0.06 → pipeline_modifier ≈ 0.03
    // probability = 0.8 * 0.7 + 0.03 * 0.6 = 0.56 + 0.018 = 0.578 — hmm, need to tune
    // Let's do: velocity_ratio=0.9, pipeline_modifier=0.1 → p = 0.9*0.7 + 0.1*0.6 = 0.63 + 0.06 = 0.69
    // velocity = 0.9 * required
    // 80 remaining / 16 weeks = 5/week required; velocity = 4.5
    // qualified_count = 80/2 = 40 leads, leads_required with sfr=0, fnl=0.5 → ceil(80/0.5)=160, coverage=40/160=0.25
    // pipeline_modifier = clamp(0.25/2, 0, 0.5) = 0.125
    // velocity_ratio = 4.5/5 = 0.9
    // probability = 0.9 * 0.7 + 0.125 * 0.6 = 0.63 + 0.075 = 0.705 → at_risk
    const result = computeRecruitmentForecast({
      enrollment_target: 100,
      enrollment_deadline: futureDate(112),
      randomized_count: 20,
      current_velocity: 4.5,
      qualified_count: 40,
      screen_failure_rate: 0,
      funnel_lead_to_randomize_rate: 0.5,
    })

    expect(result.probability_of_hitting_target).toBeGreaterThanOrEqual(0.6)
    expect(result.probability_of_hitting_target).toBeLessThan(0.8)
    expect(result.risk_classification).toBe('at_risk')
  })

  // 10. critical classification (probability 0.35–0.59)
  test('critical when probability is between 0.35 and 0.59', () => {
    // velocity_ratio = 0.5, coverage low
    // 80 remaining, 16 weeks required = 5/week, current_velocity = 2.5
    // velocity_ratio = 2.5/5 = 0.5
    // leads_required = ceil(80/0.5) = 160, qualified = 10
    // coverage = 10/160 = 0.0625, pipeline_modifier = clamp(0.0625/2,0,0.5) = 0.031
    // probability = 0.5 * 0.7 + 0.031 * 0.6 = 0.35 + 0.019 = 0.369 → critical
    const result = computeRecruitmentForecast({
      enrollment_target: 100,
      enrollment_deadline: futureDate(112),
      randomized_count: 20,
      current_velocity: 2.5,
      qualified_count: 10,
      screen_failure_rate: 0,
      funnel_lead_to_randomize_rate: 0.5,
    })

    expect(result.probability_of_hitting_target).toBeGreaterThanOrEqual(0.35)
    expect(result.probability_of_hitting_target).toBeLessThan(0.6)
    expect(result.risk_classification).toBe('critical')
  })

  // 11. impossible classification (probability < 0.35)
  test('impossible when probability < 0.35', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        current_velocity: 0,
        enrollment_deadline: futureDate(30),
        randomized_count: 0,
        enrollment_target: 100,
      }),
    )

    expect(result.probability_of_hitting_target).toBeLessThan(0.35)
    expect(result.risk_classification).toBe('impossible')
  })

  // 12. Already complete
  test('already complete → subjects_remaining 0, probability 1, on_track, projected today', () => {
    const result = computeRecruitmentForecast(
      makeInputs({ enrollment_target: 50, randomized_count: 50 }),
    )

    const todayIso = new Date().toISOString().split('T')[0]

    expect(result.subjects_remaining).toBe(0)
    expect(result.probability_of_hitting_target).toBe(1)
    expect(result.risk_classification).toBe('on_track')
    expect(result.projected_enrollment_date).toBe(todayIso)
    expect(result.days_to_projected).toBe(0)
  })

  // 13. Infinite required_run_rate (deadline passed with subjects remaining) — no throw
  test('deadline passed with subjects remaining does not throw', () => {
    expect(() =>
      computeRecruitmentForecast(
        makeInputs({
          enrollment_deadline: pastDate(1),
          randomized_count: 0,
          current_velocity: 1,
        }),
      ),
    ).not.toThrow()

    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_deadline: pastDate(1),
        randomized_count: 0,
        current_velocity: 1,
      }),
    )

    expect(result.probability_of_hitting_target).toBe(0)
  })

  // 14. Division by zero guards
  test('enrollment_target 0 → subjects_remaining 0, no division errors', () => {
    expect(() =>
      computeRecruitmentForecast({
        enrollment_target: 0,
        enrollment_deadline: futureDate(90),
        randomized_count: 0,
        qualified_count: 0,
        current_velocity: 0,
        screen_failure_rate: 0,
        funnel_lead_to_randomize_rate: 0,
      }),
    ).not.toThrow()

    const result = computeRecruitmentForecast({
      enrollment_target: 0,
      enrollment_deadline: futureDate(90),
      randomized_count: 0,
      qualified_count: 0,
      current_velocity: 0,
      screen_failure_rate: 0,
      funnel_lead_to_randomize_rate: 0,
    })

    expect(result.subjects_remaining).toBe(0)
    expect(result.leads_required).toBe(0)
  })

  test('funnel_lead_to_randomize_rate 0 with subjects remaining → leads_required sentinel', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        funnel_lead_to_randomize_rate: 0,
        randomized_count: 0,
        screen_failure_rate: 0,
      }),
    )

    // leads_required should be the INF_SENTINEL (9999)
    expect(result.leads_required).toBe(9999)
  })

  // 15. run_rate_gap positive when behind, negative when ahead
  test('run_rate_gap is positive when current_velocity < required_run_rate', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        enrollment_deadline: futureDate(70), // ~10 weeks, required = 8/week
        randomized_count: 20,
        current_velocity: 2, // well below required
      }),
    )

    expect(result.run_rate_gap).toBeGreaterThan(0)
  })

  test('run_rate_gap is negative when current_velocity > required_run_rate', () => {
    const result = computeRecruitmentForecast(
      makeInputs({
        enrollment_target: 100,
        enrollment_deadline: futureDate(365), // ~52 weeks, required ≈ 1.5/week
        randomized_count: 20,
        current_velocity: 10, // well above required
      }),
    )

    expect(result.run_rate_gap).toBeLessThan(0)
  })

  // days_to_deadline is correct
  test('days_to_deadline matches days until enrollment_deadline', () => {
    const result = computeRecruitmentForecast(makeInputs({ enrollment_deadline: futureDate(90) }))

    // Allow 1-day rounding tolerance
    expect(result.days_to_deadline).toBeGreaterThanOrEqual(89)
    expect(result.days_to_deadline).toBeLessThanOrEqual(90)
  })
})
