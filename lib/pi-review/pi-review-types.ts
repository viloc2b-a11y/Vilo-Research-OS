export type PIReviewStatus =
  | "PENDING_PI_REVIEW"
  | "IN_REVIEW"
  | "CS"
  | "NCS"
  | "MORE_INFO_REQUIRED"
  | "ESCALATED_TO_MEDICAL_MONITOR"
  | "RESOLVED";

export interface PIAdjudicationFields {
  adjudication: PIReviewStatus;
  rationale: string;
  reviewer_id: string;
  reviewer_role: string;
  reviewed_at: string;
  requires_follow_up: boolean;
  follow_up_action?: string;
  missing_evidence?: string;
}

export interface PIReviewItem {
  review_id: string;
  study_id: string;
  subject_id: string;
  visit_id: string;
  source_type: string;
  source_reference: string;
  trigger_reason: string;
  clinical_domain: string;
  required_authority: string;
  policy_output_id: string;
  evidence_summary: string;
  required_evidence: string[];
  current_status: PIReviewStatus;
  due_date: string;
  created_at: string;
  adjudication_data?: PIAdjudicationFields;
}
