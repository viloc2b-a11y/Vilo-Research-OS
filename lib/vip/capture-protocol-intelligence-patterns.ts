import { 
  VIPProtocolIntelligenceMemory, 
  VIPMemoryCategory, 
  VIPApprovalStatus, 
  VIPConfidenceLevel,
  VIPPatternScope
} from "./protocol-intelligence-memory-types";

/**
 * Capture VIP Protocol Intelligence Patterns
 * Mode: OBSERVE_CAPTURE_SUGGEST
 */
export function captureProtocolIntelligencePattern(
  category: VIPMemoryCategory,
  abstractedPattern: string,
  sourceArtifact: string,
  scope: VIPPatternScope
): VIPProtocolIntelligenceMemory {
  
  // All captured patterns MUST start as CANDIDATE. 
  const approvalStatus: VIPApprovalStatus = "CANDIDATE";
  
  return {
    pattern_id: `VIP_PAT_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    category: category,
    abstracted_pattern: abstractedPattern,
    source_artifact: sourceArtifact,
    approval_status: approvalStatus,
    reviewer: null,
    scope: scope,
    audit_trail: {
      suggested_at: null,
      suggested_by: null,
      accepted_at: null,
      accepted_by: null,
      rejected_at: null,
      rejected_by: null,
      reason: null
    },
    coordinator_acceptance: false, // Default to FALSE. Governed reuse gate.
    created_at: new Date().toISOString()
  };
}

/**
 * Governed Reuse Gate: Checks if a pattern can be suggested to the coordinator.
 */
export function canSuggestPattern(pattern: VIPProtocolIntelligenceMemory): boolean {
  // CANDIDATE patterns appear only in admin review.
  // REJECTED/RETIRED patterns cannot be suggested.
  return pattern.approval_status === "APPROVED_FOR_REUSE";
}

/**
 * Governed Application Gate: Checks if a pattern can actually be used in production workflows.
 */
export function canApplyPattern(pattern: VIPProtocolIntelligenceMemory): boolean {
  return canSuggestPattern(pattern) && pattern.coordinator_acceptance === true;
}

/**
 * Validates that a pattern does not contain PHI or unapproved Raw Text.
 */
export function validatePatternSanitization(pattern: VIPProtocolIntelligenceMemory): boolean {
  const restrictedKeywords = ["raw/", "inbox/", "MRN", "DOB", "patient_name", "sponsor_", "covance", "q2_solutions"];
  
  for (const keyword of restrictedKeywords) {
    if (pattern.abstracted_pattern.toLowerCase().includes(keyword.toLowerCase())) {
      return false; // Failed sanitization check
    }
  }
  return true;
}
