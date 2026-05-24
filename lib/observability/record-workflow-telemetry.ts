/**
 * OBS-2 — Persist workflow_telemetry_events (best-effort; callers should use safeObserve).
 */

import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import { redactTelemetryMetadata } from '@/lib/observability/redact-telemetry-metadata'
import type { WorkflowTelemetryType } from '@/lib/observability/constants'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecordWorkflowTelemetryInput = {
  supabase: SupabaseClient
  organizationId: string
  telemetryType: WorkflowTelemetryType
  /** Semantic hook signal (e.g. source_response_set_opened) — stored in metadata.signal */
  signal: string
  workflowKey?: WorkflowKey | null
  runtimeTraceId?: string | null
  actorUserId?: string | null
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  metadata?: Record<string, unknown>
}

export async function recordWorkflowTelemetry(
  input: RecordWorkflowTelemetryInput,
): Promise<string | null> {
  const metadata = redactTelemetryMetadata({
    signal: input.signal,
    ...(input.metadata ?? {}),
  })

  const { data, error } = await input.supabase
    .from('workflow_telemetry_events')
    .insert({
      organization_id: input.organizationId,
      runtime_trace_id: input.runtimeTraceId ?? null,
      workflow_key: input.workflowKey ?? null,
      telemetry_type: input.telemetryType,
      actor_user_id: input.actorUserId ?? null,
      study_id: input.studyId ?? null,
      study_subject_id: input.studySubjectId ?? null,
      visit_id: input.visitId ?? null,
      procedure_execution_id: input.procedureExecutionId ?? null,
      metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`recordWorkflowTelemetry failed: ${error.message}`)
  }

  return (data?.id as string) ?? null
}
