/**
 * Upsert workflow activity checkpoint (heartbeat for abandonment detection).
 */

import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import { DEFAULT_STALE_THRESHOLD_HOURS } from '@/lib/workflow-abandonment/constants'
import { redactGuardrailMetadata } from '@/lib/temporal-consistency/redact-metadata'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UpsertWorkflowCheckpointInput = {
  supabase: SupabaseClient
  organizationId: string
  workflowKey: WorkflowKey
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  lastActorId?: string | null
  completionPercent?: number | null
  staleThresholdHours?: number
  status?: 'active' | 'completed'
  metadata?: Record<string, unknown>
}

export async function upsertWorkflowCheckpoint(
  input: UpsertWorkflowCheckpointInput,
): Promise<{ checkpointId: string }> {
  const studyId = input.studyId ?? null
  const studySubjectId = input.studySubjectId ?? null
  const visitId = input.visitId ?? null
  const procedureExecutionId = input.procedureExecutionId ?? null
  const metadata = redactGuardrailMetadata(input.metadata ?? {})

  let selectQuery = input.supabase
    .from('workflow_activity_checkpoints')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('workflow_key', input.workflowKey)

  if (studyId) selectQuery = selectQuery.eq('study_id', studyId)
  else selectQuery = selectQuery.is('study_id', null)

  if (studySubjectId) selectQuery = selectQuery.eq('study_subject_id', studySubjectId)
  else selectQuery = selectQuery.is('study_subject_id', null)

  if (visitId) selectQuery = selectQuery.eq('visit_id', visitId)
  else selectQuery = selectQuery.is('visit_id', null)

  if (procedureExecutionId) {
    selectQuery = selectQuery.eq('procedure_execution_id', procedureExecutionId)
  } else {
    selectQuery = selectQuery.is('procedure_execution_id', null)
  }

  const { data: existing, error: selectError } = await selectQuery.maybeSingle()

  if (selectError) {
    throw new Error(`upsertWorkflowCheckpoint select failed: ${selectError.message}`)
  }

  const payload = {
    organization_id: input.organizationId,
    study_id: studyId,
    study_subject_id: studySubjectId,
    visit_id: visitId,
    procedure_execution_id: procedureExecutionId,
    workflow_key: input.workflowKey,
    last_active_at: new Date().toISOString(),
    last_actor_id: input.lastActorId ?? null,
    completion_percent: input.completionPercent ?? null,
    stale_threshold_hours: input.staleThresholdHours ?? DEFAULT_STALE_THRESHOLD_HOURS,
    status: input.status ?? 'active',
    metadata,
  }

  if (existing?.id) {
    const { data, error } = await input.supabase
      .from('workflow_activity_checkpoints')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      throw new Error(`upsertWorkflowCheckpoint update failed: ${error.message}`)
    }
    return { checkpointId: data.id as string }
  }

  const { data, error } = await input.supabase
    .from('workflow_activity_checkpoints')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(`upsertWorkflowCheckpoint insert failed: ${error.message}`)
  }

  return { checkpointId: data.id as string }
}
