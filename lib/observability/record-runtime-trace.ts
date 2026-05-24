/**
 * OBS-2 — Persist runtime_traces (best-effort; callers should use safeObserve).
 */

import { buildRuntimeTraceInsertPayload } from '@/lib/observability/build-trace-payload'
import type { RuntimeTraceInsert } from '@/lib/observability/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecordRuntimeTraceInput = RuntimeTraceInsert & {
  supabase: SupabaseClient
  endedAt?: string | null
}

export async function recordRuntimeTrace(
  input: RecordRuntimeTraceInput,
): Promise<string | null> {
  const payload = buildRuntimeTraceInsertPayload(input)

  const { data, error } = await input.supabase
    .from('runtime_traces')
    .insert({
      organization_id: payload.organizationId,
      study_id: payload.studyId ?? null,
      study_subject_id: payload.studySubjectId ?? null,
      visit_id: payload.visitId ?? null,
      procedure_execution_id: payload.procedureExecutionId ?? null,
      workflow_key: payload.workflowKey,
      base_authority_level: payload.baseAuthorityLevel,
      effective_authority_level: payload.effectiveAuthorityLevel,
      trace_type: payload.traceType,
      status: payload.status,
      actor_user_id: payload.actorUserId ?? null,
      source_operational_event_id: payload.sourceOperationalEventId ?? null,
      metadata: payload.metadata,
      started_at: payload.startedAt ?? new Date().toISOString(),
      ended_at: input.endedAt ?? payload.endedAt ?? null,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`recordRuntimeTrace failed: ${error.message}`)
  }

  return (data?.id as string) ?? null
}
