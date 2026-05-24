/**
 * Persist delegation runtime check + emit DELEGATION_RUNTIME_CHECKED spine event.
 */

import { observeDelegationRuntimeChecked } from '@/lib/observability/hooks/observe-compliance-guardrails'
import { emitClinicalOperationalEvent } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { redactGuardrailMetadata } from '@/lib/temporal-consistency/redact-metadata'
import type { DelegationRuntimeCheckRecordInput } from '@/lib/delegation-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecordDelegationRuntimeCheckInput = DelegationRuntimeCheckRecordInput & {
  supabase: SupabaseClient
  studyId: string
}

export async function recordDelegationRuntimeCheck(
  input: RecordDelegationRuntimeCheckInput,
): Promise<{ checkId: string; operationalEventId: string | null }> {
  const metadata = redactGuardrailMetadata(input.metadata ?? {})
  const evidenceRefs = redactGuardrailMetadata(input.evidenceRefs ?? {})

  const operationalEventId = await emitClinicalOperationalEvent({
    supabase: input.supabase as never,
    organizationId: input.organizationId,
    studyId: input.studyId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.DELEGATION_RUNTIME_CHECKED,
    payloadSource: 'delegation-runtime',
    mutation: 'delegation_runtime.record_check',
    details: {
      procedure_key: input.procedureKey ?? null,
      check_result: input.checkResult,
      delegated: input.delegated,
      system_blocking: input.systemBlocking,
    },
  })

  const { data, error } = await input.supabase
    .from('delegation_runtime_checks')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      study_version_id: input.studyVersionId ?? null,
      actor_user_id: input.actorUserId,
      procedure_key: input.procedureKey ?? null,
      workflow_key: input.workflowKey ?? null,
      delegated: input.delegated,
      check_result: input.checkResult,
      requires_delegation: input.requiresDelegation,
      requires_pi_delegation: input.requiresPiDelegation,
      regulated: input.regulated,
      system_blocking: input.systemBlocking,
      evidence_refs: evidenceRefs,
      source_operational_event_id: operationalEventId,
      metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`recordDelegationRuntimeCheck failed: ${error.message}`)
  }

  const checkId = data.id as string

  observeDelegationRuntimeChecked({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    actorUserId: input.actorUserId,
    checkId,
    operationalEventId,
    procedureKey: input.procedureKey ?? null,
    workflowKey: input.workflowKey ?? null,
    checkResult: input.checkResult,
    delegated: input.delegated,
    systemBlocking: input.systemBlocking,
    requiresPiDelegation: input.requiresPiDelegation,
    regulated: input.regulated,
  })

  return { checkId, operationalEventId }
}
