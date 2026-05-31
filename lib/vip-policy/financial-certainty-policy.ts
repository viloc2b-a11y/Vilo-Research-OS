import { VIPPolicyInput, VIPFinancialCertainty } from "./vip-policy-types";

export function enforceFinancialCertainty(input: VIPPolicyInput): VIPFinancialCertainty {
  if (!input.cta_available) {
    return "REQUIRES_CTA"; // VIP cannot invent payment holdbacks
  }
  
  if (!input.financial_data_available) {
    return "REQUIRES_CLINIQ";
  }

  return "ESTIMATED";
}
