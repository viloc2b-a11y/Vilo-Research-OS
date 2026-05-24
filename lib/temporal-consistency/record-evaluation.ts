/**
 * Persist temporal consistency evaluation + emit TEMPORAL_CONSISTENCY_EVALUATED spine event.
 */

import { observeTemporalConsistencyEvaluated } from '@/lib/observability/hooks/observe-compliance-guardrails'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { redactGuardrailMetadata } from '@/lib/temporal-consistency/redact-metadata'
import type { TemporalConsistencyEvaluationInsert } from '@/lib/temporal-consistency/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecordTemporalConsistencyEvaluationInput =
  TemporalConsistencyEvaluationInsert & {
    supabase: SupabaseClient
    studyId: string
    actorUserId: string | null
    visitId?: string | null
    procedureExecutionId?: string | null
  }

export async function recordTemporalConsistencyEvaluation(
  input: RecordTemporalConsistencyEvaluationInput,
): Promise<{ evaluationId: string; operationalEventId: string | null }> {
  const metadata = redactGuardrailMetadata(input.metadata ?? {})
  const evidenceRefs = redactGuardrailMetadata(input.evidenceRefs ?? {})

  const operationalEventId = await emitClinicalOperationalEvent({
    supabase: input.supabase as never,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitId: input.visitId ?? null,
    procedureExecutionId: input.procedureExecutionId ?? null,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.TEMPORAL_CONSISTENCY_EVALUATED,
    payloadSource: 'temporal-consistency',
    mutation: 'temporal_consistency.record_evaluation',
    subjectId: input.studySubjectId ?? null,
    details: {
      rule_key: input.ruleKey,
      evaluation_result: input.evaluationResult,
      severity: input.severity,
    },
  })

  const { data, error } = await input.supabase
    .from('temporal_consistency_evaluations')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      study_version_id: input.studyVersionId ?? null,
      study_subject_id: input.studySubjectId ?? null,
      visit_id: input.visitId ?? null,
      procedure_execution_id: input.procedureExecutionId ?? null,
      rule_id: input.ruleId ?? null,
      rule_key: input.ruleKey,
      evaluation_result: input.evaluationResult,
      severity: input.severity,
      event_a_value: input.eventAValue ?? null,
      event_b_value: input.eventBValue ?? null,
      evidence_refs: evidenceRefs,
      source_operational_event_id: operationalEventId,
      metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`recordTemporalConsistencyEvaluation failed: ${error.message}`)
  }

  const evaluationId = data.id as string

  observeTemporalConsistencyEvaluated({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId ?? null,
    visitId: input.visitId ?? null,
    procedureExecutionId: input.procedureExecutionId ?? null,
    actorUserId: input.actorUserId,
    evaluationId,
    operationalEventId,
    ruleKey: input.ruleKey,
    evaluationResult: input.evaluationResult,
    severity: input.severity,
  })

  return { evaluationId, operationalEventId }
}
