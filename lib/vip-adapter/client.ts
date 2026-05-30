import { safeLogger } from '@/lib/sanitization/safe-logger'
import { readVipContext as readProtocolVipContext, resolveVipContext } from './context'
import type {
  CaptureVipFeedbackArgs,
  CaptureVipFeedbackResult,
  GenerateVipDraftArgs,
  GenerateVipDraftResult,
  ReadVipContextArgs,
  VipDraftArtifact,
  VipProtocolContext,
  VipUseCase,
} from './types'

const VIP_TIMEOUT_MS = 15000
const VIP_MAX_ATTEMPTS = 2

function createTraceId() {
  return `vip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function screeningVisitName(context: VipProtocolContext) {
  return (
    context.visitCandidates.find((visit) => /screen/i.test(visit.visitName))?.visitName ??
    'Screening Visit'
  )
}

function fallbackDraft(context: VipProtocolContext, traceId: string): VipDraftArtifact {
  const screeningVisit = context.visitCandidates.find((visit) => /screen/i.test(visit.visitName))
  const screeningProcedureNames = context.procedureCandidates
    .filter((procedure) => !screeningVisit || procedure.visitCandidateId === screeningVisit.id)
    .map((procedure) => procedure.procedureName)

  const procedureNames =
    screeningProcedureNames.length > 0
      ? screeningProcedureNames
      : context.procedureCandidates.slice(0, 8).map((procedure) => procedure.procedureName)

  const procedureFields = procedureNames.map((procedureName) => ({
    label: procedureName,
    type: 'checkbox' as const,
    required: true,
    source: 'protocol_runtime_procedure_candidates',
  }))

  return {
    artifact_type: 'screening_visit_source_draft',
    organization_id: context.organizationId,
    study_id: context.studyId,
    protocol_runtime_study_id: context.protocolRuntimeStudy.id,
    protocol_version_id: context.protocolVersion.id,
    trace_id: traceId,
    generated_by: 'vilo_controlled_fallback',
    generated_at: new Date().toISOString(),
    title: `${context.protocolRuntimeStudy.protocolNumber} Screening Visit Source Draft`,
    source_document: {
      visit_name: screeningVisitName(context),
      sections: [
        {
          title: 'Visit identifiers',
          fields: [
            {
              label: 'Subject ID',
              type: 'text',
              required: true,
              source: 'vilo_controlled_fallback',
            },
            {
              label: 'Screening date',
              type: 'date',
              required: true,
              source: 'vilo_controlled_fallback',
            },
            {
              label: 'Visit performed',
              type: 'checkbox',
              required: true,
              source: 'vilo_controlled_fallback',
            },
          ],
        },
        {
          title: 'Protocol-required screening procedures',
          fields:
            procedureFields.length > 0
              ? procedureFields
              : [
                  {
                    label: 'Screening procedures completed per protocol',
                    type: 'checkbox',
                    required: true,
                    source: 'vilo_controlled_fallback',
                  },
                ],
        },
        {
          title: 'Investigator review',
          fields: [
            {
              label: 'Eligibility criteria reviewed',
              type: 'checkbox',
              required: true,
              source: 'vilo_controlled_fallback',
            },
            {
              label: 'Investigator signature date',
              type: 'date',
              required: true,
              source: 'vilo_controlled_fallback',
            },
          ],
        },
      ],
    },
    metadata: {
      fallback_reason: 'VIP unavailable or failed; generated from protocol intake candidates only',
      section_count: context.sections.length,
      visit_candidate_count: context.visitCandidates.length,
      procedure_candidate_count: context.procedureCandidates.length,
    },
  }
}

function normalizeVipArtifact(
  value: unknown,
  context: VipProtocolContext,
  traceId: string,
): VipDraftArtifact {
  const candidate = value as Partial<VipDraftArtifact> | null
  if (!candidate || typeof candidate !== 'object' || !candidate.source_document) {
    throw new Error('VIP response did not include a draft source document artifact')
  }

  return {
    ...candidate,
    artifact_type: 'screening_visit_source_draft',
    organization_id: context.organizationId,
    study_id: context.studyId,
    protocol_runtime_study_id: context.protocolRuntimeStudy.id,
    protocol_version_id: context.protocolVersion.id,
    trace_id: traceId,
    generated_by: 'vip',
    generated_at: candidate.generated_at ?? new Date().toISOString(),
    title:
      candidate.title ??
      `${context.protocolRuntimeStudy.protocolNumber} Screening Visit Source Draft`,
    source_document: candidate.source_document,
    metadata: {
      ...(candidate.metadata ?? {}),
      vip_external: true,
    },
  }
}

async function fetchWithRetry(args: {
  url: string
  init: RequestInit
  traceId: string
  operation: 'generateDraft' | 'captureFeedback'
  organizationId: string
  studyId: string
}) {
  let lastError: unknown

  for (let attempt = 1; attempt <= VIP_MAX_ATTEMPTS; attempt += 1) {
    try {
      safeLogger.info('[vip-adapter] VIP HTTP request started', {
        traceId: args.traceId,
        operation: args.operation,
        organizationId: args.organizationId,
        studyId: args.studyId,
        attempt,
      })

      const response = await fetch(args.url, {
        ...args.init,
        signal: AbortSignal.timeout(VIP_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`VIP ${args.operation} request failed with HTTP ${response.status}`)
      }

      safeLogger.info('[vip-adapter] VIP HTTP request completed', {
        traceId: args.traceId,
        operation: args.operation,
        organizationId: args.organizationId,
        studyId: args.studyId,
        attempt,
      })
      return response
    } catch (error) {
      lastError = error
      safeLogger.error('[vip-adapter] VIP HTTP request failed', {
        traceId: args.traceId,
        operation: args.operation,
        organizationId: args.organizationId,
        studyId: args.studyId,
        attempt,
        willRetry: attempt < VIP_MAX_ATTEMPTS,
        error,
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`VIP ${args.operation} request failed`)
}

function vipHeaders(apiKey?: string): HeadersInit {
  return {
    'content-type': 'application/json',
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  }
}

export function createVipClient() {
  const vip = resolveVipContext()
  const apiKey = process.env.VIP_API_KEY?.trim()

  return {
    context: vip,

    async readContext(args: ReadVipContextArgs) {
      return readContext(args)
    },

    async generateDraft(args: GenerateVipDraftArgs) {
      return generateDraft(args)
    },

    async captureFeedback(args: CaptureVipFeedbackArgs) {
      return captureFeedback(args)
    },

    async requestDraft(args: {
      context: VipProtocolContext
      traceId: string
      useCase: VipUseCase
    }) {
      if (vip.availability !== 'available' || !vip.baseUrl) {
        throw new Error(vip.reason ?? 'VIP is unavailable')
      }

      const response = await fetchWithRetry({
        url: `${vip.baseUrl}/drafts/source-documents`,
        traceId: args.traceId,
        operation: 'generateDraft',
        organizationId: args.context.organizationId,
        studyId: args.context.studyId,
        init: {
          method: 'POST',
          headers: vipHeaders(apiKey),
          body: JSON.stringify({
            use_case: args.useCase,
            trace_id: args.traceId,
            organization_id: args.context.organizationId,
            study_id: args.context.studyId,
            protocol_runtime_study: args.context.protocolRuntimeStudy,
            protocol_version: args.context.protocolVersion,
            sections: args.context.sections,
            visit_candidates: args.context.visitCandidates,
            procedure_candidates: args.context.procedureCandidates,
            output: {
              artifact_type: 'screening_visit_source_draft',
            },
          }),
        },
      })

      return response.json()
    },

    async requestFeedback(args: CaptureVipFeedbackArgs) {
      if (vip.availability !== 'available' || !vip.baseUrl) {
        throw new Error(vip.reason ?? 'VIP is unavailable')
      }

      const response = await fetchWithRetry({
        url: `${vip.baseUrl}/drafts/source-documents/feedback`,
        traceId: args.traceId,
        operation: 'captureFeedback',
        organizationId: args.organizationId,
        studyId: args.studyId,
        init: {
          method: 'POST',
          headers: vipHeaders(apiKey),
          body: JSON.stringify({
            organization_id: args.organizationId,
            study_id: args.studyId,
            trace_id: args.traceId,
            artifact_id: args.artifactId ?? null,
            feedback: args.feedback,
          }),
        },
      })

      return response.json().catch(() => ({}))
    },
  }
}

export async function readContext(args: ReadVipContextArgs): Promise<VipProtocolContext> {
  safeLogger.info('[vip-adapter] reading VIP context', {
    traceId: args.traceId,
    organizationId: args.organizationId,
    studyId: args.studyId,
    protocolRuntimeStudyId: args.protocolRuntimeStudyId,
    protocolVersionId: args.protocolVersionId,
  })
  return readProtocolVipContext(args)
}

export async function generateDraft(args: GenerateVipDraftArgs): Promise<GenerateVipDraftResult> {
  const traceId = args.traceId ?? createTraceId()
  const useCase = args.useCase ?? 'protocol_intake.screening_visit_source_draft'
  const client = createVipClient()
  const context = await readContext({ ...args, traceId })

  if (client.context.availability === 'available') {
    try {
      const vipResponse = await client.requestDraft({ context, traceId, useCase })
      return {
        ok: true,
        traceId,
        vip: client.context,
        artifact: normalizeVipArtifact(vipResponse.artifact ?? vipResponse, context, traceId),
        fallback: false,
      }
    } catch (error) {
      safeLogger.error('[vip-adapter] VIP draft generation failed; using fallback', {
        traceId,
        organizationId: args.organizationId,
        studyId: args.studyId,
        protocolRuntimeStudyId: args.protocolRuntimeStudyId,
        protocolVersionId: args.protocolVersionId,
        error,
      })
    }
  } else {
    safeLogger.warn('[vip-adapter] VIP unavailable; using fallback', {
      traceId,
      organizationId: args.organizationId,
      studyId: args.studyId,
      reason: client.context.reason,
    })
  }

  const artifact = fallbackDraft(context, traceId)
  safeLogger.info('[vip-adapter] fallback draft generated', {
    traceId,
    organizationId: args.organizationId,
    studyId: args.studyId,
    protocolRuntimeStudyId: args.protocolRuntimeStudyId,
  })

  return {
    ok: true,
    traceId,
    vip: client.context,
    artifact,
    fallback: true,
  }
}

export async function captureFeedback(
  args: CaptureVipFeedbackArgs,
): Promise<CaptureVipFeedbackResult> {
  const client = createVipClient()

  if (client.context.availability !== 'available') {
    safeLogger.warn('[vip-adapter] VIP feedback captured locally only; VIP unavailable', {
      traceId: args.traceId,
      organizationId: args.organizationId,
      studyId: args.studyId,
      reason: client.context.reason,
      disposition: args.feedback.disposition,
    })
    return {
      ok: true,
      traceId: args.traceId,
      capturedBy: 'vilo_log_only',
      reason: client.context.reason,
    }
  }

  try {
    await client.requestFeedback(args)
    return {
      ok: true,
      traceId: args.traceId,
      capturedBy: 'vip',
    }
  } catch (error) {
    safeLogger.error('[vip-adapter] failed to send VIP feedback', {
      traceId: args.traceId,
      organizationId: args.organizationId,
      studyId: args.studyId,
      artifactId: args.artifactId,
      disposition: args.feedback.disposition,
      error,
    })
    return {
      ok: false,
      traceId: args.traceId,
      capturedBy: 'vilo_log_only',
      reason: error instanceof Error ? error.message : 'VIP feedback capture failed',
    }
  }
}
