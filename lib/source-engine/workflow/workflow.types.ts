/**
 * Workflow action types — tasks created by rules (CREATE_TASK) and visit execution.
 */

export type WorkflowTaskKind =
  | 'acth_stimulation_required'
  | 'hit_workup'
  | 'pregnancy_confirm'
  | 'pk_window_deviation'
  | 'signature_required'
  | 'correction_required'
  | 'monitor_review'

export type WorkflowTask = {
  id: string
  kind: WorkflowTaskKind
  title: string
  description?: string
  subjectId: string
  visitId?: string
  fieldId?: string
  sectionId?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: string
  metadata?: Record<string, unknown>
}

export type WorkflowEvaluationResult = {
  tasks: WorkflowTask[]
}
