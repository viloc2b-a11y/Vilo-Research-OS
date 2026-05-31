import { ExecutionGuardInput, ExecutionGuardOutput, ProtectedActionType } from "./execution-guard-types";
import { VIPPolicyBasis } from "../vip-policy/vip-policy-types";

const ALLOWED_HARD_STOP_BASES: VIPPolicyBasis[] = [
  "INFORMED_CONSENT",
  "CONSENT_AFTER_PROCEDURE",
  "CONSENT_MISSING",
  "ELIGIBILITY",
  "INVESTIGATIONAL_PRODUCT_CONTROL",
  "ACTIVE_DELEGATION",
  "BLINDING_PROTECTION"
];

const REQUIRES_PI_ACTIONS: ProtectedActionType[] = ["RANDOMIZE_SUBJECT", "FINALIZE_VISIT", "DISPENSE_IP"];

export function evaluateExecutionGuard(input: ExecutionGuardInput): ExecutionGuardOutput {
  if (!input.vip_policy_outputs || input.vip_policy_outputs.length === 0) {
    return {
      allowed: true,
      enforcement_level: "NONE",
      blocking_reasons: ["Warning: No policy evidence evaluated"],
      required_actions: [],
      authority_boundary: "SITE_CAN_ACT",
      override_allowed: true,
      override_roles_allowed: [],
      audit_required: true,
      policy_outputs_used: []
    };
  }

  let finalAllowed = true;
  let finalEnforcementLevel: ExecutionGuardOutput["enforcement_level"] = "NONE";
  const blockingReasons: string[] = [];
  const requiredActions: string[] = [];
  let finalAuthBoundary: ExecutionGuardOutput["authority_boundary"] = "SITE_CAN_ACT";
  let finalOverrideAllowed = true;
  let finalOverrideRoles: string[] = [];

  for (const policy of input.vip_policy_outputs) {
    const policyBasis = policy.policy_basis ?? [];
    const uiActions = policy.ui_actions ?? [];
    const overridePolicy = policy.override_policy ?? {
      override_allowed: false,
      override_roles_allowed: [],
    };
    // Check if the policy has an allowed hard stop basis
    const hasAllowedBasis = policyBasis.some(b => ALLOWED_HARD_STOP_BASES.includes(b as VIPPolicyBasis));
    const isProtectedAction = REQUIRES_PI_ACTIONS.includes(input.action_type);
    const isFailSafeReviewBoundary =
      policy.authority_boundary === "REQUIRE_PI_REVIEW" ||
      policy.authority_boundary === "HUMAN_REVIEW_REQUIRED";

    // 1. HARD_STOP blocks action.
    if (policy.enforcement_level === "HARD_STOP" && (hasAllowedBasis || isFailSafeReviewBoundary) && isProtectedAction) {
      finalAllowed = false;
      finalEnforcementLevel = "HARD_STOP";
      blockingReasons.push(`Blocked by HARD_STOP on basis: ${policyBasis.join(", ")}`);
      finalOverrideAllowed = false;
    }

    // 2. BLOCK action unless override_allowed = true and actor role is allowed.
    if (uiActions.includes("BLOCK_ACTION") && hasAllowedBasis) {
      if (overridePolicy.override_allowed) {
        if (!overridePolicy.override_roles_allowed.includes(input.actor_role)) {
          finalAllowed = false;
          finalEnforcementLevel = policy.enforcement_level;
          blockingReasons.push(`Blocked: Role ${input.actor_role} not authorized for override.`);
        } else if (!input.is_override_attempt) {
          finalAllowed = false;
          finalEnforcementLevel = policy.enforcement_level;
          blockingReasons.push(`Blocked: Override required but not attempted.`);
        }
        finalOverrideAllowed = true;
        finalOverrideRoles = [...new Set([...finalOverrideRoles, ...overridePolicy.override_roles_allowed])];
      } else {
        finalAllowed = false;
        finalEnforcementLevel = "HARD_STOP";
        blockingReasons.push(`Blocked: Strict BLOCK_ACTION with no override allowed.`);
        finalOverrideAllowed = false;
      }
    }

    // 3. HUMAN_REVIEW_REQUIRED blocks only if required authority has not completed review
    if (uiActions.includes("REQUIRE_ADJUDICATION")) {
      if (isProtectedAction && policy.authority_boundary === "REQUIRE_PI_REVIEW") {
        finalAllowed = false;
        finalEnforcementLevel = policy.enforcement_level;
        blockingReasons.push("Blocked: Pending PI Adjudication required before this action.");
        finalAuthBoundary = "REQUIRE_PI_REVIEW";
      }
    }
  }

  return {
    allowed: finalAllowed,
    enforcement_level: finalEnforcementLevel,
    blocking_reasons: blockingReasons,
    required_actions: requiredActions,
    authority_boundary: finalAuthBoundary,
    override_allowed: finalOverrideAllowed,
    override_roles_allowed: finalOverrideRoles,
    audit_required: true,
    policy_outputs_used: input.vip_policy_outputs.map(p => "used_policy")
  };
}
