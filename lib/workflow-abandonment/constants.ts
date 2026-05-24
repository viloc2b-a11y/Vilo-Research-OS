/**
 * Phase 16A-2.6 — Workflow abandonment detection constants.
 */

export const WORKFLOW_CHECKPOINT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  STALE: 'stale',
  ESCALATED: 'escalated',
} as const

export const WORKFLOW_CHECKPOINT_STATUSES = [
  WORKFLOW_CHECKPOINT_STATUS.ACTIVE,
  WORKFLOW_CHECKPOINT_STATUS.COMPLETED,
  WORKFLOW_CHECKPOINT_STATUS.STALE,
  WORKFLOW_CHECKPOINT_STATUS.ESCALATED,
] as const

export type WorkflowCheckpointStatus = (typeof WORKFLOW_CHECKPOINT_STATUSES)[number]

export const DEFAULT_STALE_THRESHOLD_HOURS = 24
