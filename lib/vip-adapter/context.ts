import { loadProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/load-protocol-runtime-study'
import { loadProtocolVersion } from '@/lib/protocol-intake-runtime/load-protocol-version'
import { safeLogger } from '@/lib/sanitization/safe-logger'
import type { ReadVipContextArgs, VipContextResolution, VipProtocolContext } from './types'

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export function resolveVipContext(): VipContextResolution {
  const baseUrl = normalizeBaseUrl(process.env.VIP_BASE_URL)
  const apiKey = process.env.VIP_API_KEY?.trim()

  if (!baseUrl) {
    return {
      availability: 'unavailable',
      baseUrl: null,
      hasApiKey: Boolean(apiKey),
      reason: 'VIP_BASE_URL is not configured',
    }
  }

  return {
    availability: 'available',
    baseUrl,
    hasApiKey: Boolean(apiKey),
  }
}

export async function readVipContext(args: ReadVipContextArgs): Promise<VipProtocolContext> {
  try {
    const loadedStudy = await loadProtocolRuntimeStudy(
      args.supabase,
      args.organizationId,
      args.protocolRuntimeStudyId,
    )

    if (!loadedStudy) {
      throw new Error('Protocol runtime study not found for organization_id')
    }

    if (loadedStudy.study.studyId !== args.studyId) {
      throw new Error('study_id does not match protocol runtime study linkage')
    }

    const versionId = args.protocolVersionId ?? loadedStudy.latestVersion?.id
    if (!versionId) {
      throw new Error('Protocol runtime study does not have a protocol version')
    }

    const loadedVersion = await loadProtocolVersion(args.supabase, args.organizationId, versionId)
    if (!loadedVersion) {
      throw new Error('Protocol version not found for organization_id')
    }

    if (loadedVersion.version.protocolRuntimeStudyId !== loadedStudy.study.id) {
      throw new Error('Protocol version does not belong to protocol runtime study')
    }

    return {
      organizationId: args.organizationId,
      studyId: args.studyId,
      protocolRuntimeStudy: loadedStudy.study,
      protocolVersion: loadedVersion.version,
      sections: loadedVersion.sections,
      visitCandidates: loadedVersion.visitCandidates,
      procedureCandidates: loadedVersion.procedureCandidates,
    }
  } catch (error) {
    safeLogger.error('[vip-adapter] failed to read VIP context', {
      traceId: args.traceId,
      organizationId: args.organizationId,
      studyId: args.studyId,
      protocolRuntimeStudyId: args.protocolRuntimeStudyId,
      protocolVersionId: args.protocolVersionId,
      error,
    })
    throw error
  }
}
