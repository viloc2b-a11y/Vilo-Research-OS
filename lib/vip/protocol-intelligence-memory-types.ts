export type VIPMemoryCategory = 
  | "CRITICAL_PROCEDURE_PATTERN"
  | "HARD_STOP_PATTERN"
  | "SOURCE_EVIDENCE_PATTERN"
  | "DEVIATION_RISK_PATTERN"
  | "COORDINATOR_QA_PATTERN"
  | "SOURCE_BLUEPRINT_PATTERN"
  | "AMENDMENT_IMPACT_PATTERN";

export type VIPApprovalStatus = 
  | "CANDIDATE"
  | "APPROVED_FOR_REUSE"
  | "REJECTED"
  | "RETIRED";

export type VIPConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface VIPPatternScope {
  applicable_document_types: string[];
  applicable_procedure_types: string[];
  exclusions: string[];
  confidence: VIPConfidenceLevel;
  evidence_required: string[];
}

export interface VIPAuditTrail {
  suggested_at: string | null;
  suggested_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  reason: string | null;
}

export interface VIPProtocolIntelligenceMemory {
  pattern_id: string;
  category: VIPMemoryCategory;
  abstracted_pattern: string;
  source_artifact: string;
  approval_status: VIPApprovalStatus;
  reviewer: string | null;
  scope: VIPPatternScope;
  audit_trail: VIPAuditTrail;
  coordinator_acceptance: boolean; // MUST be true before use
  created_at: string;
}
