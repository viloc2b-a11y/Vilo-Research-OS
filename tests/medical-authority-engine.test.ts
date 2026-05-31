import { resolveMedicalAuthority } from "../lib/medical-authority/resolve-medical-authority";
import { MedicalAuthorityContext } from "../lib/medical-authority/medical-authority-types";

describe("Medical Authority Matrix Engine", () => {
  const baseCtx: MedicalAuthorityContext = {
    procedure_type: "VITALS",
    actor_role: "CRC",
    study_id: "S1",
    protocol_id: "P1",
    blind_scope: "BLINDED",
    delegation_context: { is_active: true, is_pi_approved: true, role_allowed: true },
    training_context: { is_current: true }
  };

  test("CRC performing vitals -> Allowed", () => {
    const res = resolveMedicalAuthority(baseCtx);
    expect(res.can_perform).toBe(true);
    expect(res.blocking_reason).toBeUndefined();
  });

  test("CRC attempting eligibility adjudication -> Denied", () => {
    const ctx = { ...baseCtx, procedure_type: "ELIGIBILITY_REVIEW" };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_adjudicate).toBe(false); // CRC is not in adjudicator_roles
  });

  test("SI reviewing abnormal labs -> Allowed", () => {
    const ctx = { ...baseCtx, actor_role: "SUB_INVESTIGATOR" as any, procedure_type: "LAB_REVIEW" };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_review).toBe(true);
    expect(res.can_adjudicate).toBe(true);
  });

  test("PI reviewing SAE -> Allowed, enforces PI constraints", () => {
    const ctx = { ...baseCtx, actor_role: "PI" as any, procedure_type: "SAE_REVIEW" };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_perform).toBe(true);
    expect(res.requires_medical_monitor).toBe(true);
  });

  test("CRC viewing unblinded inventory -> Blocked", () => {
    const ctx = { ...baseCtx, procedure_type: "UNBLINDED_IP_REVIEW" };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_perform).toBe(false);
    expect(res.blocking_reason).toContain("requires an unblinded role");
  });

  test("Expired delegation -> Blocked", () => {
    const ctx = { ...baseCtx, delegation_context: { is_active: false, is_pi_approved: true, role_allowed: true } };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_perform).toBe(false);
    expect(res.blocking_reason).toContain("Delegation log entry is expired");
  });

  test("Expired training -> Blocked", () => {
    const ctx = { ...baseCtx, training_context: { is_current: false } };
    const res = resolveMedicalAuthority(ctx);
    expect(res.can_perform).toBe(false);
    expect(res.blocking_reason).toContain("lacks current training");
  });
});
