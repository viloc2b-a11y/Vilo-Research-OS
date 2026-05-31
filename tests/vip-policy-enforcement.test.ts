import { evaluateVIPPolicy } from "../lib/vip-policy/evaluate-vip-policy";
import { VIPPolicyInput } from "../lib/vip-policy/vip-policy-types";

describe("VIP Policy Enforcement Layer v2", () => {
  
  const baseInput: VIPPolicyInput = {
    pattern_id: "TEST_001",
    category: "TEST",
    signal_source: "EDC",
    severity: "MEDIUM",
    basis_candidates: ["CRITICAL_DATA_INTEGRITY"],
    is_trend_only: false,
    medical_judgment_required: false,
    financial_data_available: false,
    cta_available: false,
    evidence_status: "COMPLETE",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  };

  test("1 Consent after procedure -> HARD STOP, Cannot Override", () => {
    const input = { ...baseInput, basis_candidates: ["CONSENT_AFTER_PROCEDURE" as any] };
    const output = evaluateVIPPolicy(input);
    expect(output.enforcement_level).toBe("HARD_STOP");
    expect(output.override_policy.override_allowed).toBe(false);
  });

  test("4 Abnormal lab pending PI review -> WARNING (No Hard Stop on Medical), Require Adjudication", () => {
    const input = { ...baseInput, medical_judgment_required: true, severity: "CRITICAL" as any };
    const output = evaluateVIPPolicy(input);
    expect(output.enforcement_level).toBe("WARNING");
    expect(output.ui_actions).toContain("REQUIRE_ADJUDICATION");
    expect(output.actionability).toBe("NON_ACTIONABLE_MEDICAL_BOUNDARY");
  });

  test("5 Financial risk without CTA -> Requires CTA, Non-actionable boundary", () => {
    const output = evaluateVIPPolicy(baseInput); // CTA is false in base
    expect(output.financial_certainty).toBe("REQUIRES_CTA");
    expect(output.actionability).toBe("NON_ACTIONABLE_CONTRACTUAL_BOUNDARY");
  });

  test("6 Trend-only risk -> Never HARD STOP", () => {
    const input = { ...baseInput, severity: "HARD_STOP" as any, is_trend_only: true };
    const output = evaluateVIPPolicy(input);
    expect(output.enforcement_level).toBe("WARNING");
    expect(output.ui_actions).toContain("THROTTLE_ALERT");
  });

  test("9 Physical inventory mismatch (Conflicting Evidence)", () => {
    const input = { ...baseInput, evidence_status: "CONFLICTING" as any };
    const output = evaluateVIPPolicy(input);
    expect(output.evidence_status).toBe("PHYSICAL_RECONCILIATION_REQUIRED");
    expect(output.override_policy.override_requires_second_reviewer).toBe(true);
  });

  test("11 Blinding exposure risk -> HARD STOP", () => {
    const input = { ...baseInput, blinding_exposure_risk: "CONFIRMED" as any };
    const output = evaluateVIPPolicy(input);
    expect(output.enforcement_level).toBe("HARD_STOP");
    expect(output.override_policy.override_allowed).toBe(false);
  });

  test("14 Conflicting evidence forces physical reconciliation", () => {
    const input = { ...baseInput, evidence_status: "CONFLICTING" as any };
    const output = evaluateVIPPolicy(input);
    expect(output.required_evidence).toContain("Physical Dual Signature");
  });

});
