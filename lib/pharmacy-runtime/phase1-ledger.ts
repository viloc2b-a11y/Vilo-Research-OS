import { createHash } from "crypto";
import {
  Phase1CorrectionInput,
  Phase1CorrectionScope,
  Phase1DerivedInventoryState,
  Phase1LedgerEvent,
  Phase1LedgerEventType,
  Phase1ReceiptInput,
  Phase1ReceiptItemInput
} from "./phase1-domain";
import { assertReceiptExpectationsFromActiveBlueprint } from "./phase1-blueprint-gate";

type UnsignedPhase1LedgerEvent = Omit<Phase1LedgerEvent, "record_hash">;

const CORRECTION_ALLOWED_SCOPES: Phase1CorrectionScope[] = [
  "receipt_event",
  "inventory_foundation_event",
  "accountability_foundation_event"
];

export function stablePharmacyRecordHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function buildPhase1ReceiptLedgerEvents(input: Phase1ReceiptInput): Phase1LedgerEvent[] {
  assertReceiptExpectationsFromActiveBlueprint(input.blueprint, input.expectations);

  if (!input.signature_id) {
    throw new Error("Receipt signature is required before committing ledger events.");
  }

  if (input.items.length === 0) {
    throw new Error("Receipt requires at least one physical verification item.");
  }

  return input.items.flatMap((item, index) => buildReceiptItemEvents(input, item, index));
}

export function derivePhase1InventoryState(events: Phase1LedgerEvent[]): Phase1DerivedInventoryState {
  const first = events[0];
  const state: Phase1DerivedInventoryState = {
    organization_id: first?.organization_id ?? "",
    study_id: first?.study_id ?? "",
    site_id: first?.site_id ?? "",
    total_received: 0,
    available: 0,
    quarantined: 0,
    discrepant: 0,
    by_kit: {},
    by_lot: {},
    last_event_id: null
  };

  const reversedEventIds = new Set(
    events.map((event) => event.reverses_event_id).filter((eventId): eventId is string => Boolean(eventId))
  );

  for (const event of events) {
    state.last_event_id = event.event_id;

    if (event.event_type === "receipt_reversed" || reversedEventIds.has(event.event_id)) {
      continue;
    }

    applyEventToInventory(state, event);
  }

  return state;
}

export function buildPhase1CorrectionEvents(input: Phase1CorrectionInput): Phase1LedgerEvent[] {
  if (!CORRECTION_ALLOWED_SCOPES.includes(input.scope)) {
    throw new Error("Unsupported Phase 1 correction scope.");
  }

  if (!input.reason.trim() || !input.justification.trim()) {
    throw new Error("Correction reason and justification are required.");
  }

  if (!input.signature_id) {
    throw new Error("Correction signature is required before committing reversal/superseding events.");
  }

  const reversal = withHash({
    ...input.target_event,
    event_id: `${input.correction_id}:reversal`,
    event_type: "receipt_reversed",
    occurred_at: input.corrected_at,
    recorded_at: input.corrected_at,
    recorded_by: input.corrected_by,
    source_entity_type: "correction",
    source_entity_id: input.correction_id,
    quantity_delta: input.target_event.quantity_delta * -1,
    status_delta: "reversed",
    payload: {
      correction_id: input.correction_id,
      correction_scope: input.scope,
      correction_reason: input.reason,
      correction_justification: input.justification,
      reversed_event_id: input.target_event.event_id
    },
    reverses_event_id: input.target_event.event_id,
    supersedes_event_id: null,
    signature_id: input.signature_id,
    document_ids: input.document_ids
  } satisfies UnsignedPhase1LedgerEvent);

  const superseding = withHash({
    ...input.corrected_event,
    event_id: `${input.correction_id}:superseding`,
    source_entity_type: "correction",
    source_entity_id: input.correction_id,
    reverses_event_id: null,
    supersedes_event_id: input.target_event.event_id,
    signature_id: input.signature_id,
    document_ids: input.document_ids
  } satisfies UnsignedPhase1LedgerEvent);

  return [reversal, superseding];
}

function buildReceiptItemEvents(
  input: Phase1ReceiptInput,
  item: Phase1ReceiptItemInput,
  index: number
): Phase1LedgerEvent[] {
  const eventType = resolveReceiptEventType(item);
  const statusDelta = eventType === "receipt_quarantined"
    ? "quarantined"
    : eventType === "receipt_discrepancy_recorded"
      ? "discrepant"
      : "available";

  const receiptEvent = withHash({
    event_id: `${input.receipt_id}:${index + 1}:${eventType}`,
    organization_id: input.organization_id,
    study_id: input.study_id,
    site_id: input.site_id,
    event_type: eventType,
    event_version: 1,
    occurred_at: input.occurred_at,
    recorded_at: input.recorded_at,
    recorded_by: input.received_by,
    source_entity_type: "receipt",
    source_entity_id: input.receipt_id,
    kit_id: item.kit_id,
    lot_number: item.lot_number,
    location_id: item.location_id,
    quantity_delta: item.condition === "missing" ? 0 : item.received_quantity,
    status_delta: statusDelta,
    payload: {
      shipment_id: input.shipment_id,
      expectation_id: item.expectation_id,
      condition: item.condition,
      discrepancy_reason: item.discrepancy_reason ?? null,
      document_ids: input.document_ids
    },
    reverses_event_id: null,
    supersedes_event_id: null,
    signature_id: input.signature_id,
    document_ids: input.document_ids
  } satisfies UnsignedPhase1LedgerEvent);

  if (!item.location_id || item.condition === "missing") {
    return [receiptEvent];
  }

  const locationEvent = withHash({
    ...receiptEvent,
    event_id: `${input.receipt_id}:${index + 1}:inventory_location_assigned`,
    event_type: "inventory_location_assigned",
    quantity_delta: 0,
    status_delta: "location_assigned",
    payload: {
      shipment_id: input.shipment_id,
      expectation_id: item.expectation_id,
      assigned_location_id: item.location_id
    }
  } satisfies UnsignedPhase1LedgerEvent);

  return [receiptEvent, locationEvent];
}

function resolveReceiptEventType(item: Phase1ReceiptItemInput): Phase1LedgerEventType {
  if (item.condition === "damaged") return "receipt_quarantined";
  if (item.condition === "missing" || item.condition === "extra" || item.condition === "mismatched") {
    return "receipt_discrepancy_recorded";
  }
  return "receipt_verified";
}

function applyEventToInventory(state: Phase1DerivedInventoryState, event: Phase1LedgerEvent): void {
  ensureLotBucket(state, event.lot_number);

  if (event.event_type === "receipt_verified") {
    state.total_received += event.quantity_delta;
    state.available += event.quantity_delta;
    state.by_lot[event.lot_number].available += event.quantity_delta;
  }

  if (event.event_type === "receipt_quarantined" || event.event_type === "kit_quarantined") {
    state.total_received += event.quantity_delta;
    state.quarantined += event.quantity_delta;
    state.by_lot[event.lot_number].quarantined += event.quantity_delta;
  }

  if (event.event_type === "receipt_discrepancy_recorded") {
    state.total_received += event.quantity_delta;
    state.discrepant += event.quantity_delta;
    state.by_lot[event.lot_number].discrepant += event.quantity_delta;
  }

  if (event.kit_id && event.status_delta !== "location_assigned") {
    state.by_kit[event.kit_id] = {
      kit_id: event.kit_id,
      lot_number: event.lot_number,
      location_id: event.location_id,
      status: event.status_delta,
      quantity: event.quantity_delta,
      last_event_id: event.event_id
    };
  }
}

function ensureLotBucket(state: Phase1DerivedInventoryState, lotNumber: string): void {
  state.by_lot[lotNumber] ??= { available: 0, quarantined: 0, discrepant: 0 };
}

function withHash(event: UnsignedPhase1LedgerEvent): Phase1LedgerEvent {
  const record = { ...event, record_hash: "" };
  return {
    ...event,
    record_hash: stablePharmacyRecordHash(record)
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
