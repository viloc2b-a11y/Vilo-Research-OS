export type PharmacyActivationStatus = "draft" | "crc_review" | "active" | "inactive";

export type PharmacyRuntimeBlueprintSource =
  | "DOCUMENT_CENTER"
  | "DOCUMENT_READER"
  | "MANUAL_EXCEPTION";

export interface PharmacyRuntimeBlueprint {
  blueprint_id: string;
  organization_id: string;
  study_id: string;
  site_id: string;
  source: PharmacyRuntimeBlueprintSource;
  document_center_id: string;
  document_reader_run_id: string;
  crc_review_completed: boolean;
  activation_status: PharmacyActivationStatus;
  activated_at: string | null;
  activated_by: string | null;
}

export interface PharmacyBlueprintActivationGate {
  is_active: boolean;
  reason: string | null;
}

export type Phase1ReceiptExpectationSource =
  | "ACTIVATED_BLUEPRINT"
  | "MANUAL_EXCEPTION";

export interface Phase1ReceiptExpectation {
  expectation_id: string;
  blueprint_id: string;
  shipment_id: string;
  lot_number: string;
  kit_id: string | null;
  expected_quantity: number;
  expected_condition: "intact" | "damaged" | "unknown";
  expected_location_id: string | null;
  source: Phase1ReceiptExpectationSource;
  manual_exception_reason?: string;
}

export type Phase1ReceiptCondition = "intact" | "damaged" | "missing" | "extra" | "mismatched";

export interface Phase1ReceiptItemInput {
  expectation_id: string | null;
  kit_id: string | null;
  lot_number: string;
  received_quantity: number;
  condition: Phase1ReceiptCondition;
  location_id: string | null;
  discrepancy_reason?: string;
}

export interface Phase1ReceiptInput {
  receipt_id: string;
  shipment_id: string;
  organization_id: string;
  study_id: string;
  site_id: string;
  received_by: string;
  occurred_at: string;
  recorded_at: string;
  signature_id: string;
  document_ids: string[];
  blueprint: PharmacyRuntimeBlueprint;
  expectations: Phase1ReceiptExpectation[];
  items: Phase1ReceiptItemInput[];
}

export type Phase1LedgerEventType =
  | "shipment_expected"
  | "receipt_verified"
  | "receipt_quarantined"
  | "receipt_discrepancy_recorded"
  | "inventory_location_assigned"
  | "receipt_reversed"
  | "receipt_superseded"
  | "kit_quarantined";

export type Phase1CorrectionScope =
  | "receipt_event"
  | "inventory_foundation_event"
  | "accountability_foundation_event";

export interface Phase1LedgerEvent {
  event_id: string;
  organization_id: string;
  study_id: string;
  site_id: string;
  event_type: Phase1LedgerEventType;
  event_version: 1;
  occurred_at: string;
  recorded_at: string;
  recorded_by: string;
  source_entity_type: "shipment" | "receipt" | "correction" | "inventory";
  source_entity_id: string;
  kit_id: string | null;
  lot_number: string;
  location_id: string | null;
  quantity_delta: number;
  status_delta: "available" | "quarantined" | "discrepant" | "location_assigned" | "reversed";
  payload: Record<string, unknown>;
  reverses_event_id: string | null;
  supersedes_event_id: string | null;
  signature_id: string;
  document_ids: string[];
  record_hash: string;
}

export interface Phase1CorrectionInput {
  correction_id: string;
  target_event: Phase1LedgerEvent;
  corrected_event: Omit<
    Phase1LedgerEvent,
    "event_id" | "record_hash" | "reverses_event_id" | "supersedes_event_id"
  >;
  scope: Phase1CorrectionScope;
  reason: string;
  justification: string;
  corrected_by: string;
  corrected_at: string;
  signature_id: string;
  document_ids: string[];
}

export interface Phase1InventoryKitState {
  kit_id: string;
  lot_number: string;
  location_id: string | null;
  status: "available" | "quarantined" | "discrepant" | "reversed";
  quantity: number;
  last_event_id: string;
}

export interface Phase1DerivedInventoryState {
  organization_id: string;
  study_id: string;
  site_id: string;
  total_received: number;
  available: number;
  quarantined: number;
  discrepant: number;
  by_kit: Record<string, Phase1InventoryKitState>;
  by_lot: Record<string, { available: number; quarantined: number; discrepant: number }>;
  last_event_id: string | null;
}
