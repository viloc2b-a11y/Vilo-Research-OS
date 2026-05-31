import { VIPPolicyOutput, VIPEnforcementLevel, VIPAuthorityBoundary } from "../vip-policy/vip-policy-types";

export type ProtectedActionType =
  | "RANDOMIZE_SUBJECT"
  | "DISPENSE_IP"
  | "ADMINISTER_IP"
  | "FINALIZE_VISIT"
  | "SIGN_SOURCE"
  | "VIEW_UNBLINDED_DATA";

export interface ExecutionGuardInput {
  study_id: string;
  subject_id: string;
  action_type: ProtectedActionType;
  actor_id: string;
  actor_role: string;
  is_override_attempt: boolean;
  vip_policy_outputs: VIPPolicyOutput[];
}

export interface ExecutionGuardOutput {
  allowed: boolean;
  enforcement_level: VIPEnforcementLevel | "NONE";
  blocking_reasons: string[];
  required_actions: string[];
  authority_boundary: VIPAuthorityBoundary;
  override_allowed: boolean;
  override_roles_allowed: string[];
  audit_required: boolean;
  policy_outputs_used: string[]; // pattern_ids or similar identifier if available, will just store count/flag for now
}
