import { MedicalAuthorityContext, MedicalAuthorityResolution } from "./medical-authority-types";
import { defaultMedicalAuthorityRules } from "./default-medical-authority-rules";
import { validateDelegation } from "./delegation-integration";
import { validateBlinding } from "./blinding-authority-policy";

export function resolveMedicalAuthority(ctx: MedicalAuthorityContext): MedicalAuthorityResolution {
  const rule = defaultMedicalAuthorityRules.find(r => r.procedure_type === ctx.procedure_type);
  
  if (!rule) {
    return createBlockedResolution("Unknown procedure type. Authority denied by default.");
  }

  // 1. Blinding Integration Check
  const blindingValid = validateBlinding(rule.blind_scope, ctx.blind_scope);
  if (!blindingValid.allowed) {
    return createBlockedResolution(blindingValid.reason!);
  }

  // 2. Delegation Integration Check
  if (rule.delegation_required) {
    const delegationValid = validateDelegation(ctx);
    if (!delegationValid.allowed) {
      return createBlockedResolution(delegationValid.reason!);
    }
  }

  // 3. Training Check
  if (rule.training_required && !ctx.training_context.is_current) {
    return createBlockedResolution(`Role ${ctx.actor_role} lacks current training for this protocol/procedure.`);
  }

  // 4. Role Authority Maps
  const canPerform = rule.performer_roles.includes(ctx.actor_role)
  return {
    can_perform: canPerform,
    can_review: rule.reviewer_roles.includes(ctx.actor_role),
    can_adjudicate: rule.adjudicator_roles.includes(ctx.actor_role),
    can_sign: rule.signatory_roles.includes(ctx.actor_role),
    can_override: rule.override_roles.includes(ctx.actor_role),
    
    requires_pi_review: rule.pi_review_required,
    requires_si_review: !rule.pi_review_required && rule.si_review_allowed,
    requires_medical_monitor: rule.medical_monitor_required,
    requires_sponsor: rule.sponsor_required,
    requires_central_lab: rule.central_lab_required,
    
    oversight_level: rule.oversight_level,
    
    delegation_required: rule.delegation_required,
    training_required: rule.training_required,
    hard_stop_if_missing: rule.hard_stop_if_missing,
    blocking_reason: canPerform ? undefined : `Role ${ctx.actor_role} blocked for ${ctx.procedure_type}.`,
  };
}

function createBlockedResolution(reason: string): MedicalAuthorityResolution {
  return {
    can_perform: false,
    can_review: false,
    can_adjudicate: false,
    can_sign: false,
    can_override: false,
    requires_pi_review: true,
    requires_si_review: false,
    requires_medical_monitor: false,
    requires_sponsor: false,
    requires_central_lab: false,
    oversight_level: "SAFETY_CRITICAL",
    delegation_required: true,
    training_required: true,
    hard_stop_if_missing: true,
    blocking_reason: reason
  };
}
