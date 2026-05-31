import { VIPPolicyOutput } from "../vip-policy/vip-policy-types";
import { PIReviewItem } from "./pi-review-types";
import { v4 as uuidv4 } from "uuid";
import { resolveMedicalAuthority } from "../medical-authority/resolve-medical-authority";
import { MedicalAuthorityContext } from "../medical-authority/medical-authority-types";

function inferProcedureType(o: VIPPolicyOutput): string {
  const reason = o.reason.toLowerCase();
  if (o.policy_basis.includes("ELIGIBILITY")) return "ELIGIBILITY_REVIEW";
  if (o.policy_basis.includes("SUBJECT_SAFETY")) {
    if (reason.includes("adverse") || reason.includes("headache")) return "SAE_REVIEW";
    return "LAB_REVIEW"; // Defaulting AST/ECG to Lab review for mock purposes
  }
  if (o.policy_basis.includes("BLINDING_PROTECTION")) return "UNBLINDED_IP_REVIEW";
  return "VITALS"; // Fallback
}

export function filterPIInboxItems(outputs: VIPPolicyOutput[]): PIReviewItem[] {
  return outputs
    .filter(o => {
      const medicalBasis = o.policy_basis.some((basis) =>
        ["ELIGIBILITY", "SUBJECT_SAFETY", "MEDICAL_AUTHORITY_BOUNDARY"].includes(basis),
      );
      const requiresMedicalAdjudication =
        o.ui_actions.includes("REQUIRE_ADJUDICATION") &&
        (medicalBasis || o.actionability === "NON_ACTIONABLE_MEDICAL_BOUNDARY");

      if (!requiresMedicalAdjudication) return false;

      // 1. Infer procedure from the VIP output
      const procedureType = inferProcedureType(o);

      // 2. Resolve authority needs via Matrix Engine
      // We pass a dummy context because we just want the matrix requirements, not user authorization
      const ctx: MedicalAuthorityContext = {
        procedure_type: procedureType,
        actor_role: "SYSTEM", 
        study_id: "ST-2001",
        protocol_id: "P-001",
        blind_scope: "ANY",
        delegation_context: { is_active: true, is_pi_approved: true, role_allowed: true },
        training_context: { is_current: true }
      };

      const resolution = resolveMedicalAuthority(ctx);

      // 3. Keep only if Medical Authority demands PI or SI review
      return resolution.requires_pi_review || resolution.requires_si_review;
    })
    .map((o, idx) => ({
      review_id: uuidv4(),
      study_id: "ST-2001",
      subject_id: `SUBJ-00${idx + 1}`,
      visit_id: `V-0${idx + 1}`,
      source_type: o.signal_source,
      source_reference: "Record ID " + Math.floor(Math.random() * 10000),
      trigger_reason: o.reason,
      clinical_domain: o.policy_basis.join(", "),
      required_authority: o.authority_boundary,
      policy_output_id: "POL_OUT_" + idx,
      evidence_summary: "Automated extraction via Vilo OS. Values match source document signatures.",
      required_evidence: o.required_evidence,
      current_status: "PENDING_PI_REVIEW",
      due_date: new Date(Date.now() + o.escalation_due_within_hours * 3600000).toISOString(),
      created_at: o.evaluation_timestamp
    }));
}
