import { VIPPolicyInput, VIPEnforcementLevel, VIPUIActionType } from "./vip-policy-types";

export function enforceHardStopRules(input: VIPPolicyInput, currentLevel: VIPEnforcementLevel): { level: VIPEnforcementLevel, uiAction: VIPUIActionType | null, isStrict: boolean } {
  const basis = new Set(input.basis_candidates);
  
  // Blinding Exposure
  if (input.blinding_exposure_risk === "CONFIRMED" || input.blinding_exposure_risk === "POSSIBLE") {
    return { level: "HARD_STOP", uiAction: "HARD_STOP_ACTION", isStrict: true };
  }

  // Consent Violations
  if (
    basis.has("CONSENT_AFTER_PROCEDURE") ||
    basis.has("CONSENT_MISSING") ||
    (basis.has("INFORMED_CONSENT") && input.evidence_status !== "COMPLETE")
  ) {
    return { level: "HARD_STOP", uiAction: "HARD_STOP_ACTION", isStrict: true };
  }
  if (basis.has("RECONSENT_REQUIRED")) {
    return { level: "HARD_STOP", uiAction: "BLOCK_ACTION", isStrict: true };
  }

  // Active Delegation
  if (basis.has("ACTIVE_DELEGATION") && input.evidence_status === "MISSING") {
    return { level: "HARD_STOP", uiAction: "BLOCK_ACTION", isStrict: true };
  }

  // IP Control Mismatch
  if (input.evidence_status === "PHYSICAL_RECONCILIATION_REQUIRED") {
    return { level: "HARD_STOP", uiAction: "BLOCK_ACTION", isStrict: true };
  }

  return { level: currentLevel, uiAction: null, isStrict: false };
}
