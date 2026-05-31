export type VIPPolicyBasis =
  | "SUBJECT_SAFETY"
  | "INFORMED_CONSENT"
  | "ELIGIBILITY"
  | "CRITICAL_DATA_INTEGRITY"
  | "INVESTIGATIONAL_PRODUCT_CONTROL"
  | "PI_OVERSIGHT"
  | "ACTIVE_DELEGATION"
  | "ACCOUNTABILITY"
  | "BLINDING_PROTECTION"
  | "MEDICAL_AUTHORITY_BOUNDARY"
  | "FINANCIAL_UNCERTAINTY_BOUNDARY"
  | "EXTERNAL_SYSTEM_LIMITATION"
  | "AUDIT_READINESS"
  | "REGULATORY_DOCUMENTATION"
  | "BIOSPECIMEN_INTEGRITY"
  | "MONITORING_RISK"
  | "QUERY_RISK"
  | "FINDING_RISK"
  | "DEVIATION_RISK"
  | "CONSENT_MISSING"
  | "CONSENT_AFTER_PROCEDURE"
  | "CONSENT_VERSION_MISMATCH"
  | "RECONSENT_REQUIRED"
  | "TRANSLATION_OR_COMPREHENSION_RISK";

export type VIPAuthorityBoundary =
  | "SITE_CAN_ACT"
  | "PI_REQUIRED"
  | "MEDICAL_MONITOR_REQUIRED"
  | "SPONSOR_REQUIRED"
  | "CRA_REQUIRED"
  | "CENTRAL_LAB_REQUIRED"
  | "CLINIQ_REQUIRED"
  | "CTA_REQUIRED"
  | "EXTERNAL_EDC_REQUIRED"
  | "REQUIRE_PI_REVIEW"
  | "REQUIRE_SPONSOR_ESCALATION"
  | "REQUIRE_MEDICAL_MONITOR_REVIEW"
  | "HUMAN_REVIEW_REQUIRED";

export type VIPEvidenceStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "MISSING"
  | "CONFLICTING"
  | "PHYSICAL_RECONCILIATION_REQUIRED";

export type VIPSignalSource =
  | "EDC"
  | "SOURCE_DOC"
  | "ISF_ETMF"
  | "PHARMACY_LOG"
  | "LAB_PORTAL"
  | "MANUAL_ENTRY"
  | "TREND_ENGINE"
  | "EXTERNAL_ADAPTER"
  | "RUNTIME_EVENT";

export type VIPActionability =
  | "ACTIONABLE"
  | "ACTIONABLE_WITH_HUMAN"
  | "NON_ACTIONABLE_EXTERNAL_DEPENDENCY"
  | "NON_ACTIONABLE_MEDICAL_BOUNDARY"
  | "NON_ACTIONABLE_CONTRACTUAL_BOUNDARY";

export type VIPFinancialCertainty =
  | "KNOWN"
  | "ESTIMATED"
  | "UNKNOWN"
  | "REQUIRES_CTA"
  | "REQUIRES_CLINIQ";

export type VIPSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "HARD_STOP";

export type VIPEnforcementLevel = "ADVISORY" | "WARNING" | "HARD_STOP";

export type VIPUIActionType = "BLOCK_ACTION" | "HARD_STOP_ACTION" | "RENDER_BANNER" | "THROTTLE_ALERT" | "REQUIRE_ADJUDICATION";

export type VIPEscalationTarget = "CRC" | "PI" | "SITE_DIRECTOR" | "CRA" | "MEDICAL_MONITOR" | "SPONSOR";

export type VIPConfidenceBand = "LOW" | "MEDIUM" | "HIGH" | "EXPERT";

export type BlindingRisk = "NONE" | "POSSIBLE" | "CONFIRMED";

export interface VIPDecisionPrecedence {
  priority: number; // 1 to 12
  rule_name: string;
}

export interface VIPOverridePolicy {
  override_allowed: boolean;
  override_roles_allowed: string[];
  override_requires_reason: boolean;
  override_requires_signature: boolean;
  override_requires_second_reviewer: boolean;
  override_expires_after_hours: number | null;
}

export interface VIPPolicyInput {
  pattern_id: string;
  category: string;
  signal_source: VIPSignalSource;
  severity: VIPSeverity;
  basis_candidates: VIPPolicyBasis[];
  is_trend_only: boolean;
  medical_judgment_required: boolean;
  financial_data_available: boolean;
  cta_available: boolean;
  evidence_status: VIPEvidenceStatus;
  user_role: string;
  blinding_exposure_risk: BlindingRisk;
}

export interface VIPPolicyOutput {
  severity: VIPSeverity;
  policy_basis: VIPPolicyBasis[];
  enforcement_level: VIPEnforcementLevel;
  authority_boundary: VIPAuthorityBoundary;
  actionability: VIPActionability;
  signal_source: VIPSignalSource;
  evidence_status: VIPEvidenceStatus;
  ui_actions: VIPUIActionType[];
  required_evidence: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  override_policy: VIPOverridePolicy;
  audit_log_fields: Record<string, string>;
  financial_certainty: VIPFinancialCertainty;
  escalation_target: VIPEscalationTarget;
  escalation_due_within_hours: number;
  confidence_band: VIPConfidenceBand;
  policy_version: string;
  pattern_version: string;
  evaluation_timestamp: string;
  engine_version: string;
  reason: string;
  uncertainty_note: string;
}

export interface VIPPolicyEvaluation {
  input: VIPPolicyInput;
  output: VIPPolicyOutput;
  is_compliant: boolean;
}
