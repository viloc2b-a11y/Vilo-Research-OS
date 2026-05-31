import { MedicalAuthorityContext } from "./medical-authority-types";

export function validateDelegation(ctx: MedicalAuthorityContext): { allowed: boolean; reason?: string } {
  const d = ctx.delegation_context;
  
  if (!d.is_active) {
    return { allowed: false, reason: "Delegation log entry is expired or inactive." };
  }
  
  if (!d.is_pi_approved) {
    return { allowed: false, reason: "Delegation lacks Principal Investigator signature/approval." };
  }
  
  if (!d.role_allowed) {
    return { allowed: false, reason: `Role ${ctx.actor_role} is not explicitly delegated for this procedure.` };
  }

  return { allowed: true };
}
