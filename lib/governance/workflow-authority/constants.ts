/**
 * GOV-1 — Centralized workflow authority constants (single source of truth).
 * Runtime, replay, and observability MUST use these values — never free-text authority names.
 */

export const WORKFLOW_AUTHORITY_LEVEL = {
  ASSISTIVE: 'assistive',
  HUMAN_REQUIRED: 'human_required',
  SYSTEM_ENFORCED: 'system_enforced',
} as const

export const WORKFLOW_AUTHORITY_LEVELS = [
  WORKFLOW_AUTHORITY_LEVEL.ASSISTIVE,
  WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
  WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
] as const

export type WorkflowAuthorityLevel = (typeof WORKFLOW_AUTHORITY_LEVELS)[number]

/** Effective authority uses the same closed enum as base (v2 evaluator may elevate only within this set). */
export const EFFECTIVE_AUTHORITY_LEVEL = WORKFLOW_AUTHORITY_LEVEL

export type EffectiveAuthorityLevel = WorkflowAuthorityLevel

export const WORKFLOW_KEY = {
  ELIGIBILITY: 'eligibility',
  RANDOMIZATION: 'randomization',
  SOURCE_SIGNING: 'source_signing',
  VISIT_LOCKING: 'visit_locking',
  AE_WORKFLOW: 'ae_workflow',
  PROTOCOL_DEVIATION: 'protocol_deviation',
  FINANCIAL_RECONCILIATION: 'financial_reconciliation',
  QUERY_MANAGEMENT: 'query_management',
  SCHEDULING: 'scheduling',
  LAB_SAFETY_ESCALATION: 'lab_safety_escalation',
  SOURCE_INTEGRITY_SNAPSHOT: 'source_integrity_snapshot',
  SOURCE_INTEGRITY_VIOLATION: 'source_integrity_violation',
  WORKFLOW_ABANDONMENT_REVIEW: 'workflow_abandonment_review',
  ROLE_CONFLICT_RESOLUTION: 'role_conflict_resolution',
} as const

export const WORKFLOW_KEYS = [
  WORKFLOW_KEY.ELIGIBILITY,
  WORKFLOW_KEY.RANDOMIZATION,
  WORKFLOW_KEY.SOURCE_SIGNING,
  WORKFLOW_KEY.VISIT_LOCKING,
  WORKFLOW_KEY.AE_WORKFLOW,
  WORKFLOW_KEY.PROTOCOL_DEVIATION,
  WORKFLOW_KEY.FINANCIAL_RECONCILIATION,
  WORKFLOW_KEY.QUERY_MANAGEMENT,
  WORKFLOW_KEY.SCHEDULING,
  WORKFLOW_KEY.LAB_SAFETY_ESCALATION,
  WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT,
  WORKFLOW_KEY.SOURCE_INTEGRITY_VIOLATION,
  WORKFLOW_KEY.WORKFLOW_ABANDONMENT_REVIEW,
  WORKFLOW_KEY.ROLE_CONFLICT_RESOLUTION,
] as const

/** GOV-1 core escalation rule_key registry (immutable once seeded in 0083). */
export const WORKFLOW_ESCALATION_RULE_KEY = {
  SEVERE_THROMBOCYTOPENIA_OR_HIT_SIGNAL: 'severe_thrombocytopenia_or_hit_signal',
  UNRESOLVED_REQUIRED_CRITERION: 'unresolved_required_criterion',
  MISSING_REQUIRED_SIGNATURE: 'missing_required_signature',
  MISSING_PREREQUISITE_EVIDENCE: 'missing_prerequisite_evidence',
  AUDIT_TRIGGERED_DISPUTE: 'audit_triggered_dispute',
  /** Phase 16A-2.6 extension (0087). */
  HASH_MISMATCH_DETECTED: 'hash_mismatch_detected',
  STALE_WORKFLOW_UNRESOLVED_PAST_ESCALATION_THRESHOLD:
    'stale_workflow_unresolved_past_escalation_threshold',
  SINGLE_STAFF_SITE_EXEMPTION: 'single_staff_site_exemption',
} as const

export const WORKFLOW_ESCALATION_RULE_KEYS = [
  WORKFLOW_ESCALATION_RULE_KEY.SEVERE_THROMBOCYTOPENIA_OR_HIT_SIGNAL,
  WORKFLOW_ESCALATION_RULE_KEY.UNRESOLVED_REQUIRED_CRITERION,
  WORKFLOW_ESCALATION_RULE_KEY.MISSING_REQUIRED_SIGNATURE,
  WORKFLOW_ESCALATION_RULE_KEY.MISSING_PREREQUISITE_EVIDENCE,
  WORKFLOW_ESCALATION_RULE_KEY.AUDIT_TRIGGERED_DISPUTE,
  WORKFLOW_ESCALATION_RULE_KEY.HASH_MISMATCH_DETECTED,
  WORKFLOW_ESCALATION_RULE_KEY.STALE_WORKFLOW_UNRESOLVED_PAST_ESCALATION_THRESHOLD,
  WORKFLOW_ESCALATION_RULE_KEY.SINGLE_STAFF_SITE_EXEMPTION,
] as const

/** GOV-1 static classification v1 — ten global seeded workflows (0083). */
export const GOV1_CORE_WORKFLOW_KEYS = [
  WORKFLOW_KEY.ELIGIBILITY,
  WORKFLOW_KEY.RANDOMIZATION,
  WORKFLOW_KEY.SOURCE_SIGNING,
  WORKFLOW_KEY.VISIT_LOCKING,
  WORKFLOW_KEY.AE_WORKFLOW,
  WORKFLOW_KEY.PROTOCOL_DEVIATION,
  WORKFLOW_KEY.FINANCIAL_RECONCILIATION,
  WORKFLOW_KEY.QUERY_MANAGEMENT,
  WORKFLOW_KEY.SCHEDULING,
  WORKFLOW_KEY.LAB_SAFETY_ESCALATION,
] as const

export type Gov1CoreWorkflowKey = (typeof GOV1_CORE_WORKFLOW_KEYS)[number]

export type WorkflowEscalationRuleKey = (typeof WORKFLOW_ESCALATION_RULE_KEYS)[number]

export type WorkflowKey = (typeof WORKFLOW_KEYS)[number]

/** @deprecated Use WORKFLOW_KEYS — retained for backward compatibility. */
export const GOV1_SEEDED_WORKFLOW_KEYS = WORKFLOW_KEYS

/** @deprecated Use WorkflowKey */
export type Gov1SeededWorkflowKey = WorkflowKey

export const WORKFLOW_CATEGORY = {
  CLINICAL: 'clinical',
  CLINICAL_SAFETY: 'clinical_safety',
  FINANCIAL: 'financial',
  DATA_QUALITY: 'data_quality',
  OPERATIONAL: 'operational',
} as const

export const WORKFLOW_CATEGORIES = [
  WORKFLOW_CATEGORY.CLINICAL,
  WORKFLOW_CATEGORY.CLINICAL_SAFETY,
  WORKFLOW_CATEGORY.FINANCIAL,
  WORKFLOW_CATEGORY.DATA_QUALITY,
  WORKFLOW_CATEGORY.OPERATIONAL,
] as const

export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number]

export const WORKFLOW_ESCALATION_CONDITION_TYPE = {
  PROTOCOL_RUNTIME_RULE: 'protocol_runtime_rule',
  LAB_RESULT_RULE: 'lab_result_rule',
  SAFETY_SIGNAL: 'safety_signal',
  SIGNATURE_STATE: 'signature_state',
  ELIGIBILITY_STATE: 'eligibility_state',
  BLINDING_RISK: 'blinding_risk',
  SOURCE_STATE: 'source_state',
  FINANCIAL_AUDIT_STATE: 'financial_audit_state',
} as const

export const WORKFLOW_ESCALATION_CONDITION_TYPES = [
  WORKFLOW_ESCALATION_CONDITION_TYPE.PROTOCOL_RUNTIME_RULE,
  WORKFLOW_ESCALATION_CONDITION_TYPE.LAB_RESULT_RULE,
  WORKFLOW_ESCALATION_CONDITION_TYPE.SAFETY_SIGNAL,
  WORKFLOW_ESCALATION_CONDITION_TYPE.SIGNATURE_STATE,
  WORKFLOW_ESCALATION_CONDITION_TYPE.ELIGIBILITY_STATE,
  WORKFLOW_ESCALATION_CONDITION_TYPE.BLINDING_RISK,
  WORKFLOW_ESCALATION_CONDITION_TYPE.SOURCE_STATE,
  WORKFLOW_ESCALATION_CONDITION_TYPE.FINANCIAL_AUDIT_STATE,
] as const

export type WorkflowEscalationConditionType =
  (typeof WORKFLOW_ESCALATION_CONDITION_TYPES)[number]

/** Registry row lifecycle — deprecate via active=false, never rename workflow_key. */
export const WORKFLOW_REGISTRY_ACTIVE = {
  ACTIVE: true,
  DEPRECATED: false,
} as const

export type WorkflowRegistryActive = (typeof WORKFLOW_REGISTRY_ACTIVE)[keyof typeof WORKFLOW_REGISTRY_ACTIVE]

export function isWorkflowAuthorityLevel(value: string): value is WorkflowAuthorityLevel {
  return (WORKFLOW_AUTHORITY_LEVELS as readonly string[]).includes(value)
}

export function isWorkflowKey(value: string): value is WorkflowKey {
  return (WORKFLOW_KEYS as readonly string[]).includes(value)
}

export function isWorkflowCategory(value: string): value is WorkflowCategory {
  return (WORKFLOW_CATEGORIES as readonly string[]).includes(value)
}

export function isWorkflowEscalationConditionType(
  value: string,
): value is WorkflowEscalationConditionType {
  return (WORKFLOW_ESCALATION_CONDITION_TYPES as readonly string[]).includes(value)
}

export function assertWorkflowKey(value: string): asserts value is WorkflowKey {
  if (!isWorkflowKey(value)) {
    throw new Error(
      `Invalid workflow_key "${value}". Use WORKFLOW_KEY enum constants; deprecate with active=false instead of renaming.`,
    )
  }
}

export function assertWorkflowAuthorityLevel(
  value: string,
): asserts value is WorkflowAuthorityLevel {
  if (!isWorkflowAuthorityLevel(value)) {
    throw new Error(
      `Invalid authority level "${value}". Use WORKFLOW_AUTHORITY_LEVEL enum — never free-text authority names.`,
    )
  }
}
