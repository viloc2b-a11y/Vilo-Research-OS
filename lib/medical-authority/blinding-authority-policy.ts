import { BlindScope } from "./medical-authority-types";

export function validateBlinding(ruleBlindScope: BlindScope, userBlindScope: BlindScope): { allowed: boolean; reason?: string } {
  if (ruleBlindScope === "ANY") {
    return { allowed: true };
  }

  if (ruleBlindScope === "UNBLINDED" && userBlindScope !== "UNBLINDED") {
    return { allowed: false, reason: "Procedure strictly requires an unblinded role. Blinded user attempt blocked." };
  }

  if (ruleBlindScope === "BLINDED" && userBlindScope === "UNBLINDED") {
    return { allowed: false, reason: "Procedure strictly requires a blinded role. Unblinded user attempt blocked to preserve endpoint integrity." };
  }

  return { allowed: true };
}
