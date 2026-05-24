/**
 * OBS-2 — Resolve source capture scope from response set for telemetry hooks.
 */

import type { SourceCaptureScope } from '@/lib/observability/hooks/observe-source-capture'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function resolveSourceCaptureScopeFromResponseSet(input: {
  supabase: SupabaseClient
  organizationId: string
  sourceResponseSetId: string
  actorUserId?: string | null
}): Promise<SourceCaptureScope | null> {
  const { data, error } = await input.supabase
    .from('source_response_sets')
    .select(
      'id, organization_id, study_id, study_subject_id, visit_id, procedure_execution_id',
    )
    .eq('id', input.sourceResponseSetId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error || !data) return null

  const visitId = data.visit_id as string | null
  const procedureExecutionId = data.procedure_execution_id as string | null
  const studySubjectId = data.study_subject_id as string | null
  const studyId = data.study_id as string | null

  if (!visitId || !procedureExecutionId || !studySubjectId || !studyId) return null

  return {
    supabase: input.supabase,
    organizationId: data.organization_id as string,
    studyId,
    studySubjectId,
    visitId,
    procedureExecutionId,
    actorUserId: input.actorUserId ?? null,
    sourceResponseSetId: data.id as string,
  }
}
