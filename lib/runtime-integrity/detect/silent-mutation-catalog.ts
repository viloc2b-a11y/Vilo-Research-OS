/**
 * Remaining silent mutation patch plan (Phase 6 catalog).
 * Status: patched | partial | silent | rpc_only | planned
 */

export type SilentMutationStatus =
  | 'patched'
  | 'partial'
  | 'silent'
  | 'rpc_only'
  | 'planned'

export type SilentMutationCatalogEntry = {
  id: string
  mutation: string
  table: string
  file: string
  status: SilentMutationStatus
  expectedEventType: string | null
  notes: string
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export const SILENT_MUTATION_PATCH_PLAN: SilentMutationCatalogEntry[] = [
  {
    id: 'visit-check-in',
    mutation: 'visits.check_in',
    table: 'visits',
    file: 'lib/actions/check-in-visit.ts',
    status: 'patched',
    expectedEventType: 'VISIT_CHECKED_IN',
    notes: 'Gateway emit after successful update.',
    priority: 'critical',
  },
  {
    id: 'visit-reschedule',
    mutation: 'visits.reschedule',
    table: 'visits',
    file: 'lib/visits/rescheduleVisit.ts',
    status: 'patched',
    expectedEventType: 'VISIT_RESCHEDULED',
    notes: 'Gateway emit on reschedule.',
    priority: 'high',
  },
  {
    id: 'schedule-materialize',
    mutation: 'visits.schedule_materialize',
    table: 'visits',
    file: 'lib/visits/generateSubjectVisitSchedule.ts',
    status: 'partial',
    expectedEventType: 'SCHEDULE_MATERIALIZED',
    notes: 'Emits when createdCount > 0; visit/procedure inserts may rollback without per-row events.',
    priority: 'high',
  },
  {
    id: 'procedure-sign',
    mutation: 'procedure_executions.sign',
    table: 'procedure_executions',
    file: 'lib/visit-runtime/signProcedure.ts',
    status: 'partial',
    expectedEventType: 'PROCEDURE_SIGNED',
    notes: 'Uses logProcedureOperationalEvent; verify payload envelope matches gateway standard.',
    priority: 'critical',
  },
  {
    id: 'procedure-validate-update',
    mutation: 'procedure_executions.validation_status',
    table: 'procedure_executions',
    file: 'lib/actions/complete-procedure-execution.ts',
    status: 'silent',
    expectedEventType: 'VALIDATION_EXECUTED',
    notes: 'Updates validation_status without spine event.',
    priority: 'medium',
  },
  {
    id: 'visit-runtime-validate',
    mutation: 'procedure_executions.validation_status',
    table: 'procedure_executions',
    file: 'lib/subject/visit-runtime/actions.ts',
    status: 'silent',
    expectedEventType: 'VALIDATION_EXECUTED',
    notes: 'Validation refresh write only.',
    priority: 'medium',
  },
  {
    id: 'progress-note-save',
    mutation: 'visit_progress_notes.upsert',
    table: 'visit_progress_notes',
    file: 'lib/subject/visits/progress-note/actions.ts',
    status: 'patched',
    expectedEventType: 'NOTE_ADDED',
    notes: 'appendVisitCloseoutEvent → logVisitOperationalEvent (NOTE_ADDED) after upsert.',
    priority: 'high',
  },
  {
    id: 'workflow-create-generic',
    mutation: 'subject_workflow_actions.create',
    table: 'subject_workflow_actions',
    file: 'lib/subject/workflow/actions.ts',
    status: 'partial',
    expectedEventType: 'QUERY_CREATED | FOLLOW_UP_CREATED | SIGNATURE_REQUESTED',
    notes: 'Only query/signature/follow_up types emit; action/correction silent.',
    priority: 'high',
  },
  {
    id: 'workflow-resolve-non-query',
    mutation: 'subject_workflow_actions.resolve',
    table: 'subject_workflow_actions',
    file: 'lib/subject/workflow/actions.ts',
    status: 'partial',
    expectedEventType: 'QUERY_RESOLVED',
    notes: 'Only query resolve emits spine event.',
    priority: 'medium',
  },
  {
    id: 'subject-enrollment',
    mutation: 'study_subjects.enrollment_status',
    table: 'study_subjects',
    file: 'lib/subject/subject-chart/actions.ts',
    status: 'patched',
    expectedEventType: 'SUBJECT_* | external_randomization_* | NOTE_ADDED',
    notes: 'ClinicalMutationGateway via emitSubjectChartSpineEvent; rollbacks emit compensating spine events.',
    priority: 'high',
  },
  {
    id: 'source-rpc-open',
    mutation: 'source.open_response_set',
    table: 'source_response_sets',
    file: 'supabase/migrations (RPC)',
    status: 'rpc_only',
    expectedEventType: null,
    notes: 'RPC may not emit — add emission in RPC hardening plan.',
    priority: 'critical',
  },
  {
    id: 'source-rpc-save-draft',
    mutation: 'source.save_draft',
    table: 'source_responses',
    file: 'supabase/migrations (RPC)',
    status: 'rpc_only',
    expectedEventType: null,
    notes: 'High-volume draft saves — consider sampled telemetry vs full spine.',
    priority: 'medium',
  },
  {
    id: 'ae-registry',
    mutation: 'subject_adverse_events.upsert',
    table: 'subject_adverse_events',
    file: 'lib/subject/adverse-events/actions.ts',
    status: 'patched',
    expectedEventType: 'ADVERSE_EVENT_CREATED | ADVERSE_EVENT_UPDATED',
    notes: 'Gateway bridge after profile event.',
    priority: 'critical',
  },
  {
    id: 'visit-coordinator-patch',
    mutation: 'visits.coordinator_fields',
    table: 'visits',
    file: 'lib/visits/actions.ts',
    status: 'patched',
    expectedEventType: 'NOTE_ADDED',
    notes: 'Reminder patch emits NOTE_ADDED via ClinicalMutationGateway.',
    priority: 'low',
  },
  {
    id: 'engine-task-materializer',
    mutation: 'subject_workflow_actions.insert',
    table: 'subject_workflow_actions',
    file: 'lib/source-engine/workflow/task-materializer.ts',
    status: 'patched',
    expectedEventType: 'FOLLOW_UP_CREATED | QUERY_CREATED | SIGNATURE_REQUESTED',
    notes: 'Per-row emitWorkflowActionCreatedEvent after insert.',
    priority: 'high',
  },
  {
    id: 'validate-visit-procedures',
    mutation: 'procedure_executions.validation_status',
    table: 'procedure_executions',
    file: 'lib/visit-runtime/validateVisitProcedures.ts',
    status: 'patched',
    expectedEventType: 'VALIDATION_EXECUTED',
    notes: 'Batch VALIDATION_EXECUTED after per-procedure validation_status updates.',
    priority: 'medium',
  },
  {
    id: 'subject-visits-actions',
    mutation: 'visits.update',
    table: 'visits',
    file: 'lib/subject/visits/actions.ts',
    status: 'patched',
    expectedEventType: 'NOTE_ADDED',
    notes: 'Coordinator note patch emits NOTE_ADDED via gateway.',
    priority: 'medium',
  },
  {
    id: 'runtime-automation-workflow-materialize',
    mutation: 'subject_workflow_actions.insert',
    table: 'subject_workflow_actions',
    file: 'lib/runtime-automation/automate/workflow-materialize.ts',
    status: 'patched',
    expectedEventType: 'FOLLOW_UP_CREATED',
    notes: 'emitWorkflowActionCreatedEvent after automation workflow insert.',
    priority: 'high',
  },
  {
    id: 'runtime-automation-reverse-workflow',
    mutation: 'subject_workflow_actions.update',
    table: 'subject_workflow_actions',
    file: 'lib/runtime-automation/execute/reverse-execution.ts',
    status: 'patched',
    expectedEventType: 'RUNTIME_AUTOMATION_REVERSED',
    notes: 'Spine event before workflow cancel update; execution reversal emitted at end.',
    priority: 'high',
  },
]

export function catalogEntriesByStatus(status: SilentMutationStatus): SilentMutationCatalogEntry[] {
  return SILENT_MUTATION_PATCH_PLAN.filter((e) => e.status === status)
}

export function catalogSummary(): Record<SilentMutationStatus, number> {
  const summary: Record<string, number> = {}
  for (const entry of SILENT_MUTATION_PATCH_PLAN) {
    summary[entry.status] = (summary[entry.status] ?? 0) + 1
  }
  return summary as Record<SilentMutationStatus, number>
}
