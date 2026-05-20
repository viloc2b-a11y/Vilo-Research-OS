/**
 * VPI — Vilo Performance Index · shared types
 *
 * Source of truth for performance scope, roles, load status, query errors,
 * and the RawSignal envelope used by lib/performance/read-layer.
 *
 * UI-specific types (StudyPerformanceCard, SubjectRiskQueueItem, etc.) keep
 * living in app/(ops)/performance/_lib/performance-types.ts until Phase 7A
 * PR3 collapses the duplication. Until then this file defines the *layer*
 * types and the legacy file defines the *view-model* types.
 *
 * See docs/PHASE7A-READ-LAYER.md §4.1.
 */

export type PerformanceRole =
  | 'coo'
  | 'pi'
  | 'coordinator'
  | 'lab'
  | 'admin'
  | 'unknown'

/**
 * Resolved scope used by every read-layer call. The aggregator never accepts
 * loose orgId/studyId pairs — it accepts a PerformanceScope.
 */
export type PerformanceScope = {
  organizationIds: string[]
  /** null = all studies visible within organizationIds. */
  studyIds: string[] | null
  /** Raw ?studyId= filter from the route; used for filter validation UI state. */
  selectedStudyId: string | null
  role: PerformanceRole
  userId: string | null
}

/** Narrowed tenant scope passed to signal queries after study list resolution. */
export type PerformanceQueryScope = {
  organizationIds: string[]
  studyIds: string[]
}

export type PerformanceLoadStatus = 'ok' | 'empty' | 'error' | 'partial'

export type PerformanceQueryError = {
  /** Stable identifier — UI banner copy keys off this. Keep snake_case. */
  source: string
  message: string
}

/**
 * Envelope every signals/*-signals.ts function returns. Signals never throw;
 * they capture the error into this envelope so the aggregator can mark the
 * model as `partial` instead of `error` whenever possible.
 */
export type RawSignal<T> = {
  source: string
  rows: T[]
  error: PerformanceQueryError | null
}
