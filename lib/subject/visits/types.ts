import type { VisitCalendarReschedule } from '@/lib/calendar/get-active-visit-reschedule'
import type { VisitReviewStatus } from '@/lib/subject/visits/progress-note/types'
import type { SubjectWorkflowVisitCounts } from '@/lib/subject/workflow/types'

export type { VisitCalendarReschedule } from '@/lib/calendar/get-active-visit-reschedule'

export type VisitWindowStatus = 'inside_window' | 'warning' | 'outside_window'

export type VisitGridStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'cancelled'
  | 'out_of_window'

export type SourceStatus = 'not_started' | 'draft' | 'submitted' | 'corrected' | 'signed'
export type EdcStatus = 'pending' | 'entered' | 'verified'
export type QcStatus = 'pending' | 'entered' | 'verified'
export type ReviewStatus = 'pending' | 'in_review' | 'complete'
export type SubjectPaymentStatus = 'pending' | 'scheduled' | 'paid' | 'waived' | 'n/a'

export type SubjectVisitGridRow = {
  id: string
  organizationId: string
  visitCode: string
  visitName: string
  visitDay: number | null
  protocolLabel: string
  arm: string | null
  targetDate: string | null
  scheduledDate: string | null
  completedDate: string | null
  windowStart: string | null
  windowEnd: string | null
  windowStatus: VisitWindowStatus
  visitStatus: VisitGridStatus
  visitReviewStatus: VisitReviewStatus
  rawVisitStatus: string
  sourceStatus: SourceStatus
  edcStatus: EdcStatus
  qcStatus: QcStatus
  reviewStatus: ReviewStatus
  subjectPayment: SubjectPaymentStatus
  coordinatorNote: string | null
  primaryProcedureId: string | null
  primaryResponseSetId: string | null
  workflow: SubjectWorkflowVisitCounts
  /** Active operational-calendar reschedule layer (does not change visits.target_date). */
  calendarReschedule: VisitCalendarReschedule | null
}

export type SubjectChartHeaderModel = {
  subjectId: string
  studyId: string
  organizationId: string
  subjectIdentifier: string
  initials: string | null
  studyName: string
  enrollmentStatus: string
  randomizationNumber: string | null
  randomizationArm: string | null
}

export type SubjectVisitsActionResult =
  | { ok: true }
  | { ok: false; error: string }
