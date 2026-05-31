export enum PharmacyEventType {
  IP_RECEIVED = "IP_RECEIVED",
  IP_RELEASED = "IP_RELEASED",
  IP_QUARANTINED = "IP_QUARANTINED",
  IP_DISPENSED = "IP_DISPENSED",
  IP_ADMINISTERED = "IP_ADMINISTERED",
  IP_RETURNED = "IP_RETURNED",
  IP_DESTROYED = "IP_DESTROYED",
  IP_MISSING = "IP_MISSING",
  TEMP_EXCURSION = "TEMP_EXCURSION",
  SPONSOR_RELEASE = "SPONSOR_RELEASE",
  INVENTORY_RECONCILIATION = "INVENTORY_RECONCILIATION",
  ACCOUNTABILITY_DISCREPANCY = "ACCOUNTABILITY_DISCREPANCY"
}

export enum EventApprovalStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
}

export enum EventSourceType {
  IRT_REPORT = "IRT_REPORT",
  MANUAL_LOG = "MANUAL_LOG",
  SCANNED_DOCUMENT = "SCANNED_DOCUMENT",
  TEMPERATURE_DEVICE = "TEMPERATURE_DEVICE",
  SPONSOR_EMAIL = "SPONSOR_EMAIL",
  USER_ENTRY = "USER_ENTRY"
}

export enum CorrectionType {
  VOID_EVENT = "VOID_EVENT",
  CORRECT_QUANTITY = "CORRECT_QUANTITY",
  CORRECT_KIT_ID = "CORRECT_KIT_ID",
  CORRECT_EVENT_TIME = "CORRECT_EVENT_TIME",
  CORRECT_STATUS = "CORRECT_STATUS"
}

export interface PharmacyEventCorrection {
  correction_type: CorrectionType;
  supersedes_event_id: string; // The ID of the original event being corrected/voided
  correction_reason: string;
  corrected_by: string; // actor_id
  corrected_at: string; // ISO8601 Timestamp
}

export interface PharmacyEvent {
  event_id: string;
  organization_id: string;
  study_id: string;
  site_id: string;
  kit_id: string | null;
  lot_number: string;
  subject_id: string | null;
  event_type: PharmacyEventType;
  event_source_type: EventSourceType; 
  event_time: string; // ISO8601
  quantity: number;
  unit: string;
  
  // Unblinded / Restricted Fields
  treatment_assignment?: string; // e.g., 'Active', 'Placebo'
  unblinded_preparation_instructions?: string;
  unblinded_sponsor_note?: string; 

  source_document_id: string;
  source_row: number;
  source_evidence: Record<string, unknown>;
  actor_id: string;
  delegation_assignment_id: string | null;
  approval_status: EventApprovalStatus;
  correction?: PharmacyEventCorrection; 
  created_at: string; // ISO8601
}
