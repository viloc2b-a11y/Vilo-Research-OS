// Shared client-side helper for protocol version selectors (reconciliation + generation).
// Pure function, no server imports.

export type AutoSelectVersion = {
  id: string
  protocolRuntimeStudyId: string
  createdAt: string
}

export type AutoSelectStudy = {
  id: string
  studyId: string | null
  currentProtocolVersionId: string | null
}

/**
 * Resolve which protocol version to auto-select:
 *  1. explicit version_id (if present in the loaded set)
 *  2. the study's current_protocol_version_id (newest pointer), else its latest version by created_at
 *  3. legacy default (first version) ONLY when no preselect hint was supplied
 * When a hint is supplied but cannot be resolved, return null so we never land on an unrelated study.
 */
export function resolveAutoSelectVersion(args: {
  allVersions: AutoSelectVersion[]
  studies: AutoSelectStudy[]
  preselectVersionId?: string | null
  preselectStudyId?: string | null
}): string | null {
  const { allVersions, studies, preselectVersionId, preselectStudyId } = args
  const versionIds = new Set(allVersions.map((v) => v.id))

  if (preselectVersionId && versionIds.has(preselectVersionId)) {
    return preselectVersionId
  }

  if (preselectStudyId) {
    const match = studies.find((s) => s.studyId === preselectStudyId)
    if (match) {
      if (match.currentProtocolVersionId && versionIds.has(match.currentProtocolVersionId)) {
        return match.currentProtocolVersionId
      }
      const latest = allVersions
        .filter((v) => v.protocolRuntimeStudyId === match.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      return latest?.id ?? null
    }
  }

  const hadHint = Boolean(preselectVersionId || preselectStudyId)
  if (hadHint) return null
  return allVersions[0]?.id ?? null
}
