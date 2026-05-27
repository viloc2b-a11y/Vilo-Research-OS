/**
 * K1 scope model: one organization + exactly one selected study per operation.
 * Cross-study / portfolio search is intentionally not implemented in K1.
 */

export const DOCUMENT_INTELLIGENCE_K1_SCOPE_MODE = 'single_study' as const

export type DocumentIntelligenceK1ScopeMode = typeof DOCUMENT_INTELLIGENCE_K1_SCOPE_MODE

/** Active scope for list, search, ingest, and detail in K1. */
export type DocumentIntelligenceStudyScope = {
  organizationId: string
  studyId: string
  mode: DocumentIntelligenceK1ScopeMode
}

/**
 * Reserved for a future release — not wired in K1.
 * Portfolio or multi-study search would require separate RPCs, auth, and UI.
 */
export type DocumentIntelligenceFutureScopeMode = 'cross_study_portfolio'

export type DocumentIntelligenceFutureScope = {
  organizationId: string
  studyIds: string[]
  mode: DocumentIntelligenceFutureScopeMode
}

export function assertK1SingleStudyScope(
  studyId: string | null | undefined,
): asserts studyId is string {
  if (!studyId?.trim()) {
    throw new Error(
      'study_id is required. K1 supports one selected study at a time; cross-study search is not available.',
    )
  }
}

export function createK1StudyScope(
  organizationId: string,
  studyId: string,
): DocumentIntelligenceStudyScope {
  assertK1SingleStudyScope(studyId)
  return {
    organizationId,
    studyId: studyId.trim(),
    mode: DOCUMENT_INTELLIGENCE_K1_SCOPE_MODE,
  }
}
