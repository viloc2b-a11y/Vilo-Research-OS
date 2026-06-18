import type {
  RecruitmentCommandCenterData,
  RecruitmentLeadSummary,
  StudyPressureCard,
} from '@/lib/crm/recruitment-loaders'
import type { OrganizationMembership } from '@/lib/auth/session'
import { resolveEffectiveRolesForMembership } from '@/lib/rbac/effective-roles'
import type { OrganizationRole } from '@/lib/rbac/roles'

export type RecruitmentRoleExperience = 'coordinator' | 'pi' | 'site_director' | 'owner' | 'read_only'
export type ScoreTier = 'high' | 'medium' | 'waitlist'
export type WorkReason = 'overdue_followup' | 'due_today' | 'high_score_uncontacted' | 'upcoming_screening' | 'stalled'
export type PressureState = 'low' | 'moderate' | 'high'

export type RecruitmentWorkItem = {
  lead: RecruitmentLeadSummary
  priority: number
  reasons: WorkReason[]
  daysOverdue: number | null
}

export type RecruitmentQueueItem = {
  lead: RecruitmentLeadSummary
  tier: ScoreTier
}

export type StudyPressureView = StudyPressureCard & {
  open_leads: number
  pressure_state: PressureState
}

export type RecruitmentViewModel = {
  roleExperience: RecruitmentRoleExperience
  summary: {
    todaysWorkCount: number
    queueCount: number
    pressuredStudyCount: number
  }
  todaysWork: RecruitmentWorkItem[]
  queue: RecruitmentQueueItem[]
  studyPressure: StudyPressureView[]
}

export function resolveRecruitmentRoleExperience(
  memberships: OrganizationMembership[],
  organizationId: string,
): RecruitmentRoleExperience {
  const roles = new Set<OrganizationRole>(
    memberships.flatMap((membership) => resolveEffectiveRolesForMembership(membership, organizationId)),
  )

  if (roles.has('owner') || roles.has('admin')) return 'owner'
  if (roles.has('site_director')) return 'site_director'
  if (
    roles.has('research_coordinator') ||
    roles.has('data_coordinator') ||
    roles.has('site_staff') ||
    roles.has('unblinded_coordinator')
  ) {
    return 'coordinator'
  }
  if (roles.has('pi_sub_i')) return 'pi'
  return 'read_only'
}

export function scoreTier(score: number | null): ScoreTier {
  if ((score ?? 0) >= 16) return 'high'
  if ((score ?? 0) >= 10) return 'medium'
  return 'waitlist'
}

export function daysOverdue(nextFollowUpAt: string | null, now = new Date()): number | null {
  if (!nextFollowUpAt) return null
  const due = new Date(nextFollowUpAt)
  if (Number.isNaN(due.getTime()) || due >= now) return null
  const diff = now.getTime() - due.getTime()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

function isSameUtcDate(value: string, now = new Date()): boolean {
  return value.slice(0, 10) === now.toISOString().slice(0, 10)
}

export function workReasons(lead: RecruitmentLeadSummary, now = new Date()): WorkReason[] {
  const reasons: WorkReason[] = []
  const overdueDays = daysOverdue(lead.next_follow_up_at, now)
  const createdAt = new Date(lead.created_at)
  const daysSinceCreated = Number.isNaN(createdAt.getTime())
    ? 0
    : Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000))

  if (overdueDays !== null) reasons.push('overdue_followup')
  if (lead.next_follow_up_at && overdueDays === null && isSameUtcDate(lead.next_follow_up_at, now)) {
    reasons.push('due_today')
  }
  if ((lead.prescreen_score ?? 0) >= 16 && lead.contact_attempts === 0) {
    reasons.push('high_score_uncontacted')
  }
  if (lead.stage === 'scheduled') reasons.push('upcoming_screening')
  if (lead.contact_attempts > 0 && lead.last_contacted_at && daysSinceCreated >= 7 && lead.stage !== 'qualified') {
    reasons.push('stalled')
  }

  return reasons
}

export function pressureState(signal: StudyPressureCard['pressure_signal']): PressureState {
  if (signal === 'on_track') return 'low'
  if (signal === 'lagging') return 'moderate'
  return 'high'
}

export function toRecruitmentViewModel(
  data: RecruitmentCommandCenterData,
  memberships: OrganizationMembership[],
  organizationId: string,
  now = new Date(),
): RecruitmentViewModel {
  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)
  const canSeeOperationalQueue = roleExperience === 'coordinator' || roleExperience === 'owner' || roleExperience === 'site_director'

  const todaysWork = data.todaysWork.map((lead) => ({
    lead,
    priority: lead.priority_score,
    reasons: workReasons(lead, now),
    daysOverdue: daysOverdue(lead.next_follow_up_at, now),
  }))

  const queue = canSeeOperationalQueue
    ? data.queue.leads.map((lead) => ({ lead, tier: scoreTier(lead.prescreen_score) }))
    : []

  const studyPressure = data.studyPressure.map((study) => ({
    ...study,
    open_leads: study.qualified_count + study.scheduled_count,
    pressure_state: pressureState(study.pressure_signal),
  }))

  return {
    roleExperience,
    summary: {
      todaysWorkCount: todaysWork.length,
      queueCount: data.queue.total,
      pressuredStudyCount: studyPressure.filter((study) => study.pressure_state !== 'low').length,
    },
    todaysWork,
    queue,
    studyPressure,
  }
}
