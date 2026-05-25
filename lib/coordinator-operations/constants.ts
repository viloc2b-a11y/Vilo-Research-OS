/**
 * Phase 16B — Coordinator operational surface bucket labels.
 * Queues support coordinator operational survival prioritization (not external task management).
 */

export const OPERATIONAL_WORK_QUEUE_BUCKET = {
  DO_NOW: 'Do now',
  BLOCKED: 'Blocked',
  NEEDS_PI: 'Needs PI/Sub-I',
  SOURCE_INCOMPLETE: 'Source incomplete',
  SAFETY_GOVERNANCE: 'Safety/governance',
  FOLLOW_UP_LATER: 'Follow-up later',
} as const

export const MAX_SITE_TOP_ACTIONS = 5
export const MAX_STUDY_QUEUE_ITEMS_PER_BUCKET = 5
export const MAX_SUBJECT_OPEN_SOURCE_SHOWN = 8
