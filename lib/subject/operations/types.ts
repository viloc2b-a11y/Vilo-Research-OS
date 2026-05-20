import type { VisitCalendarReschedule } from '@/lib/calendar/get-active-visit-reschedule'
import type { VisitReviewStatus } from '@/lib/subject/visits/progress-note/types'
import type { SourceStatus, VisitGridStatus, VisitWindowStatus } from '@/lib/subject/visits/types'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

export type SubjectOperationalHealth = 'healthy' | 'attention' | 'critical'

export type UpcomingVisitItem = {
  visitId: string
  visitName: string
  visitDay: number | null
  targetDate: string | null
  scheduledDate: string | null
  windowStart: string | null
  windowEnd: string | null
  windowStatus: VisitWindowStatus
  reminderStatus: 'none' | 'pending' | 'sent'
  isOverdueScheduling: boolean
  href: string
  calendarReschedule: VisitCalendarReschedule | null
}

export type PendingActionItem = {
  id: string
  kind: 'query' | 'correction' | 'follow_up' | 'action' | 'escalation'
  title: string
  dueDate: string | null
  isOverdue: boolean
  priority: string
  href: string
}

export type PendingSignatureItem = {
  id: string
  kind: 'coordinator' | 'investigator' | 'workflow'
  visitName: string | null
  label: string
  href: string
}

export type ValidationIssueItem = {
  id: string
  kind: 'blocked' | 'incomplete' | 'finding'
  label: string
  visitId: string | null
  visitName: string | null
  href: string
}

export type VisitHealthTimelineItem = {
  visitId: string
  visitName: string
  visitDay: number | null
  targetDate: string | null
  scheduledDate: string | null
  displayDate: string | null
  calendarReschedule: VisitCalendarReschedule | null
  actualDate: string | null
  windowStatus: VisitWindowStatus
  visitStatus: VisitGridStatus
  visitReviewStatus: VisitReviewStatus
  sourceStatus: SourceStatus
  signaturesPending: string[]
  unresolvedIssues: number
  blockedProcedureCount: number
  /** Primary deep link (capture when in progress, else visit workspace). */
  href: string
  visitDetailHref: string
  captureHref: string | null
  reviewHref: string | null
}

export type SubjectOperationalIntelligence = {
  health: SubjectOperationalHealth
  healthReasons: string[]
  upcomingVisits: UpcomingVisitItem[]
  pendingActions: PendingActionItem[]
  pendingSignatures: PendingSignatureItem[]
  validationIssues: ValidationIssueItem[]
  visitTimeline: VisitHealthTimelineItem[]
}

export type SubjectOperationalContext = {
  subjectId: string
  studyId: string
  organizationId: string
  workflowActions: SubjectWorkflowAction[]
}
