export const RUNTIME_INTEGRITY_VERSION = 1

/** Default projection staleness threshold (matches Phase 2 lazy refresh). */
export const DEFAULT_PROJECTION_MAX_AGE_MS = 5 * 60 * 1000

/** Window around a mutation to search for spine emission hints (static audit). */
export const EMISSION_PROXIMITY_CHARS = 2500

export const CANONICAL_EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]*$/
