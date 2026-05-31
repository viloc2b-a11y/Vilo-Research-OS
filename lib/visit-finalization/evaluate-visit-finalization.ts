import { VisitFinalizationDecision, VisitFinalizationReason, VisitFinalizationResult, VisitFinalizationReviewRequirement } from "./visit-finalization-types";
import { v4 as uuidv4 } from "uuid";

// Note: In production, this imports the actual execution guard & authority matrix outputs.
// For the scope of this implementation phase, we mock the inputs to validate the guard's logic model.

export interface MockFinalizationInputs {
  sourceComplete: boolean;
  missingConsent: boolean;
  eligibilityUnresolved: boolean;
  ipAccountabilityIssue: boolean;
  delegationViolation: boolean;
  blindingViolation: boolean;
  vipWarnings: string[];
  monitoringWarnings: string[];
  revenueRiskWarnings: string[];
  missingNonCriticalNotes: string[];
  pendingPIReview: boolean;
  pendingSIReview: boolean;
}

export async function evaluateVisitFinalization(
  studyId: string, 
  subjectId: string, 
  visitId: string,
  // Inputs injected for testing the 12 scenarios
  mockInputs: MockFinalizationInputs = {
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
  }
): Promise<VisitFinalizationResult> {
  
  const blockingReasons: VisitFinalizationReason[] = [];
  const warnings: VisitFinalizationReason[] = [];
  const requiredReviews: VisitFinalizationReviewRequirement[] = [];

  // 1. Source Completion Check
  if (!mockInputs.sourceComplete) {
    blockingReasons.push({ id: uuidv4(), category: "SOURCE_INCOMPLETE", description: "Required forms or fields are missing." });
  }

  // 2. Protected Categories (BLOCK)
  if (mockInputs.missingConsent) {
    blockingReasons.push({ id: uuidv4(), category: "INFORMED_CONSENT", description: "Missing informed consent." });
  }
  if (mockInputs.eligibilityUnresolved) {
    blockingReasons.push({ id: uuidv4(), category: "ELIGIBILITY", description: "Subject eligibility not medically resolved." });
  }
  if (mockInputs.ipAccountabilityIssue) {
    blockingReasons.push({ id: uuidv4(), category: "INVESTIGATIONAL_PRODUCT_CONTROL", description: "IP accountability gap detected." });
  }
  if (mockInputs.delegationViolation) {
    blockingReasons.push({ id: uuidv4(), category: "ACTIVE_DELEGATION", description: "Action performed by undelegated staff." });
  }
  if (mockInputs.blindingViolation) {
    blockingReasons.push({ id: uuidv4(), category: "BLINDING_PROTECTION", description: "Blinding firewall violation." });
  }

  // 3. Medical Authority Reviews
  if (mockInputs.pendingPIReview) {
    requiredReviews.push({ reviewType: "MEDICAL_SIGNIFICANCE", authorityRequired: "PI", status: "PENDING" });
  }
  if (mockInputs.pendingSIReview) {
    requiredReviews.push({ reviewType: "MEDICAL_SIGNIFICANCE", authorityRequired: "SI", status: "PENDING" });
  }

  // 4. Warnings (Non-Blocking)
  mockInputs.vipWarnings.forEach(w => warnings.push({ id: uuidv4(), category: "WARNING", description: w }));
  mockInputs.monitoringWarnings.forEach(w => warnings.push({ id: uuidv4(), category: "WARNING", description: w }));
  mockInputs.revenueRiskWarnings.forEach(w => warnings.push({ id: uuidv4(), category: "WARNING", description: w }));
  mockInputs.missingNonCriticalNotes.forEach(w => warnings.push({ id: uuidv4(), category: "WARNING", description: w }));

  // 5. Compute Final Decision
  let decision: VisitFinalizationDecision = "ALLOW";

  if (blockingReasons.length > 0) {
    decision = "BLOCK";
  } else if (requiredReviews.some(r => r.status === "PENDING")) {
    decision = "REQUIRES_REVIEW";
  } else if (warnings.length > 0) {
    decision = "ALLOW_WITH_WARNINGS";
  }

  return {
    decision,
    blockingReasons,
    warnings,
    requiredReviews,
    auditEvidence: {
      evaluatedAt: new Date().toISOString(),
      visitId,
      policyHash: "sha256-mock"
    }
  };
}
