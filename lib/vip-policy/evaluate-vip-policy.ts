import {
  VIPPolicyInput,
  VIPPolicyOutput,
  VIPPolicyBasis,
  VIPOverridePolicy,
  VIPEnforcementLevel,
  VIPUIActionType,
  VIPActionability,
  VIPAuthorityBoundary,
  VIPFinancialCertainty,
  VIPEscalationTarget
} from "./vip-policy-types";

import { enforceAuthorityBoundary } from "./authority-boundary-policy";
import { enforceFinancialCertainty } from "./financial-certainty-policy";
import { enforceHardStopRules } from "./hard-stop-policy";

export function evaluateVIPPolicy(input: VIPPolicyInput): VIPPolicyOutput {
  // 1. Initial State
  let enforcement_level: VIPEnforcementLevel =
    input.severity === "HARD_STOP" || input.severity === "CRITICAL"
      ? "HARD_STOP"
      : input.severity === "HIGH"
        ? "WARNING"
        : "ADVISORY";
  let ui_actions: VIPUIActionType[] = [];
  let actionability: VIPActionability = "ACTIONABLE";
  const override_policy: VIPOverridePolicy = {
    override_allowed: true,
    override_roles_allowed: ["PI", "SITE_DIRECTOR", "CRC"],
    override_requires_reason: true,
    override_requires_signature: false,
    override_requires_second_reviewer: false,
    override_expires_after_hours: null
  };

  const basis = new Set<VIPPolicyBasis>(input.basis_candidates);

  // 2. Precedence 1: Medical Authority Boundary
  const authBoundary = enforceAuthorityBoundary(input);
  if (authBoundary !== "SITE_CAN_ACT") {
    if (authBoundary === "REQUIRE_PI_REVIEW" || authBoundary === "HUMAN_REVIEW_REQUIRED") {
      enforcement_level = "WARNING"; // Never Hard Stop if medical judgment is pending
      ui_actions.push("REQUIRE_ADJUDICATION");
      actionability = "NON_ACTIONABLE_MEDICAL_BOUNDARY";
      override_policy.override_allowed = false; // CRC cannot override
    }
  }

  // 3. Precedence 2: Hard Stop Enforcements (Consent, IP, Safety, Blinding)
  const hardStopEvaluation = enforceHardStopRules(input, enforcement_level);
  enforcement_level = hardStopEvaluation.level;
  if (hardStopEvaluation.uiAction) {
    ui_actions.push(hardStopEvaluation.uiAction);
  }
  if (hardStopEvaluation.isStrict) {
    override_policy.override_allowed = false;
  }

  // 4. Precedence 3: Financial Certainty
  const financialEval = enforceFinancialCertainty(input);
  if (financialEval === "UNKNOWN" || financialEval === "REQUIRES_CTA" || financialEval === "REQUIRES_CLINIQ") {
    if (actionability === "ACTIONABLE") {
      actionability = "NON_ACTIONABLE_CONTRACTUAL_BOUNDARY";
    }
  }

  // 5. Precedence 4: Evidence Conflicts
  let evidence_status = input.evidence_status;
  if (evidence_status === "CONFLICTING") {
    evidence_status = "PHYSICAL_RECONCILIATION_REQUIRED";
    ui_actions.push("BLOCK_ACTION");
    override_policy.override_requires_second_reviewer = true;
    override_policy.override_requires_signature = true;
  }

  // 6. Precedence 5: Trend signals
  if (input.is_trend_only) {
    if (enforcement_level === "HARD_STOP") {
      enforcement_level = "WARNING"; // Trends cannot generate hard stops
    } else if (enforcement_level === "ADVISORY") {
      enforcement_level = "WARNING";
    }
    ui_actions.push("THROTTLE_ALERT");
  }

  // 7. Non-Blocking Rule: Downgrade unapproved hard stops
  const ALLOWED_HARD_STOP_BASES: VIPPolicyBasis[] = [
    "INFORMED_CONSENT",
    "CONSENT_AFTER_PROCEDURE",
    "CONSENT_MISSING",
    "RECONSENT_REQUIRED",
    "ELIGIBILITY",
    "INVESTIGATIONAL_PRODUCT_CONTROL",
    "ACTIVE_DELEGATION",
    "BLINDING_PROTECTION"
  ];
  
  const hasAllowedHardStopBasis =
    input.blinding_exposure_risk !== "NONE" ||
    Array.from(basis).some(b => ALLOWED_HARD_STOP_BASES.includes(b));
  
  if (!hasAllowedHardStopBasis) {
    if (enforcement_level === "HARD_STOP") {
      enforcement_level = "WARNING";
    }
    // Remove blocking UI actions
    ui_actions = ui_actions.filter(a => a !== "BLOCK_ACTION" && a !== "HARD_STOP_ACTION");
    // Default to HUMAN_REVIEW_REQUIRED if it was supposed to be a hard stop
    if (input.severity === "HARD_STOP" && !ui_actions.includes("REQUIRE_ADJUDICATION")) {
      ui_actions.push("REQUIRE_ADJUDICATION");
    }
  }

  // Escalation Routing
  let escalation: VIPEscalationTarget = "CRC";
  let slaHours = 72;
  if (basis.has("SUBJECT_SAFETY") || basis.has("INFORMED_CONSENT")) {
    escalation = "PI";
    slaHours = 24;
  }
  if (basis.has("CONSENT_MISSING") || basis.has("CONSENT_AFTER_PROCEDURE")) {
    escalation = "PI";
    slaHours = 0; // Immediate
  }

  return {
    severity: input.severity,
    policy_basis: Array.from(basis),
    enforcement_level,
    authority_boundary: authBoundary,
    actionability,
    signal_source: input.signal_source,
    evidence_status,
    ui_actions,
    required_evidence: evidence_status === "PHYSICAL_RECONCILIATION_REQUIRED" ? ["Physical Dual Signature"] : [],
    allowed_actions: ["Review", "Escalate"],
    forbidden_actions: enforcement_level === "HARD_STOP" ? ["Save", "Finalize"] : [],
    override_policy,
    audit_log_fields: { input_pattern: input.pattern_id, execution_mode: "POLICY_ENFORCED" },
    financial_certainty: financialEval,
    escalation_target: escalation,
    escalation_due_within_hours: slaHours,
    confidence_band: input.is_trend_only ? "MEDIUM" : "HIGH",
    policy_version: "2.0.0",
    pattern_version: "1.0.0",
    evaluation_timestamp: new Date().toISOString(),
    engine_version: "VILO_OS_RUNTIME_v1",
    reason: "Policy evaluated via VIP Decision Precedence.",
    uncertainty_note: actionability.startsWith("NON_ACTIONABLE") ? "Blocked by external dependency or medical boundary." : "None"
  };
}
