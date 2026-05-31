import assert from "node:assert/strict";
import {
  assertPharmacyActionAuthorized,
  AuthorizedTask,
  resolvePharmacyViewForActor
} from "../lib/pharmacy-runtime/blinding-access-policy";
import { BlindScope, PharmacyRole } from "../lib/pharmacy-runtime/inventory-state-types";
import {
  buildPhase1CorrectionEvents,
  buildPhase1ReceiptLedgerEvents,
  derivePhase1InventoryState
} from "../lib/pharmacy-runtime/phase1-ledger";
import { evaluatePharmacyDocumentDependencies } from "../lib/pharmacy-runtime/phase1-document-hooks";
import {
  EventApprovalStatus,
  EventSourceType,
  PharmacyEvent,
  PharmacyEventType
} from "../lib/pharmacy-runtime/pharmacy-event-types";
import { PharmacyRuntimeBlueprint } from "../lib/pharmacy-runtime/phase1-domain";

const blueprint: PharmacyRuntimeBlueprint = {
  blueprint_id: "PBP-001",
  organization_id: "ORG-1",
  study_id: "STUDY-1",
  site_id: "SITE-1",
  source: "DOCUMENT_READER",
  document_center_id: "DOC-CENTER-1",
  document_reader_run_id: "DOC-READER-1",
  crc_review_completed: true,
  activation_status: "active",
  activated_at: "2026-05-31T12:00:00.000Z",
  activated_by: "CRC-1"
};

const receiptEvents = buildPhase1ReceiptLedgerEvents({
  receipt_id: "REC-001",
  shipment_id: "SHIP-001",
  organization_id: "ORG-1",
  study_id: "STUDY-1",
  site_id: "SITE-1",
  received_by: "CRC-1",
  occurred_at: "2026-05-31T12:05:00.000Z",
  recorded_at: "2026-05-31T12:06:00.000Z",
  signature_id: "SIG-REC-001",
  document_ids: ["DOC-PACKING-1", "DOC-DEPOT-1"],
  blueprint,
  expectations: [
    {
      expectation_id: "EXP-001",
      blueprint_id: "PBP-001",
      shipment_id: "SHIP-001",
      lot_number: "LOT-A",
      kit_id: "KIT-001",
      expected_quantity: 1,
      expected_condition: "intact",
      expected_location_id: "CAB-B",
      source: "ACTIVATED_BLUEPRINT"
    },
    {
      expectation_id: "EXP-002",
      blueprint_id: "PBP-001",
      shipment_id: "SHIP-001",
      lot_number: "LOT-A",
      kit_id: "KIT-002",
      expected_quantity: 1,
      expected_condition: "intact",
      expected_location_id: "CAB-B",
      source: "ACTIVATED_BLUEPRINT"
    }
  ],
  items: [
    {
      expectation_id: "EXP-001",
      kit_id: "KIT-001",
      lot_number: "LOT-A",
      received_quantity: 1,
      condition: "intact",
      location_id: "CAB-B"
    },
    {
      expectation_id: "EXP-002",
      kit_id: "KIT-002",
      lot_number: "LOT-A",
      received_quantity: 1,
      condition: "damaged",
      location_id: "QUARANTINE",
      discrepancy_reason: "Damaged carton at receipt."
    }
  ]
});

assert.equal(receiptEvents.some((event) => event.event_type === "receipt_verified"), true);
assert.equal(receiptEvents.some((event) => event.event_type === "receipt_quarantined"), true);
assert.equal(receiptEvents.every((event) => Boolean(event.record_hash)), true);

const inventory = derivePhase1InventoryState(receiptEvents);
assert.equal(inventory.total_received, 2);
assert.equal(inventory.available, 1);
assert.equal(inventory.quarantined, 1);

const correctionEvents = buildPhase1CorrectionEvents({
  correction_id: "COR-001",
  target_event: receiptEvents[0],
  corrected_event: {
    ...receiptEvents[0],
    location_id: "CAB-C",
    payload: {
      ...receiptEvents[0].payload,
      corrected_location_id: "CAB-C"
    }
  },
  scope: "receipt_event",
  reason: "Wrong location selected.",
  justification: "Coordinator selected Cabinet B in error; physical kit was placed in Cabinet C.",
  corrected_by: "CRC-1",
  corrected_at: "2026-05-31T12:10:00.000Z",
  signature_id: "SIG-COR-001",
  document_ids: ["DOC-CORRECTION-1"]
});

assert.equal(correctionEvents[0].event_type, "receipt_reversed");
assert.equal(correctionEvents[1].supersedes_event_id, receiptEvents[0].event_id);
assert.equal(correctionEvents.every((event) => event.signature_id === "SIG-COR-001"), true);

const documentGate = evaluatePharmacyDocumentDependencies(blueprint, [
  { role: "packing_slip", required: true, document_id: "DOC-PACKING-1" },
  { role: "depot_shipment_notice", required: true, document_id: "DOC-DEPOT-1" }
]);

assert.equal(documentGate.can_activate_runtime, true);

const blindedActor = {
  is_active: true,
  role: PharmacyRole.COORDINATOR,
  blind_scope: BlindScope.BLINDED,
  authorized_tasks: [AuthorizedTask.RECEIVE_IP],
  pi_approved: true,
  training_verified: true,
  restrictions: []
};

assert.throws(
  () => assertPharmacyActionAuthorized(blindedActor, AuthorizedTask.RECEIVE_IP),
  /unblinded action is a hard gate/
);

const eventForMasking: PharmacyEvent = {
  event_id: "EVT-MASK-1",
  organization_id: "ORG-1",
  study_id: "STUDY-1",
  site_id: "SITE-1",
  kit_id: "KIT-001",
  lot_number: "LOT-A",
  subject_id: null,
  event_type: PharmacyEventType.IP_RECEIVED,
  event_source_type: EventSourceType.SCANNED_DOCUMENT,
  event_time: "2026-05-31T12:05:00.000Z",
  quantity: 1,
  unit: "kit",
  treatment_assignment: "Active",
  source_document_id: "DOC-PACKING-1",
  source_row: 1,
  source_evidence: { active_placebo_indicator: true },
  actor_id: "CRC-1",
  delegation_assignment_id: "DOA-1",
  approval_status: EventApprovalStatus.APPROVED,
  created_at: "2026-05-31T12:06:00.000Z"
};

const masked = resolvePharmacyViewForActor(blindedActor, eventForMasking);
assert.equal(masked.kit_id, null);
assert.equal(masked.lot_number, BlindScope.SYSTEM_REDACTED);
assert.equal(masked.treatment_assignment, BlindScope.SYSTEM_REDACTED);

console.log("Pharmacy Runtime Phase 1 smoke passed.");
