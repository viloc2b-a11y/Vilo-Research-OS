import { evaluateVisitFinalization, MockFinalizationInputs } from "../lib/visit-finalization/evaluate-visit-finalization";

describe("Visit Finalization Guard Implementation", () => {
  const baseMock: MockFinalizationInputs = {
    sourceComplete: true,
    missingConsent: false,
    eligibilityUnresolved: false,
    ipAccountabilityIssue: false,
    delegationViolation: false,
    blindingViolation: false,
    vipWarnings: [],
    monitoringWarnings: [],
    revenueRiskWarnings: [],
    missingNonCriticalNotes: [],
    pendingPIReview: false,
    pendingSIReview: false
  };

  test("Scenario 1: Complete visit, No violations -> ALLOW", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock });
    expect(res.decision).toBe("ALLOW");
  });

  test("Scenario 2: VIP warning -> ALLOW_WITH_WARNINGS", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, vipWarnings: ["Minor trend deviation detected"] });
    expect(res.decision).toBe("ALLOW_WITH_WARNINGS");
    expect(res.warnings.length).toBe(1);
  });

  test("Scenario 3: Monitoring warning -> ALLOW_WITH_WARNINGS", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, monitoringWarnings: ["CRA notes pending review"] });
    expect(res.decision).toBe("ALLOW_WITH_WARNINGS");
  });

  test("Scenario 4: PI review pending -> REQUIRES_REVIEW", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, pendingPIReview: true });
    expect(res.decision).toBe("REQUIRES_REVIEW");
    expect(res.requiredReviews.length).toBe(1);
    expect(res.requiredReviews[0].authorityRequired).toBe("PI");
  });

  test("Scenario 5: SI review pending -> REQUIRES_REVIEW", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, pendingSIReview: true });
    expect(res.decision).toBe("REQUIRES_REVIEW");
    expect(res.requiredReviews[0].authorityRequired).toBe("SI");
  });

  test("Scenario 6: Missing consent -> BLOCK", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, missingConsent: true });
    expect(res.decision).toBe("BLOCK");
    expect(res.blockingReasons[0].category).toBe("INFORMED_CONSENT");
  });

  test("Scenario 7: Eligibility unresolved -> BLOCK", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, eligibilityUnresolved: true });
    expect(res.decision).toBe("BLOCK");
    expect(res.blockingReasons[0].category).toBe("ELIGIBILITY");
  });

  test("Scenario 8: Delegation violation -> BLOCK", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, delegationViolation: true });
    expect(res.decision).toBe("BLOCK");
    expect(res.blockingReasons[0].category).toBe("ACTIVE_DELEGATION");
  });

  test("Scenario 9: Blinding violation -> BLOCK", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, blindingViolation: true });
    expect(res.decision).toBe("BLOCK");
    expect(res.blockingReasons[0].category).toBe("BLINDING_PROTECTION");
  });

  test("Scenario 10: IP accountability issue -> BLOCK", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, ipAccountabilityIssue: true });
    expect(res.decision).toBe("BLOCK");
    expect(res.blockingReasons[0].category).toBe("INVESTIGATIONAL_PRODUCT_CONTROL");
  });

  test("Scenario 11: Missing non-critical note -> ALLOW_WITH_WARNINGS", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, missingNonCriticalNotes: ["Coordinator note absent"] });
    expect(res.decision).toBe("ALLOW_WITH_WARNINGS");
  });

  test("Scenario 12: Revenue risk warning -> ALLOW_WITH_WARNINGS", async () => {
    const res = await evaluateVisitFinalization("ST-1", "SUB-1", "V-1", { ...baseMock, revenueRiskWarnings: ["Visit outside primary billing window"] });
    expect(res.decision).toBe("ALLOW_WITH_WARNINGS");
  });
});
