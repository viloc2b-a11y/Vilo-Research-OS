export type VisitFinalizationDecision = "ALLOW" | "ALLOW_WITH_WARNINGS" | "REQUIRES_REVIEW" | "BLOCK";

export interface VisitFinalizationReason {
  id: string;
  category: "INFORMED_CONSENT" | "ELIGIBILITY" | "INVESTIGATIONAL_PRODUCT_CONTROL" | "ACTIVE_DELEGATION" | "BLINDING_PROTECTION" | "SOURCE_INCOMPLETE" | "WARNING";
  description: string;
}

export type ReviewStatus = "PENDING" | "COMPLETED" | "NOT_REQUIRED";

export interface VisitFinalizationReviewRequirement {
  reviewType: string;
  authorityRequired: string;
  reviewerId?: string;
  status: ReviewStatus;
}

export interface VisitFinalizationResult {
  decision: VisitFinalizationDecision;
  blockingReasons: VisitFinalizationReason[];
  warnings: VisitFinalizationReason[];
  requiredReviews: VisitFinalizationReviewRequirement[];
  auditEvidence: {
    evaluatedAt: string;
    visitId: string;
    policyHash: string;
  };
}
