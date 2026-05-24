/**
 * GCP/ICH E6(R3) default SAE reporting windows (UTC).
 * Protocol-specific overrides deferred.
 */

export const SAE_INITIAL_NOTIFICATION_HOURS = 24
export const SAE_FOLLOWUP_DAYS = 7
export const SAE_NARRATIVE_DAYS = 15

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR

export type SaeTimelineDueDates = {
  saeOnsetAt: string
  initialNotificationDueAt: string
  followupDueAt: string
  narrativeDueAt: string
}

/**
 * Pure UTC timeline calculator — no DB calls, no protocol overrides.
 */
export function calculateSaeTimelines(saeOnsetAt: Date): SaeTimelineDueDates {
  const onsetMs = saeOnsetAt.getTime()
  if (Number.isNaN(onsetMs)) {
    throw new Error('calculateSaeTimelines: invalid saeOnsetAt')
  }

  const initialNotificationDueAt = new Date(
    onsetMs + SAE_INITIAL_NOTIFICATION_HOURS * MS_PER_HOUR,
  )
  const followupDueAt = new Date(onsetMs + SAE_FOLLOWUP_DAYS * MS_PER_DAY)
  const narrativeDueAt = new Date(onsetMs + SAE_NARRATIVE_DAYS * MS_PER_DAY)

  return {
    saeOnsetAt: saeOnsetAt.toISOString(),
    initialNotificationDueAt: initialNotificationDueAt.toISOString(),
    followupDueAt: followupDueAt.toISOString(),
    narrativeDueAt: narrativeDueAt.toISOString(),
  }
}
