import { PharmacyEvent, PharmacyEventType, EventSourceType, EventApprovalStatus } from '../lib/pharmacy-runtime/pharmacy-event-types';
import { InventoryState, PharmacyRole, BlindScope } from '../lib/pharmacy-runtime/inventory-state-types';
import { assertPharmacyActionAuthorized, BlindedInventoryStateView, resolvePharmacyViewForActor, resolveInventoryStateViewForActor, validateDelegationPolicyForAction, ActorDelegationContext, AuthorizedTask } from '../lib/pharmacy-runtime/blinding-access-policy';

describe("Pharmacy Blinding Access Policy Hardening", () => {
  
  // MOCK DATA
  const mockUnblindedEvent: PharmacyEvent = {
    event_id: "EVT-001",
    organization_id: "ORG-1",
    study_id: "STU-1",
    site_id: "SITE-1",
    kit_id: "KIT-999",
    lot_number: "LOT-A",
    subject_id: null,
    event_type: PharmacyEventType.SPONSOR_RELEASE,
    event_source_type: EventSourceType.SPONSOR_EMAIL,
    event_time: "2026-05-30T10:00:00Z",
    quantity: 1,
    unit: "vial",
    treatment_assignment: "Active",
    unblinded_preparation_instructions: "Mix with 50mL saline.",
    unblinded_sponsor_note: "Patient randomized to Arm A. Release quarantine.",
    source_document_id: "DOC-1",
    source_row: 1,
    source_evidence: { active_placebo_indicator: true },
    actor_id: "SPONSOR-1",
    delegation_assignment_id: "DOA-1",
    approval_status: EventApprovalStatus.APPROVED,
    created_at: "2026-05-30T10:00:00Z"
  };

  const mockInventoryState: InventoryState = {
    organization_id: "ORG-1",
    study_id: "STU-1",
    site_id: "SITE-1",
    total_received: 10,
    available: 10,
    dispensed: 0,
    administered: 0,
    returned: 0,
    destroyed: 0,
    quarantined: 0,
    missing: 0,
    unreconciled: 0,
    lot_number: "LOT-A",
    kit_states: { "KIT-999": "AVAILABLE" as any },
    treatment_assignments: { "KIT-999": "Active" },
    last_calculated_at: "2026-05-30T10:00:00Z"
  };

  const blindedCoordinator: ActorDelegationContext = {
    is_active: true,
    role: PharmacyRole.COORDINATOR,
    blind_scope: BlindScope.BLINDED,
    authorized_tasks: [AuthorizedTask.VIEW_INVENTORY, AuthorizedTask.ADMINISTER_IP],
    pi_approved: true,
    training_verified: true,
    restrictions: []
  };

  const unblindedPharmacist: ActorDelegationContext = {
    is_active: true,
    role: PharmacyRole.UNBLINDED_PHARMACIST,
    blind_scope: BlindScope.UNBLINDED,
    authorized_tasks: [AuthorizedTask.VIEW_UNBLINDED_INVENTORY, AuthorizedTask.RECONCILE_ACCOUNTABILITY, AuthorizedTask.VIEW_TREATMENT_ASSIGNMENT, AuthorizedTask.QUARANTINE_IP],
    pi_approved: true,
    training_verified: true,
    restrictions: []
  };

  const blindedPI: ActorDelegationContext = {
    is_active: true,
    role: PharmacyRole.PI,
    blind_scope: BlindScope.BLINDED,
    authorized_tasks: [AuthorizedTask.VIEW_INVENTORY, AuthorizedTask.DISPENSE_IP],
    pi_approved: true,
    training_verified: true,
    restrictions: []
  };

  test("A. Blinded coordinator sees IP blocked without kit, lot, or unblinded rationale (Redaction)", () => {
    const view = resolvePharmacyViewForActor(blindedCoordinator, mockUnblindedEvent);
    expect(view.kit_id).toBeNull();
    expect(view.lot_number).toBe(BlindScope.SYSTEM_REDACTED);
    expect(view.treatment_assignment).toBe(BlindScope.SYSTEM_REDACTED);
    expect(view.unblinded_sponsor_note).toBe(BlindScope.SYSTEM_REDACTED);
    expect(view.unblinded_preparation_instructions).toBe(BlindScope.SYSTEM_REDACTED);
    expect(view.event_type).toBe(PharmacyEventType.SPONSOR_RELEASE);
  });

  test("B. Blinded coordinator cannot view active/placebo in evidence payload", () => {
    const view = resolvePharmacyViewForActor(blindedCoordinator, mockUnblindedEvent);
    expect(view.source_evidence.active_placebo_indicator).toBe(BlindScope.SYSTEM_REDACTED);
  });

  test("C. Unblinded pharmacist can view treatment assignment", () => {
    const view = resolvePharmacyViewForActor(unblindedPharmacist, mockUnblindedEvent);
    expect(view.treatment_assignment).toBe("Active");
    expect(view.unblinded_sponsor_note).toBe("Patient randomized to Arm A. Release quarantine.");
  });

  test("D. Blinded PI cannot approve unblinded accountability reconciliation", async () => {
    const canApprove = await validateDelegationPolicyForAction(blindedPI, AuthorizedTask.RECONCILE_ACCOUNTABILITY);
    expect(canApprove).toBe(false); // Fails hard guardrail
  });

  test("E. Unblinded pharmacist can approve quarantine workflow", async () => {
    const canApprove = await validateDelegationPolicyForAction(unblindedPharmacist, AuthorizedTask.QUARANTINE_IP);
    expect(canApprove).toBe(true);
  });

  test("F. Sponsor release note is redacted for blinded staff", () => {
    const view = resolvePharmacyViewForActor(blindedPI, mockUnblindedEvent);
    expect(view.unblinded_sponsor_note).toBe(BlindScope.SYSTEM_REDACTED);
  });

  test("G. Blinded inventory view exposes no lot number, kit IDs, kit-state keys, or treatment assignment", () => {
    const blindedView = resolveInventoryStateViewForActor(blindedPI, mockInventoryState) as BlindedInventoryStateView;
    const serialized = JSON.stringify(blindedView);

    expect("lot_number" in blindedView).toBe(false);
    expect("kit_states" in blindedView).toBe(false);
    expect("treatment_assignments" in blindedView).toBe(false);
    expect(serialized).not.toContain("LOT-A");
    expect(serialized).not.toContain("KIT-999");
    expect(serialized).not.toContain("Active");
    expect(blindedView.medication_dispensed).toBe(false);
    expect(blindedView.inventory_action_exists).toBe(true);
    expect(blindedView.masked_status).toBe("IP_STATUS_MASKED");
    expect(blindedView.allowed_operational_status).toBe("inventory_action_pending");
  });

  test("H. Blinded inventory view cannot infer kit count by object keys", () => {
    const blindedView = resolveInventoryStateViewForActor(blindedCoordinator, mockInventoryState);
    expect(Object.keys(blindedView)).toEqual([
      "blind_scope",
      "medication_dispensed",
      "inventory_action_exists",
      "masked_status",
      "allowed_operational_status"
    ]);
  });

  test("I. Unblinded actor can see full inventory state", () => {
    const unblindedView = resolveInventoryStateViewForActor(unblindedPharmacist, mockInventoryState) as InventoryState;
    expect(unblindedView.lot_number).toBe("LOT-A");
    expect(unblindedView.kit_states["KIT-999"]).toBe("AVAILABLE");
    expect(unblindedView.treatment_assignments!["KIT-999"]).toBe("Active");
  });

  test("J. Unauthorized actor is blocked from unblinded actions", () => {
    expect(() =>
      assertPharmacyActionAuthorized(blindedCoordinator, AuthorizedTask.RECEIVE_IP)
    ).toThrow("Pharmacy access denied: task is not delegated.");
  });

});
