/**
 * Phase 3B — Run Source Engine signature validation for procedure sign flow.
 * Phase 3D — Uses resolved published template config (fallback does not enforce blockers).
 */

import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
import {
  loadFieldOptionsByFieldId,
  loadProcedureCaptureContext,
} from '@/lib/source/capture/context'
import { normalizeCaptureFields } from '@/lib/source/capture/normalize-capture-fields'
import {
  bridgeFromProcedureCaptureContext,
  resolveProcedureSourceRuntime,
  resolveSourceEngineRuntimeConfig,
  type ProcedureSourceEngineSnapshot,
} from '@/lib/source-engine/adapters/index'
import {
  formatEngineSignatureBlockMessage,
  getSignatureBlockingErrors,
} from '@/lib/source-engine/adapters/signature-gate'
import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'
import {
  logSourceEngineOperationalEvent,
  operationalContextFromCapture,
  operationalContextFromSnapshot,
  resolutionMetaFromSnapshot,
  SOURCE_ENGINE_EVENT_TYPES,
} from '@/lib/source-engine/telemetry'

export type EngineSignatureGateResult = {
  blocked: boolean
  message: string | null
  blockers: CaptureValidationError[]
  snapshot: ProcedureSourceEngineSnapshot | null
}

export async function buildProcedureEngineSnapshot(params: {
  procedureExecutionId: string
  organizationId: string
  responseSetId: string
}): Promise<ProcedureSourceEngineSnapshot | null> {
  const ctx = await loadProcedureCaptureContext(params.procedureExecutionId)
  if (!ctx) return null

  const detail = await fetchResponseSetDetail(params.responseSetId, params.organizationId)
  if (!detail.ok || !detail.data) return null

  const fieldIds = detail.data.fields.map((f) => f.source_field_id)
  const optionsByFieldId = await loadFieldOptionsByFieldId(fieldIds)
  const fields = normalizeCaptureFields(detail.data, optionsByFieldId)
  const rs = detail.data.response_set

  const runtimeConfig = await resolveSourceEngineRuntimeConfig({
    procedureExecutionId: params.procedureExecutionId,
    sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
    organizationId: params.organizationId,
    studyId: ctx.studyId,
  })

  const bridge = bridgeFromProcedureCaptureContext(
    {
      ...ctx,
      organizationId: params.organizationId,
      visitPath: `/visits/${ctx.visitId}`,
      studyPath: `/studies/${ctx.studyId}`,
      subjectPath: `/studies/${ctx.studyId}/subjects/${ctx.studySubjectId}`,
    },
    {
      isSubmitted: rs.status === 'submitted',
      canEdit:
        rs.status !== 'locked' && rs.status !== 'archived' && rs.status !== 'submitted',
      responseSetStatus: rs.status,
    },
  )

  return resolveProcedureSourceRuntime(bridge, fields, { runtimeConfig })
}

export async function checkEngineSignatureReadiness(params: {
  procedureExecutionId: string
  organizationId: string
  responseSetId: string
  actorUserId?: string | null
}): Promise<EngineSignatureGateResult> {
  const empty: EngineSignatureGateResult = {
    blocked: false,
    message: null,
    blockers: [],
    snapshot: null,
  }

  const captureCtx = await loadProcedureCaptureContext(params.procedureExecutionId)
  const operationalCtx = captureCtx
    ? operationalContextFromCapture(
        { ...captureCtx, procedureExecutionId: params.procedureExecutionId },
        params.responseSetId,
        params.actorUserId ?? null,
      )
    : null

  try {
    const snapshot = await buildProcedureEngineSnapshot(params)
    if (!snapshot) {
      if (operationalCtx) {
        void logSourceEngineOperationalEvent({
          eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_GATE_FAILED_CLOSED,
          context: operationalCtx,
          extras: {
            errorMessage: 'Engine snapshot unavailable during signature gate.',
          },
        })
      }
      return empty
    }

    const blockers = getSignatureBlockingErrors(snapshot.validationErrors ?? [])

    if (blockers.length === 0) {
      return { ...empty, snapshot }
    }

    void logSourceEngineOperationalEvent({
      eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_BLOCKED,
      context: operationalContextFromSnapshot(
        snapshot,
        params.procedureExecutionId,
        params.organizationId,
        params.responseSetId,
        params.actorUserId ?? null,
      ),
      extras: {
        ...resolutionMetaFromSnapshot(snapshot),
        blockerCount: blockers.length,
      },
    })

    return {
      blocked: true,
      message: formatEngineSignatureBlockMessage(blockers),
      blockers,
      snapshot,
    }
  } catch (error) {
    if (operationalCtx) {
      void logSourceEngineOperationalEvent({
        eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_GATE_FAILED_CLOSED,
        context: operationalCtx,
        extras: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
    }
    return empty
  }
}
