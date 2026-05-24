/**
 * Phase 16A-2.5 — Temporal consistency guardrail constants.
 */

export const TEMPORAL_RULE_SCOPE = {
  GLOBAL: 'global',
  STUDY_VERSION: 'study_version',
} as const

export const TEMPORAL_RULE_SCOPES = [
  TEMPORAL_RULE_SCOPE.GLOBAL,
  TEMPORAL_RULE_SCOPE.STUDY_VERSION,
] as const

export type TemporalRuleScope = (typeof TEMPORAL_RULE_SCOPES)[number]

export const TEMPORAL_CONSTRAINT_TYPE = {
  A_BEFORE_B: 'a_before_b',
  A_BEFORE_OR_EQUAL_B: 'a_before_or_equal_b',
  A_AFTER_B: 'a_after_b',
  A_AFTER_OR_EQUAL_B: 'a_after_or_equal_b',
  A_WITHIN_WINDOW_OF_B: 'a_within_window_of_b',
  A_NOT_BEFORE_B: 'a_not_before_b',
  A_NOT_AFTER_B: 'a_not_after_b',
} as const

export const TEMPORAL_CONSTRAINT_TYPES = [
  TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_B,
  TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
  TEMPORAL_CONSTRAINT_TYPE.A_AFTER_B,
  TEMPORAL_CONSTRAINT_TYPE.A_AFTER_OR_EQUAL_B,
  TEMPORAL_CONSTRAINT_TYPE.A_WITHIN_WINDOW_OF_B,
  TEMPORAL_CONSTRAINT_TYPE.A_NOT_BEFORE_B,
  TEMPORAL_CONSTRAINT_TYPE.A_NOT_AFTER_B,
] as const

export type TemporalConstraintType = (typeof TEMPORAL_CONSTRAINT_TYPES)[number]

/** v0 evaluator supports these constraint types only. */
export const TEMPORAL_CONSTRAINT_TYPES_V0 = [
  TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_B,
  TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
  TEMPORAL_CONSTRAINT_TYPE.A_AFTER_B,
  TEMPORAL_CONSTRAINT_TYPE.A_AFTER_OR_EQUAL_B,
] as const

export const TEMPORAL_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  BLOCKER: 'blocker',
} as const

export const TEMPORAL_SEVERITIES = [
  TEMPORAL_SEVERITY.INFO,
  TEMPORAL_SEVERITY.WARNING,
  TEMPORAL_SEVERITY.BLOCKER,
] as const

export type TemporalSeverity = (typeof TEMPORAL_SEVERITIES)[number]

export const TEMPORAL_EVALUATION_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  WARNING: 'warning',
  NOT_APPLICABLE: 'not_applicable',
  BLOCKED: 'blocked',
  /** Insufficient evidence (missing timestamps); audit-visible, non-blocking. */
  PENDING: 'pending',
} as const

export const TEMPORAL_EVALUATION_RESULTS = [
  TEMPORAL_EVALUATION_RESULT.PASS,
  TEMPORAL_EVALUATION_RESULT.FAIL,
  TEMPORAL_EVALUATION_RESULT.WARNING,
  TEMPORAL_EVALUATION_RESULT.NOT_APPLICABLE,
  TEMPORAL_EVALUATION_RESULT.BLOCKED,
  TEMPORAL_EVALUATION_RESULT.PENDING,
] as const

export type TemporalEvaluationResult = (typeof TEMPORAL_EVALUATION_RESULTS)[number]

export const TEMPORAL_SEEDED_RULE_KEYS = [
  'consent_before_screening',
  'screening_before_enrollment',
  'ae_onset_not_before_first_dose',
  'lab_collection_before_lab_result',
  'source_signature_after_capture',
] as const

export type TemporalSeededRuleKey = (typeof TEMPORAL_SEEDED_RULE_KEYS)[number]

export function isTemporalConstraintTypeV0Supported(
  value: TemporalConstraintType,
): boolean {
  return (TEMPORAL_CONSTRAINT_TYPES_V0 as readonly string[]).includes(value)
}
