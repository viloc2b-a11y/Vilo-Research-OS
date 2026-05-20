export type VisitWindowStatus = 'inside_window' | 'warning' | 'outside_window'

export type VisitConfirmationStatus = 'pending' | 'confirmed' | 'reminder_sent'

export type VisitScheduleStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'missed'
  | 'out_of_window'
  | 'locked'

export type VisitReminderType = 'sms' | 'phone'

export type SubjectVisitScheduleItem = {
  visitId: string
  visitDefinitionId: string
  visitCode: string
  visitName: string
  visitDay: number | null
  targetDate: string | null
  scheduledDate: string | null
  actualVisitDate: string | null
  windowStartDate: string | null
  windowEndDate: string | null
  visitStatus: VisitScheduleStatus | string
  windowStatus: VisitWindowStatus
  confirmationStatus: VisitConfirmationStatus
  primaryProcedureId: string | null
  captureHref: string | null
  visitDetailHref: string
  isCurrent: boolean
}

export type CoordinatorVisitAlert = {
  id: string
  alertType:
    | 'approaching'
    | 'reminder_pending'
    | 'overdue_scheduling'
    | 'missed'
    | 'out_of_window'
  visitId: string
  studyId: string
  subjectId: string
  subjectIdentifier: string
  visitLabel: string
  scheduledDate: string | null
  targetDate: string | null
  windowEndDate: string | null
  message: string
  href: string
}

export type GenerateScheduleResult =
  | { ok: true; createdCount: number; skipped: boolean }
  | { ok: false; error: string }

export type RescheduleVisitResult =
  | { ok: true; windowStatus: VisitWindowStatus; visitStatus: string }
  | { ok: false; error: string }
