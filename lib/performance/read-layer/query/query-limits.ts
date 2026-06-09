/**
 * Query caps for the /performance fallback read path (Phase 7A signals).
 * RPC mode (VPI_USE_RPC=true) uses vpi_load_dashboard and is not capped by these limits.
 * See docs/PHASE7B-SQL-AGGREGATION.md.
 */

/** Rows fetched for visit-based risk signals (missed / OOW / window). */
export const RISK_VISITS_QUERY_LIMIT = 30

/** Rows fetched for overdue workflow actions. */
export const OVERDUE_WORKFLOW_QUERY_LIMIT = 20

/** Rows fetched for high-priority unresolved operational review queries. */
export const SNAPSHOT_QUERY_RISK_LIMIT = 25

/** Rows fetched for blocked procedure risk detail (joins). */
export const BLOCKED_PROCEDURES_RISK_LIMIT = 15

/** Rows fetched for visits whose protocol window closes today. */
export const WINDOW_CLOSING_TODAY_LIMIT = 20

/** Rows fetched for completed visits still unsigned after the operational threshold. */
export const UNSIGNED_VISITS_48H_LIMIT = 20

/** Rows fetched to build fallback owner workload when RPC mode is unavailable. */
export const COORDINATOR_LOAD_WORKFLOW_LIMIT = 200

/** Rows fetched for active governance blockers/warnings in the fallback VPI queue. */
export const GOVERNANCE_SIGNALS_RISK_LIMIT = 30

/** Rows fetched for high financial leakage in the fallback VPI queue. */
export const FINANCIAL_LEAKAGE_RISK_LIMIT = 25

/** Rows fetched for longitudinal lab runtime signals. */
export const LAB_SIGNAL_SET_LIMIT = 250
export const LAB_SIGNAL_RESPONSE_LIMIT = 1200

/** Max items shown in the subject risk queue after sort/dedupe. */
export const RISK_QUEUE_DISPLAY_LIMIT = 25

/**
 * Per-study head-count queries run in parallel for study cards.
 * Above this, cards still render but metrics stay zero with a partial warning.
 */
export const MAX_STUDIES_FOR_CARD_COUNT_QUERIES = 40

/** Known visit_status check constraint values (visits.visit_status). */
export const VISIT_STATUS_VALUES = [
  'scheduled',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'missed',
  'out_of_window',
  'locked',
] as const

export const ACTIVE_VISIT_STATUSES = ['scheduled', 'checked_in', 'in_progress'] as const

export const RISK_VISIT_STATUSES = ['missed', 'out_of_window'] as const

/** visits.source_status check constraint values. */
export const SOURCE_STATUS_VALUES = [
  'not_started',
  'draft',
  'submitted',
  'corrected',
  'signed',
] as const

/** visits.review_status check constraint values. */
export const REVIEW_STATUS_VALUES = ['pending', 'in_review', 'complete'] as const
