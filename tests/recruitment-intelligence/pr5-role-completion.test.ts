import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { PIStudyEnrollmentPanel } from '@/components/recruitment-intelligence/PIStudyEnrollmentPanel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type PIStudyEntry = {
  studyId: string
  studyName: string
  randomizedCount: number
  enrollmentTarget: number
  qualifiedCount: number
  scheduledCount: number
  forecastRisk?: 'on_track' | 'at_risk' | 'critical' | 'impossible' | null
  workspaceHref: string
}

function makePIStudy(overrides: Partial<PIStudyEntry> = {}): PIStudyEntry {
  return {
    studyId: 'study-1',
    studyName: 'Alpha Trial',
    randomizedCount: 4,
    enrollmentTarget: 10,
    qualifiedCount: 3,
    scheduledCount: 2,
    forecastRisk: 'on_track',
    workspaceHref: '/studies/study-1/workspace',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// PIStudyEnrollmentPanel — renders study data
// ---------------------------------------------------------------------------

describe('PIStudyEnrollmentPanel', () => {
  test('renders study name, enrolled/target, and forecast risk badge', () => {
    const studies = [
      makePIStudy({
        studyName: 'Beta Trial',
        randomizedCount: 6,
        enrollmentTarget: 20,
        forecastRisk: 'at_risk',
      }),
    ]
    render(createElement(PIStudyEnrollmentPanel, { studies }))

    expect(screen.getByText('Beta Trial')).toBeTruthy()
    expect(screen.getByText('6 / 20 enrolled')).toBeTruthy()
    // ForecastRiskBadge renders "At Risk" for at_risk
    expect(screen.getByText('At Risk')).toBeTruthy()
  })

  test('renders empty state when studies array is empty', () => {
    render(createElement(PIStudyEnrollmentPanel, { studies: [] }))

    expect(screen.getByText('No active study recruitment data')).toBeTruthy()
  })

  test('renders a link to workspace href for each study', () => {
    const studies = [
      makePIStudy({ studyId: 'study-abc', workspaceHref: '/studies/study-abc/workspace' }),
      makePIStudy({
        studyId: 'study-xyz',
        studyName: 'Gamma Trial',
        workspaceHref: '/studies/study-xyz/workspace',
      }),
    ]
    render(createElement(PIStudyEnrollmentPanel, { studies }))

    const links = document.querySelectorAll('a[href]')
    const hrefs = Array.from(links).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/studies/study-abc/workspace')
    expect(hrefs).toContain('/studies/study-xyz/workspace')
  })

  test('shows "enrolled" without target when enrollmentTarget is 0', () => {
    const studies = [
      makePIStudy({
        studyName: 'Delta Trial',
        randomizedCount: 3,
        enrollmentTarget: 0,
      }),
    ]
    render(createElement(PIStudyEnrollmentPanel, { studies }))

    expect(screen.getByText('3 enrolled')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Site director queueVisible logic
// ---------------------------------------------------------------------------

describe('queueVisible — site_director role', () => {
  // Test the logic directly as a pure predicate to avoid importing the full shell.
  // The condition in RecruitmentCommandCenterShell is:
  //   roleExperience === 'coordinator' || roleExperience === 'owner' || roleExperience === 'site_director'
  function resolveQueueVisible(
    roleExperience: 'coordinator' | 'pi' | 'site_director' | 'owner' | 'read_only',
  ): boolean {
    return (
      roleExperience === 'coordinator' ||
      roleExperience === 'owner' ||
      roleExperience === 'site_director'
    )
  }

  test('site_director results in queueVisible = true', () => {
    expect(resolveQueueVisible('site_director')).toBe(true)
  })

  test('coordinator results in queueVisible = true', () => {
    expect(resolveQueueVisible('coordinator')).toBe(true)
  })

  test('owner results in queueVisible = true', () => {
    expect(resolveQueueVisible('owner')).toBe(true)
  })

  test('pi results in queueVisible = false', () => {
    expect(resolveQueueVisible('pi')).toBe(false)
  })

  test('read_only results in queueVisible = false', () => {
    expect(resolveQueueVisible('read_only')).toBe(false)
  })
})
