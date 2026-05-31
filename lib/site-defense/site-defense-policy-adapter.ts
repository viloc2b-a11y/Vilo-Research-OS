import { evaluateVIPPolicy } from "../vip-policy/evaluate-vip-policy";
import { VIPPolicyInput } from "../vip-policy/vip-policy-types";
import { SiteDefenseItem } from "./site-defense-types";
import { v4 as uuidv4 } from "uuid";

function getTitleForInput(input: VIPPolicyInput): string {
  if (input.basis_candidates.includes("CONSENT_AFTER_PROCEDURE")) return "Consent Signed After Procedure";
  if (input.medical_judgment_required) return "Abnormal Lab Pending Review";
  if (input.evidence_status === "CONFLICTING") return "Physical Inventory Mismatch";
  if (!input.cta_available) return "Unquantifiable Payment Risk";
  return "Coordinator Task Overload Trend";
}

export function adaptInputsToDefenseItems(inputs: VIPPolicyInput[]): SiteDefenseItem[] {
  return inputs.map((input) => {
    const policy = evaluateVIPPolicy(input);
    return {
      id: uuidv4(),
      input_id: input.pattern_id,
      category: input.category,
      title: getTitleForInput(input),
      status: "OPEN",
      policy
    };
  });
}
