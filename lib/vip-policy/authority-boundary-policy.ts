import { VIPPolicyInput, VIPAuthorityBoundary } from "./vip-policy-types";

export function enforceAuthorityBoundary(input: VIPPolicyInput): VIPAuthorityBoundary {
  // AI must never adjudicate medical significance
  if (input.medical_judgment_required) {
    return "REQUIRE_PI_REVIEW";
  }

  // If a central lab or external EDC needs to resolve
  if (input.signal_source === "EXTERNAL_ADAPTER") {
    return "EXTERNAL_EDC_REQUIRED";
  }

  return "SITE_CAN_ACT";
}
