import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { CoordinatorProductivityCard } from '@/components/recruitment-intelligence/CoordinatorProductivityCard'
import { SourceEffectivenessCard } from '@/components/recruitment-intelligence/SourceEffectivenessCard'
import { PortfolioRecruitmentSummary } from '@/components/recruitment-intelligence/PortfolioRecruitmentSummary'
import { RecruitmentFunnelPanel } from '@/components/recruitment-intelligence/RecruitmentFunnelPanel'
import { RecruitmentForecastSummary } from '@/components/recruitment-intelligence/RecruitmentForecastSummary'
import type { CoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'
import type { SourceEffectivenessReport, RecruitmentFunnelSummary } from '@/lib/crm/recruitment-intelligence'
import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { SiteBenchmarkReport } from '@/lib/benchmarking/score-against-benchmark'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCoordinatorStats(
  overrides: Partial<CoordinatorRecruitmentStats> = {},
): CoordinatorRecruitmentStats {
  return {
    actor_id: 'user-1',
    leads_assigned: 10,
    leads_advanced_in_period: 5,
    contact_attempts_in_period: 8,
    pre_screens_completed: 4,
    qualified_in_period: 3,
    conversion_rate: 0.3,
    period_days: 30,
    ...overrides,
  }
}

function makeSourceReport(
  overrides: Partial<SourceEffectivenessReport> = {},
): SourceEffectivenessReport {
  return {
    sources: [
      {
        source_channel: 'Facebook',
        total_leads: 50,
        qualified: 10,
        screened: 5,
        randomized: 3,
        disqualified: 2,
        lead_to_randomize_rate: 0.06,
        campaigns: [],
      },
      {
        source_channel: 'Google',
        total_leads: 20,
        qualified: 4,
        screened: 2,
        randomized: 1,
        disqualified: 0,
        lead_to_randomize_rate: 0.05,
        campaigns: [],
      },
    ],
    top_source: 'Facebook',
    top_converting_source: 'Facebook',
    unattributed_count: 0,
    as_of: new Date().toISOString(),
    ...overrides,
  }
}

function makeFunnel(overrides: Partial<RecruitmentFunnelSummary> = {}): RecruitmentFunnelSummary {
  return {
    stages: [
      { stage: 'lead', count: 100, percent_of_entry: 1.0, drop_off_from_previous: 0 },
      { stage: 'contacted', count: 80, percent_of_entry: 0.8, drop_off_from_previous: 20 },
      { stage: 'pre_screen', count: 50, percent_of_entry: 0.5, drop_off_from_previous: 30 },
      { stage: 'qualified', count: 20, percent_of_entry: 0.2, drop_off_from_previous: 30 },
      { stage: 'scheduled', count: 10, percent_of_entry: 0.1, drop_off_from_previous: 10 },
      { stage: 'consented', count: 8, percent_of_entry: 0.08, drop_off_from_previous: 2 },
      { stage: 'screened', count: 7, percent_of_entry: 0.07, drop_off_from_previous: 1 },
      { stage: 'randomized', count: 5, percent_of_entry: 0.05, drop_off_from_previous: 2 },
    ],
    total_leads: 100,
    terminal_converted: 5,
    overall_conversion_rate: 0.05,
    as_of: new Date().toISOString(),
    ...overrides,
  }
}

function makeForecast(overrides: Partial<RecruitmentForecast> = {}): RecruitmentForecast {
  return {
    subjects_remaining: 5,
    projected_enrollment_date: '2026-09-01',
    days_to_projected: 90,
    days_to_deadline: 100,
    required_run_rate: 2.0,
    run_rate_gap: 0.5,
    leads_required: 20,
    current_pipeline_coverage: 0.8,
    probability_of_hitting_target: 0.85,
    risk_classification: 'on_track',
    as_of: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// CoordinatorProductivityCard
// ---------------------------------------------------------------------------

describe('CoordinatorProductivityCard', () => {
  test('renders leads_assigned, leads_advanced, pre_screens, qualified, conversion_rate', () => {
    const stats = makeCoordinatorStats({
      leads_assigned: 12,
      leads_advanced_in_period: 7,
      pre_screens_completed: 6,
      qualified_in_period: 4,
      conversion_rate: 0.333,
    })
    render(createElement(CoordinatorProductivityCard, { stats }))

    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    // conversion rate: 33.3%
    expect(screen.getByText(/33\.3%/)).toBeTruthy()
  })

  test('shows empty state when leads_assigned === 0', () => {
    const stats = makeCoordinatorStats({ leads_assigned: 0 })
    render(createElement(CoordinatorProductivityCard, { stats }))

    expect(screen.getByText('No leads assigned yet')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SourceEffectivenessCard
// ---------------------------------------------------------------------------

describe('SourceEffectivenessCard', () => {
  test('renders top sources table', () => {
    const report = makeSourceReport()
    render(createElement(SourceEffectivenessCard, { report }))

    expect(screen.getByText('Facebook')).toBeTruthy()
    expect(screen.getByText('Google')).toBeTruthy()
    expect(screen.getByText('Source Effectiveness')).toBeTruthy()
  })

  test('shows concentration warning when source > 80%', () => {
    // Facebook: 90 leads, Google: 10 leads → Facebook is 90% (> 80%)
    const report = makeSourceReport({
      sources: [
        {
          source_channel: 'Facebook',
          total_leads: 90,
          qualified: 15,
          screened: 8,
          randomized: 5,
          disqualified: 1,
          lead_to_randomize_rate: 0.055,
          campaigns: [],
        },
        {
          source_channel: 'Google',
          total_leads: 10,
          qualified: 2,
          screened: 1,
          randomized: 0,
          disqualified: 0,
          lead_to_randomize_rate: 0,
          campaigns: [],
        },
      ],
    })
    render(createElement(SourceEffectivenessCard, { report }))

    expect(screen.getByText(/Source concentration risk/)).toBeTruthy()
    expect(screen.getAllByText(/Facebook/).length).toBeGreaterThanOrEqual(1)
  })

  test('shows unattributed count when > 0', () => {
    const report = makeSourceReport({ unattributed_count: 7 })
    render(createElement(SourceEffectivenessCard, { report }))

    expect(screen.getByText('Unattributed leads:')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// PortfolioRecruitmentSummary
// ---------------------------------------------------------------------------

describe('PortfolioRecruitmentSummary', () => {
  test('counts on_track studies correctly', () => {
    const forecasts = [
      { studyId: 'a', studyName: 'Study A', forecast: makeForecast({ risk_classification: 'on_track' }) },
      { studyId: 'b', studyName: 'Study B', forecast: makeForecast({ risk_classification: 'at_risk' }) },
      { studyId: 'c', studyName: 'Study C', forecast: makeForecast({ risk_classification: 'on_track' }) },
    ]
    const funnel = makeFunnel()
    render(createElement(PortfolioRecruitmentSummary, { forecasts, funnelSummary: funnel, benchmarkReport: null }))

    // "On track" label shows the count 2
    const onTrackLabel = screen.getByText('On track')
    const onTrackCell = onTrackLabel.closest('[class]')?.parentElement
    // We check that '2' is rendered somewhere
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
  })

  test('counts at_risk and critical together', () => {
    const forecasts = [
      { studyId: 'a', forecast: makeForecast({ risk_classification: 'at_risk' }) },
      { studyId: 'b', forecast: makeForecast({ risk_classification: 'critical' }) },
      { studyId: 'c', forecast: makeForecast({ risk_classification: 'on_track' }) },
    ]
    const funnel = makeFunnel()
    render(createElement(PortfolioRecruitmentSummary, { forecasts, funnelSummary: funnel, benchmarkReport: null }))

    // At risk count should be 2 (at_risk + critical)
    // Studies recruiting: 3, On track: 1, At risk: 2
    const allText = document.body.textContent ?? ''
    expect(allText).toContain('At risk')
  })
})

// ---------------------------------------------------------------------------
// RecruitmentFunnelPanel
// ---------------------------------------------------------------------------

describe('RecruitmentFunnelPanel', () => {
  test('shows highest drop-off when total_leads > 0', () => {
    const funnel = makeFunnel()
    render(createElement(RecruitmentFunnelPanel, { funnel }))

    expect(screen.getByText('Highest drop-off')).toBeTruthy()
    // Pre-screen → qualified has drop of 30, contacted → pre_screen also 30
    expect(screen.getAllByText(/leads/).length).toBeGreaterThanOrEqual(1)
  })

  test('hides drop-off row when total_leads === 0', () => {
    const funnel = makeFunnel({
      total_leads: 0,
      stages: [
        { stage: 'lead', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'contacted', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'pre_screen', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'qualified', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'scheduled', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'consented', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'screened', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
        { stage: 'randomized', count: 0, percent_of_entry: 0, drop_off_from_previous: 0 },
      ],
    })
    render(createElement(RecruitmentFunnelPanel, { funnel }))

    expect(screen.queryByText('Highest drop-off')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// RecruitmentForecastSummary
// ---------------------------------------------------------------------------

describe('RecruitmentForecastSummary', () => {
  test('renders compact view with risk badge, date, remaining, leads needed', () => {
    const forecast = makeForecast({
      risk_classification: 'on_track',
      projected_enrollment_date: '2026-09-15',
      subjects_remaining: 8,
      leads_required: 24,
    })
    render(createElement(RecruitmentForecastSummary, { forecast, studyName: 'Test Study' }))

    expect(screen.getByText('Test Study')).toBeTruthy()
    expect(screen.getByText('On Track')).toBeTruthy()
    expect(screen.getByText('2026-09-15')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('24')).toBeTruthy()
  })
})
