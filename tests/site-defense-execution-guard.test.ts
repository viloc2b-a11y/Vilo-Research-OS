import { evaluateExecutionGuard } from "../lib/site-defense/evaluate-execution-guard";
import { mockPolicyOutputs } from "../lib/site-defense/mock-protected-actions";
import { ExecutionGuardInput } from "../lib/site-defense/execution-guard-types";

describe("Targeted Execution Guard", () => {
  const baseInput: ExecutionGuardInput = {
    study_id: "S001",
    subject_id: "SUBJ001",
    action_type: "RANDOMIZE_SUBJECT",
    actor_id: "user_1",
    actor_role: "CRC",
    is_override_attempt: false,
    vip_policy_outputs: []
  };

  test("1. Randomize with missing consent -> blocked", () => {
    const input = { ...baseInput, vip_policy_outputs: [mockPolicyOutputs.MISSING_CONSENT] };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(false);
    expect(result.enforcement_level).toBe("HARD_STOP");
    expect(result.override_allowed).toBe(false);
  });

  test("3. Dispense quarantined IP -> blocked (requires override)", () => {
    const input = { ...baseInput, action_type: "DISPENSE_IP" as any, vip_policy_outputs: [mockPolicyOutputs.IP_QUARANTINE_BLOCK] };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(false);
    expect(result.override_allowed).toBe(true);
    expect(result.override_roles_allowed).toContain("PHARMACIST");
  });

  test("6. Query aging warning (Trend-only) -> allowed", () => {
    const input = { ...baseInput, vip_policy_outputs: [mockPolicyOutputs.TREND_ONLY] };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(true);
    expect(result.blocking_reasons).toHaveLength(0);
  });

  test("9. Abnormal lab pending PI CS/NCS -> block if action requires PI adjudication", () => {
    // Randomization requires PI adjudication
    const input = { ...baseInput, action_type: "RANDOMIZE_SUBJECT" as any, vip_policy_outputs: [mockPolicyOutputs.PENDING_PI_ADJUDICATION] };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(false);
    expect(result.authority_boundary).toBe("REQUIRE_PI_REVIEW");
  });

  test("10. BLOCK with authorized override -> allowed only with override metadata", () => {
    // Override attempt by authorized PHARMACIST
    const input = { 
      ...baseInput, 
      action_type: "DISPENSE_IP" as any, 
      actor_role: "PHARMACIST",
      is_override_attempt: true,
      vip_policy_outputs: [mockPolicyOutputs.IP_QUARANTINE_BLOCK] 
    };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(true); // Since it was an override attempt and role matches
  });

  test("12. No VIPPolicyOutput -> allowed by guard but emits warning", () => {
    const input = { ...baseInput, vip_policy_outputs: [] };
    const result = evaluateExecutionGuard(input);
    expect(result.allowed).toBe(true);
    expect(result.blocking_reasons[0]).toContain("Warning: No policy evidence");
  });
});
