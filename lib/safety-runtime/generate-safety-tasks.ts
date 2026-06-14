import type { SafetyEventTaskType } from './safety-types'

// Sentinel date used for tasks that have no hard deadline.
// Stored as a far-future date because the DB column is NOT NULL.
export const NO_DEADLINE_SENTINEL = new Date('9999-12-31T00:00:00.000Z')

export type SafetyTask = {
  task_type: SafetyEventTaskType
  due_date: Date | null
  safety_event_id: string
  organization_id: string
}

type GenerateSafetyTasksArgs = {
  eventId: string
  organizationId: string
  eventType: string | null
  severity: string | null
  eventDate: Date
}

function addCalendarDays(base: Date, days: number): Date {
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000)
}

/**
 * Pure function — no DB calls.
 * Generates the compliance task set for a safety event based on its
 * classification and severity.
 */
export function generateSafetyTasks(args: GenerateSafetyTasksArgs): SafetyTask[] {
  const { eventId, organizationId, eventType, severity, eventDate } = args
  const tasks: SafetyTask[] = []

  const push = (task_type: SafetyEventTaskType, due_date: Date | null) => {
    tasks.push({ task_type, due_date, safety_event_id: eventId, organization_id: organizationId })
  }

  if (eventType === 'sae') {
    push('15_day_report', addCalendarDays(eventDate, 15))
    push('sponsor_notification', addHours(eventDate, 24))
    push('irb_notification', addCalendarDays(eventDate, 7))
  }

  if (severity === 'severe') {
    push('followup_required', addCalendarDays(eventDate, 30))
  }

  // Always — no hard deadline
  push('resolution_documentation', null)

  return tasks
}
