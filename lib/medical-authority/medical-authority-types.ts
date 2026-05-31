import { VIPPolicyBasis } from "../vip-policy/vip-policy-types";

export type ProcedureCategory = 
  | "CLINICAL_ASSESSMENT"
  | "LABORATORY"
  | "PHARMACY"
  | "BIOSPECIMEN"
  | "REGULATORY"
  | "SAFETY"
  | "OVERSIGHT";

export type OversightLevel = 
  | "NONE"
  | "OPERATIONAL"
  | "MEDICAL"
  | "CRITICAL_MEDICAL"
  | "SAFETY_CRITICAL";

export type AuthorityRole = 
  | "CRC"
  | "RN"
  | "MA"
  | "PHARMACIST"
  | "UNBLINDED_PHARMACIST"
  | "LAB_TECH"
  | "BIOSPECIMEN_TECH"
  | "SUB_INVESTIGATOR"
  | "PI"
  | "MEDICAL_MONITOR"
  | "CRA"
  | "SPONSOR"
  | "CENTRAL_LAB"
  | "SYSTEM";

export type AuthorityDecisionType = 
  | "PERFORM"
  | "REVIEW"
  | "ADJUDICATE"
  | "SIGN"
  | "OVERRIDE"
  | "SUPERVISE";

export type BlindScope = "BLINDED" | "UNBLINDED" | "ANY";

export type AuthorityRequirement = "MANDATORY" | "OPTIONAL" | "NOT_PERMITTED";

export interface MedicalAuthorityRule {
  rule_id: string;
  procedure_type: string;
  procedure_category: ProcedureCategory;
  study_specific: boolean;
  protocol_specific: boolean;
  performer_roles: AuthorityRole[];
  reviewer_roles: AuthorityRole[];
  adjudicator_roles: AuthorityRole[];
  signatory_roles: AuthorityRole[];
  override_roles: AuthorityRole[];
  oversight_required: boolean;
  oversight_level: OversightLevel;
  blind_scope: BlindScope;
  delegation_required: boolean;
  training_required: boolean;
  pi_review_required: boolean;
  si_review_allowed: boolean;
  medical_monitor_required: boolean;
  sponsor_required: boolean;
  central_lab_required: boolean;
  hard_stop_if_missing: boolean;
  policy_basis: VIPPolicyBasis[];
  description: string;
}

export interface MedicalAuthorityContext {
  procedure_type: string;
  actor_role: AuthorityRole;
  study_id: string;
  protocol_id: string;
  blind_scope: BlindScope;
  delegation_context: {
    is_active: boolean;
    is_pi_approved: boolean;
    role_allowed: boolean;
  };
  training_context: {
    is_current: boolean;
  };
}

export interface MedicalAuthorityResolution {
  can_perform: boolean;
  can_review: boolean;
  can_adjudicate: boolean;
  can_sign: boolean;
  can_override: boolean;
  
  requires_pi_review: boolean;
  requires_si_review: boolean;
  requires_medical_monitor: boolean;
  requires_sponsor: boolean;
  requires_central_lab: boolean;
  
  oversight_level: OversightLevel;
  
  delegation_required: boolean;
  training_required: boolean;
  hard_stop_if_missing: boolean;
  blocking_reason?: string;
}
