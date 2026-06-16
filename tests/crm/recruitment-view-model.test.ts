import { describe, expect, test } from 'vitest'
import {
  daysOverdue,
  pressureState,
  scoreTier,
  toRecruitmentViewModel,
  workReasons,
} from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import type { RecruitmentCommandCenterData, RecruitmentLeadSummary } from '@/lib/crm/recruitment-loaders'
import type { OrganizationMembership } from '@/lib/auth/session'

function lead(overrides: Partial<RecruitmentLeadSummary> = {}): RecruitmentLeadSummary {
  return {
    id: 'lead-1',
    full_name: 'Jane Doe',
    phone: '5551234567',
    email: null,
    stage: 'lead',
    prescreen_score: null,
    recruitment_source_channel: null,
    campaign_id: null,
    assigned_user_id: null,
    contact_attempts: 0,
    last_contacted_at: null,
    next_follow_up_at: null,
    created_at: '2026-06-01T00:00:00.000Z',
    priority_score: 0,
    ...overrides,
  }
}

function membership(role: string, roles: string[] = []): OrganizationMembership {
  return {
    organization_id: 'org-1',
    role,
    roles,
    status: 'active',
    organizations: { id: 'org-1', name: 'Org 1' },
  }
}

describe('recruitment view model', () => {
  test('maps score tiers for queue display', () => {
    expect(scoreTier(18)).toBe('high')
    expect(scoreTier(10)).toBe('medium')
    expect(scoreTier(4)).toBe('waitlist')
  })

  test('derives today work reasons from lead signals', () => {
    const now = new Date('2026-06-16T12:00:00.000Z')
    const reasons = workReasons(
      lead({
        prescreen_score: 18,
        contact_attempts: 0,
        next_follow_up_at: '2026-06-15T12:00:00.000Z',
      }),
      now,
    )

    expect(reasons).toContain('overdue_followup')
    expect(reasons).toContain('high_score_uncontacted')
    expect(daysOverdue('2026-06-15T12:00:00.000Z', now)).toBe(1)
  })

  test('maps study pressure signals to low, moderate, high', () => {
    expect(pressureState('on_track')).toBe('low')
    expect(pressureState('lagging')).toBe('moderate')
    expect(pressureState('stalled')).toBe('high')
  })

  test('hides operational queue for PI read-only experience', () => {
    const data: RecruitmentCommandCenterData = {
      todaysWork: [lead()],
      queue: { leads: [lead({ id: 'queued' })], total: 1 },
      studyPressure: [],
    }

    const model = toRecruitmentViewModel(data, [membership('pi_sub_i')], 'org-1')

    expect(model.roleExperience).toBe('pi')
    expect(model.queue).toHaveLength(0)
  })
})
