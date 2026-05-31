import { evaluateVIPPolicy } from "../lib/vip-policy/evaluate-vip-policy";
import { VIPPolicyInput } from "../lib/vip-policy/vip-policy-types";
import { evaluateExecutionGuard } from "../lib/site-defense/evaluate-execution-guard";
import { ExecutionGuardInput } from "../lib/site-defense/execution-guard-types";
import { resolveMedicalAuthority } from "../lib/medical-authority/resolve-medical-authority";
import { MedicalAuthorityContext } from "../lib/medical-authority/medical-authority-types";
import { filterPIInboxItems } from "../lib/pi-review/pi-review-policy-adapter";

describe("Core Governance Stack Integration", () => {
  const baseAuthCtx: MedicalAuthorityContext = {
    procedure_type: "VITALS",
    actor_role: "CRC",
    study_id: "S1",
    protocol_id: "P1",
    blind_scope: "BLINDED",
    delegation_context: { is_active: true, is_pi_approved: true, role_allowed: true },
    training_context: { is_current: true }
  };

  test("1. Abnormal lab requires PI/SI review but does not block routine CRC flow", () => {
    // 1. VIP Policy evaluation
    const vipInput: VIPPolicyInput = {
      pattern_id: "LAB_001", category: "Labs", signal_source: "LAB_PORTAL", severity: "CRITICAL",
      basis_candidates: ["SUBJECT_SAFETY"], is_trend_only: false, medical_judgment_required: true,
      financial_data_available: false, cta_available: false, evidence_status: "COMPLETE", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    expect(policyOutput.enforcement_level).toBe("WARNING"); // Downgraded from hard stop due to medical boundary
    
    // 2. PI Inbox routing
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(1); // Mapped to LAB_REVIEW requiring PI/SI
    
    // 3. Authority matrix confirms PI or SI
    const authRes = resolveMedicalAuthority({ ...baseAuthCtx, procedure_type: "LAB_REVIEW" });
    expect(authRes.requires_pi_review || authRes.requires_si_review).toBe(true);

    // 4. Guard allows non-adjudication action (routine documentation)
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "SIGN_SOURCE", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(true); // Medical boundary blocks only specific adjudication/hard stop endpoints
  });

  test("2. Eligibility not medically adjudicated before randomization is blocked", () => {
    const vipInput: VIPPolicyInput = {
      pattern_id: "ELIG_001", category: "Clinical", signal_source: "EDC", severity: "CRITICAL",
      basis_candidates: ["ELIGIBILITY"], is_trend_only: false, medical_judgment_required: true,
      financial_data_available: false, cta_available: false, evidence_status: "COMPLETE", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(1); // Routes to inbox
    
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "RANDOMIZE_SUBJECT", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(false); // REQUIRE_PI_REVIEW blocks RANDOMIZE_SUBJECT
  });

  test("3. Consent missing before procedure", () => {
    const vipInput: VIPPolicyInput = {
      pattern_id: "CONS_001", category: "Regulatory", signal_source: "EDC", severity: "HARD_STOP",
      basis_candidates: ["CONSENT_MISSING"], is_trend_only: false, medical_judgment_required: false,
      financial_data_available: false, cta_available: false, evidence_status: "MISSING", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(0); // Not a PI medical task
    
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "RANDOMIZE_SUBJECT", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(false); // Guard blocks strictly on CONSENT
  });

  test("4. Blinded user attempts unblinded access", () => {
    const authRes = resolveMedicalAuthority({ ...baseAuthCtx, procedure_type: "UNBLINDED_IP_REVIEW", blind_scope: "UNBLINDED" });
    // baseAuthCtx has blind_scope: BLINDED. The procedure requires UNBLINDED.
    expect(authRes.can_perform).toBe(false);
    expect(authRes.blocking_reason).toContain("blocked");
  });

  test("5. CRC attempts to sign medical adjudication", () => {
    const authRes = resolveMedicalAuthority({ ...baseAuthCtx, procedure_type: "ELIGIBILITY_REVIEW" });
    expect(authRes.can_adjudicate).toBe(false); // CRC cannot adjudicate eligibility
  });

  test("6. Query aging warning", () => {
    const vipInput: VIPPolicyInput = {
      pattern_id: "QUERY_001", category: "Monitoring", signal_source: "EDC", severity: "MEDIUM",
      basis_candidates: ["QUERY_RISK"], is_trend_only: true, medical_judgment_required: false,
      financial_data_available: false, cta_available: false, evidence_status: "COMPLETE", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    expect(policyOutput.enforcement_level).toBe("WARNING"); // Trend -> warning
    
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(0); // Not PI medical review
    
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "SIGN_SOURCE", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(true); // Guard ignores non-critical bases
  });

  test("7. Financial risk unknown", () => {
    const vipInput: VIPPolicyInput = {
      pattern_id: "FIN_001", category: "Finance", signal_source: "EDC", severity: "HIGH",
      basis_candidates: ["FINANCIAL_UNCERTAINTY_BOUNDARY"], is_trend_only: false, medical_judgment_required: false,
      financial_data_available: false, cta_available: false, evidence_status: "COMPLETE", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    expect(policyOutput.financial_certainty).toBe("REQUIRES_CTA"); // Captured by policy
    
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(0); // Financial, not medical
    
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "SIGN_SOURCE", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(true); // Financials never block workflow
  });

  test("8. Physical reconciliation mismatch", () => {
    const vipInput: VIPPolicyInput = {
      pattern_id: "IP_001", category: "Pharmacy", signal_source: "PHARMACY_LOG", severity: "HARD_STOP",
      basis_candidates: ["INVESTIGATIONAL_PRODUCT_CONTROL"], is_trend_only: false, medical_judgment_required: false,
      financial_data_available: false, cta_available: false, evidence_status: "CONFLICTING", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    expect(policyOutput.evidence_status).toBe("PHYSICAL_RECONCILIATION_REQUIRED"); // Captured conflict
    
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "DISPENSE_IP", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(false); // Blocks protected action
    expect(guardOut.override_allowed).toBe(true); // Override exists for dual sig
  });
  test("9. Training expired for delegated action", () => {
    // Authority Matrix explicitly blocks execution if training is missing
    const authRes = resolveMedicalAuthority({ ...baseAuthCtx, procedure_type: "VITALS", training_context: { is_current: false } });
    expect(authRes.can_perform).toBe(false);
    expect(authRes.blocking_reason).toContain("lacks current training");

    // VIP Policy translates this into an ACTIVE_DELEGATION block
    const vipInput: VIPPolicyInput = {
      pattern_id: "TRAINING_001", category: "Delegation", signal_source: "EDC", severity: "HARD_STOP",
      basis_candidates: ["ACTIVE_DELEGATION"], is_trend_only: false, medical_judgment_required: false,
      financial_data_available: false, cta_available: false, evidence_status: "MISSING", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    
    // Guard executes the HARD_STOP
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "RANDOMIZE_SUBJECT", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(false);
    
    // But it does NOT go to the PI Medical Inbox because it's administrative, not medical.
    const inboxItems = filterPIInboxItems([policyOutput]);
    expect(inboxItems).toHaveLength(0);
  });

  test("10. Protocol waiver / exemption attempt by CRC", () => {
    // Authority Matrix strictly restricts waiver approval to SPONSOR/MEDICAL_MONITOR and PI
    const authRes = resolveMedicalAuthority({ ...baseAuthCtx, procedure_type: "WAIVER_APPROVAL" });
    expect(authRes.can_adjudicate).toBe(false); // CRC cannot adjudicate
    expect(authRes.requires_sponsor).toBe(true);
    expect(authRes.requires_medical_monitor).toBe(true);

    const vipInput: VIPPolicyInput = {
      pattern_id: "WAIVER_001", category: "Regulatory", signal_source: "EDC", severity: "CRITICAL",
      basis_candidates: ["MEDICAL_AUTHORITY_BOUNDARY", "SUBJECT_SAFETY"], is_trend_only: false, medical_judgment_required: true,
      financial_data_available: false, cta_available: false, evidence_status: "COMPLETE", user_role: "CRC", blinding_exposure_risk: "NONE"
    };
    const policyOutput = evaluateVIPPolicy(vipInput);
    
    // Guard will block CRC from pushing past the required adjudication
    const guardOut = evaluateExecutionGuard({
      study_id: "S1", subject_id: "U1", action_type: "RANDOMIZE_SUBJECT", actor_id: "CRC", actor_role: "CRC",
      is_override_attempt: false, vip_policy_outputs: [policyOutput]
    });
    expect(guardOut.allowed).toBe(false);
    expect(guardOut.authority_boundary).toBe("REQUIRE_PI_REVIEW");
  });
});
