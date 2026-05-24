/**
 * OBS-2 — ClinicalMutationGateway emission hook.
 */

import type { ClinicalMutationEmitInput } from '@/lib/operations/clinical-mutation-gateway'
import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { resolveWorkflowKeyForClinicalMutation } from '@/lib/observability/resolve-clinical-mutation-workflow'
import { recordRuntimeTrace } from '@/lib/observability/record-runtime-trace'
import { RUNTIME_TRACE_STATUS, RUNTIME_TRACE_TYPE } from '@/lib/observability/constants'
import { safeObserve } from '@/lib/observability/safe-observe'
import { getObsWorkflowAuthorityDefault } from '@/lib/observability/workflow-authority-defaults'

export function observeClinicalMutationEmitted(
  input: ClinicalMutationEmitInput & { sourceOperationalEventId?: string | null; failed?: boolean },
): void {
  safeObserve('clinical-mutation-emitted', async () => {
    const workflowKey = resolveWorkflowKeyForClinicalMutation({
      mutation: input.mutation,
      eventType: String(input.eventType),
    })
    const authority = workflowKey ? getObsWorkflowAuthorityDefault(workflowKey) : null

    await recordRuntimeTrace({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId: input.subjectId ?? null,
      visitId: input.visitId ?? null,
      procedureExecutionId: input.procedureExecutionId ?? null,
      traceType: RUNTIME_TRACE_TYPE.MUTATION_GATEWAY,
      status: input.failed ? RUNTIME_TRACE_STATUS.FAILED : RUNTIME_TRACE_STATUS.COMPLETED,
      actorUserId: input.actorUserId,
      sourceOperationalEventId: input.sourceOperationalEventId ?? null,
      workflowKey: authority?.workflowKey ?? null,
      baseAuthorityLevel: authority?.baseAuthorityLevel ?? null,
      effectiveAuthorityLevel: authority?.effectiveAuthorityLevel ?? null,
      metadata: {
        signal: OBS_HOOK_SIGNAL.CLINICAL_MUTATION_EMITTED,
        event_type: input.eventType,
        mutation: input.mutation,
        payload_source: input.payloadSource,
      },
      endedAt: new Date().toISOString(),
    })
  })
}
