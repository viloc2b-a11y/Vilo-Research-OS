/**
 * Detect stale workflow checkpoints — callable from future hourly job (no scheduler in phase).
 */

import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { observeWorkflowStaleAlert } from '@/lib/observability/hooks/observe-audit-integrity'
import {
  WORKFLOW_CHECKPOINT_STATUS,
} from '@/lib/workflow-abandonment/constants'
import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import type { SupabaseClient } from '@supabase/supabase-js'

type CheckpointRow = {
  id: string
  organization_id: string
  study_id: string | null
  study_subject_id: string | null
  visit_id: string | null
  procedure_execution_id: string | null
  workflow_key: string
  last_active_at: string
  stale_threshold_hours: number
  stale_alert_sent_at: string | null
}

export type StaleWorkflowDetection = {
  checkpointId: string
  workflowKey: WorkflowKey
  staleAgeHours: number
  thresholdHours: number
  staleEventId: string
  operationalEventId: string | null
}

export type DetectStaleWorkflowsInput = {
  supabase: SupabaseClient
  organizationId?: string
  limit?: number
}

export async function detectStaleWorkflows(
  input: DetectStaleWorkflowsInput,
): Promise<StaleWorkflowDetection[]> {
  let query = input.supabase
    .from('workflow_activity_checkpoints')
    .select(
      'id, organization_id, study_id, study_subject_id, visit_id, procedure_execution_id, workflow_key, last_active_at, stale_threshold_hours, stale_alert_sent_at',
    )
    .eq('status', WORKFLOW_CHECKPOINT_STATUS.ACTIVE)
    .is('stale_alert_sent_at', null)

  if (input.organizationId) {
    query = query.eq('organization_id', input.organizationId)
  }

  if (input.limit != null) {
    query = query.limit(input.limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`detectStaleWorkflows failed: ${error.message}`)
  }

  const now = Date.now()
  const results: StaleWorkflowDetection[] = []

  for (const row of (data ?? []) as CheckpointRow[]) {
    const lastActiveMs = new Date(row.last_active_at).getTime()
    const staleAgeHours = (now - lastActiveMs) / (1000 * 60 * 60)
    if (staleAgeHours < row.stale_threshold_hours) continue

    let operationalEventId: string | null = null
    if (row.study_id) {
      operationalEventId = await emitClinicalOperationalEvent({
        supabase: input.supabase as never,
        organizationId: row.organization_id,
        studyId: row.study_id,
        visitId: row.visit_id,
        procedureExecutionId: row.procedure_execution_id,
        actorUserId: null,
        eventType: OPERATIONAL_EVENT_TYPES.WORKFLOW_STALE_ALERT,
        payloadSource: 'workflow-abandonment',
        mutation: 'workflow_abandonment.detect_stale',
        subjectId: row.study_subject_id,
        details: {
          workflow_key: row.workflow_key,
          stale_age_hours: staleAgeHours,
          threshold_hours: row.stale_threshold_hours,
          workflow_checkpoint_id: row.id,
        },
      }).catch(() => null)
    }

    const { data: staleEvent, error: staleInsertError } = await input.supabase
      .from('workflow_stale_events')
      .insert({
        organization_id: row.organization_id,
        workflow_checkpoint_id: row.id,
        study_id: row.study_id,
        study_subject_id: row.study_subject_id,
        visit_id: row.visit_id,
        procedure_execution_id: row.procedure_execution_id,
        workflow_key: row.workflow_key,
        stale_age_hours: staleAgeHours,
        threshold_hours: row.stale_threshold_hours,
        operational_event_id: operationalEventId,
      })
      .select('id')
      .single()

    if (staleInsertError) {
      continue
    }

    await input.supabase
      .from('workflow_activity_checkpoints')
      .update({
        status: WORKFLOW_CHECKPOINT_STATUS.STALE,
        stale_alert_sent_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    const detection: StaleWorkflowDetection = {
      checkpointId: row.id,
      workflowKey: row.workflow_key as WorkflowKey,
      staleAgeHours,
      thresholdHours: row.stale_threshold_hours,
      staleEventId: staleEvent.id as string,
      operationalEventId,
    }

    results.push(detection)

    observeWorkflowStaleAlert({
      supabase: input.supabase,
      organizationId: row.organization_id,
      studyId: row.study_id,
      studySubjectId: row.study_subject_id,
      visitId: row.visit_id,
      procedureExecutionId: row.procedure_execution_id,
      workflowKey: row.workflow_key as WorkflowKey,
      checkpointId: row.id,
      staleEventId: staleEvent.id as string,
      operationalEventId,
      staleAgeHours,
      thresholdHours: row.stale_threshold_hours,
    })
  }

  return results
}
