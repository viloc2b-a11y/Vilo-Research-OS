/** Bump when projection compute semantics change (triggers rebuild). */
export const RUNTIME_PROJECTION_VERSION = 1

/** Default staleness window before optional lazy refresh (ms). */
export const PROJECTION_DEFAULT_MAX_AGE_MS = 5 * 60 * 1000

export const PROJECTION_KINDS = {
  VISIT_READINESS: 'visit_readiness',
  SUBJECT_RUNTIME: 'subject_runtime',
  STUDY_EXECUTION: 'study_execution',
  ALL: 'all',
} as const

export const PROJECTION_REFRESH_MODES = {
  TARGETED: 'targeted',
  CASCADE: 'cascade',
  REBUILD: 'rebuild',
} as const
