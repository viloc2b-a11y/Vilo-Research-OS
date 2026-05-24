/**
 * Phase 16A-2.6 — Workflow abandonment detection.
 */

export {
  WORKFLOW_CHECKPOINT_STATUS,
  WORKFLOW_CHECKPOINT_STATUSES,
  DEFAULT_STALE_THRESHOLD_HOURS,
} from '@/lib/workflow-abandonment/constants'

export type { WorkflowCheckpointStatus } from '@/lib/workflow-abandonment/constants'

export { upsertWorkflowCheckpoint } from '@/lib/workflow-abandonment/upsert-workflow-checkpoint'
export type { UpsertWorkflowCheckpointInput } from '@/lib/workflow-abandonment/upsert-workflow-checkpoint'

export { detectStaleWorkflows } from '@/lib/workflow-abandonment/detect-stale-workflows'
export type {
  DetectStaleWorkflowsInput,
  StaleWorkflowDetection,
} from '@/lib/workflow-abandonment/detect-stale-workflows'
