import { PharmacyEventType, PharmacyEvent } from "./pharmacy-event-types";
import { PharmacyRole, BlindScope, InventoryState } from "./inventory-state-types";

export enum AuthorizedTask {
  RECEIVE_IP = "RECEIVE_IP",
  QUARANTINE_IP = "QUARANTINE_IP",
  RELEASE_IP = "RELEASE_IP",
  DISPENSE_IP = "DISPENSE_IP",
  ADMINISTER_IP = "ADMINISTER_IP",
  VIEW_INVENTORY = "VIEW_INVENTORY",
  VIEW_UNBLINDED_INVENTORY = "VIEW_UNBLINDED_INVENTORY",
  RECONCILE_ACCOUNTABILITY = "RECONCILE_ACCOUNTABILITY",
  APPROVE_DESTRUCTION = "APPROVE_DESTRUCTION",
  VIEW_TREATMENT_ASSIGNMENT = "VIEW_TREATMENT_ASSIGNMENT",
  APPROVE_SPONSOR_RELEASE = "APPROVE_SPONSOR_RELEASE",
  CORRECT_RECEIPT_ACCOUNTABILITY = "CORRECT_RECEIPT_ACCOUNTABILITY"
}

export interface ActorDelegationContext {
  is_active: boolean;
  role: PharmacyRole;
  blind_scope: BlindScope;
  authorized_tasks: AuthorizedTask[];
  pi_approved: boolean;
  training_verified: boolean;
  restrictions: string[];
}

export interface BlindedInventoryStateView {
  blind_scope: BlindScope.BLINDED | BlindScope.SYSTEM_REDACTED;
  medication_dispensed: boolean;
  inventory_action_exists: boolean;
  masked_status: "IP_STATUS_MASKED";
  allowed_operational_status: "medication_dispensed" | "inventory_action_pending" | "no_ip_activity";
}

export type InventoryStateView = InventoryState | BlindedInventoryStateView;

/**
 * Redacts an Event based on the Actor's Blind Scope
 */
export function resolvePharmacyViewForActor(
  actor: ActorDelegationContext, 
  pharmacyRecord: PharmacyEvent
): PharmacyEvent {
  
  if (actor.blind_scope === BlindScope.UNBLINDED || actor.blind_scope === BlindScope.SPONSOR_UNBLINDED) {
    return pharmacyRecord; // Full visibility
  }

  // Redact if BLINDED
  const redactedRecord = { ...pharmacyRecord };

  redactedRecord.kit_id = null;
  redactedRecord.lot_number = BlindScope.SYSTEM_REDACTED;

  if (redactedRecord.treatment_assignment) {
    redactedRecord.treatment_assignment = BlindScope.SYSTEM_REDACTED;
  }
  
  if (redactedRecord.unblinded_preparation_instructions) {
    redactedRecord.unblinded_preparation_instructions = BlindScope.SYSTEM_REDACTED;
  }
  
  if (redactedRecord.unblinded_sponsor_note) {
    redactedRecord.unblinded_sponsor_note = BlindScope.SYSTEM_REDACTED;
  }

  // Specific data visibility rules for evidence object
  if (redactedRecord.source_evidence) {
    const redactedEvidence = { ...redactedRecord.source_evidence };
    if (redactedEvidence.active_placebo_indicator) {
      redactedEvidence.active_placebo_indicator = BlindScope.SYSTEM_REDACTED;
    }
    if (redactedEvidence.unblinded_rationale) {
      redactedEvidence.unblinded_rationale = BlindScope.SYSTEM_REDACTED;
    }
    redactedRecord.source_evidence = redactedEvidence;
  }

  return redactedRecord;
}

/**
 * Redacts full Inventory State for blinded users
 */
export function resolveInventoryStateViewForActor(
  actor: ActorDelegationContext, 
  state: InventoryState
): InventoryStateView {
  
  if (actor.blind_scope === BlindScope.UNBLINDED || actor.blind_scope === BlindScope.SPONSOR_UNBLINDED) {
    return state;
  }

  const medicationDispensed = state.dispensed > 0 || state.administered > 0;
  const inventoryActionExists = [
    state.total_received,
    state.available,
    state.dispensed,
    state.administered,
    state.returned,
    state.destroyed,
    state.quarantined,
    state.missing,
    state.unreconciled
  ].some((value) => value > 0);

  return {
    blind_scope: BlindScope.BLINDED,
    medication_dispensed: medicationDispensed,
    inventory_action_exists: inventoryActionExists,
    masked_status: "IP_STATUS_MASKED",
    allowed_operational_status: medicationDispensed
      ? "medication_dispensed"
      : inventoryActionExists
        ? "inventory_action_pending"
        : "no_ip_activity"
  };
}

/**
 * Evaluates if a user is legally permitted to approve a specific Pharmacy Event
 * strictly based on their Delegation Log (DOA) standing AND Blinding Restrictions.
 */
export async function validateDelegationPolicyForAction(
  context: ActorDelegationContext, 
  action_type: AuthorizedTask
): Promise<boolean> {

  if (!context.is_active) return false;
  if (!context.pi_approved) return false;
  if (!context.training_verified) return false;
  if (!context.authorized_tasks.includes(action_type)) return false;

  // Hard Guardrails based on Blinding
  if (context.blind_scope === BlindScope.BLINDED) {
    const unblindedOnlyTasks = [
      AuthorizedTask.RECEIVE_IP,
      AuthorizedTask.QUARANTINE_IP,
      AuthorizedTask.RELEASE_IP,
      AuthorizedTask.VIEW_UNBLINDED_INVENTORY,
      AuthorizedTask.VIEW_TREATMENT_ASSIGNMENT,
      AuthorizedTask.RECONCILE_ACCOUNTABILITY, // Accountability totals reveal assignment
      AuthorizedTask.APPROVE_DESTRUCTION, // Requires unblinded visibility to sign off
      AuthorizedTask.APPROVE_SPONSOR_RELEASE,
      AuthorizedTask.CORRECT_RECEIPT_ACCOUNTABILITY
    ];
    
    if (unblindedOnlyTasks.includes(action_type)) {
      return false; // Hard block
    }
  }

  return true;
}

export function assertPharmacyActionAuthorized(
  context: ActorDelegationContext,
  action_type: AuthorizedTask
): void {
  if (!context.is_active) {
    throw new Error("Pharmacy access denied: actor is inactive.");
  }

  if (!context.pi_approved) {
    throw new Error("Pharmacy access denied: delegation is not PI-approved.");
  }

  if (!context.training_verified) {
    throw new Error("Pharmacy access denied: training is not verified.");
  }

  if (!context.authorized_tasks.includes(action_type)) {
    throw new Error("Pharmacy access denied: task is not delegated.");
  }

  if (
    context.blind_scope === BlindScope.BLINDED &&
    [
      AuthorizedTask.RECEIVE_IP,
      AuthorizedTask.QUARANTINE_IP,
      AuthorizedTask.RELEASE_IP,
      AuthorizedTask.VIEW_UNBLINDED_INVENTORY,
      AuthorizedTask.VIEW_TREATMENT_ASSIGNMENT,
      AuthorizedTask.RECONCILE_ACCOUNTABILITY,
      AuthorizedTask.APPROVE_DESTRUCTION,
      AuthorizedTask.APPROVE_SPONSOR_RELEASE,
      AuthorizedTask.CORRECT_RECEIPT_ACCOUNTABILITY
    ].includes(action_type)
  ) {
    throw new Error("Pharmacy access denied: unblinded action is a hard gate.");
  }
}
