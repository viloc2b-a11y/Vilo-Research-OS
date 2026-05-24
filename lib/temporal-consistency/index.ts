/**
 * Phase 16A-2.5 — Temporal consistency guardrails (v0).
 */

export {
  TEMPORAL_CONSTRAINT_TYPE,
  TEMPORAL_CONSTRAINT_TYPES,
  TEMPORAL_CONSTRAINT_TYPES_V0,
  TEMPORAL_EVALUATION_RESULT,
  TEMPORAL_EVALUATION_RESULTS,
  TEMPORAL_RULE_SCOPE,
  TEMPORAL_RULE_SCOPES,
  TEMPORAL_SEEDED_RULE_KEYS,
  TEMPORAL_SEVERITY,
  TEMPORAL_SEVERITIES,
  isTemporalConstraintTypeV0Supported,
} from '@/lib/temporal-consistency/constants'

export type {
  TemporalConstraintType,
  TemporalEvaluationResult,
  TemporalRuleScope,
  TemporalSeededRuleKey,
  TemporalSeverity,
} from '@/lib/temporal-consistency/constants'

export { evaluateTemporalConsistencyRule } from '@/lib/temporal-consistency/evaluate-rule'

export { recordTemporalConsistencyEvaluation } from '@/lib/temporal-consistency/record-evaluation'
export type { RecordTemporalConsistencyEvaluationInput } from '@/lib/temporal-consistency/record-evaluation'

export {
  collectGuardrailMetadataIssues,
  redactGuardrailMetadata,
} from '@/lib/temporal-consistency/redact-metadata'

export type {
  TemporalConsistencyEvaluateInput,
  TemporalConsistencyEvaluateOutcome,
  TemporalConsistencyEvaluationInsert,
  TemporalConsistencyEvaluationRecord,
  TemporalConsistencyRule,
} from '@/lib/temporal-consistency/types'
