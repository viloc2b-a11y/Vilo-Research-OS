export interface InventoryState {
  organization_id: string;
  study_id: string;
  site_id: string;
  
  // Aggregate state derived purely from event sourcing
  total_received: number;
  available: number;
  dispensed: number;
  administered: number;
  returned: number;
  destroyed: number;
  quarantined: number;
  missing: number;
  unreconciled: number;
  
  // Specific Lot/Kit mapping
  lot_number: string;
  kit_states: Record<string, KitState>; // kit_id -> KitState
  
  // Unblinded Mapping
  treatment_assignments?: Record<string, string>; // kit_id -> 'Active'/'Placebo'
  
  last_calculated_at: string; // ISO8601 Timestamp of last processed event
}

export enum KitState {
  EXPECTED = "EXPECTED",
  RECEIVED = "RECEIVED",
  AVAILABLE = "AVAILABLE",
  QUARANTINED = "QUARANTINED",
  DISPENSED = "DISPENSED",
  ADMINISTERED = "ADMINISTERED",
  RETURNED = "RETURNED",
  DESTROYED = "DESTROYED",
  MISSING = "MISSING",
  EXPIRED = "EXPIRED"
}

export enum PharmacyRole {
  COORDINATOR = "COORDINATOR",
  PHARMACIST = "PHARMACIST",
  UNBLINDED_PHARMACIST = "UNBLINDED_PHARMACIST",
  PI = "PI",
  CRA = "CRA",
  SPONSOR = "SPONSOR",
  SYSTEM = "SYSTEM"
}

export enum BlindScope {
  BLINDED = "BLINDED",
  UNBLINDED = "UNBLINDED",
  SPONSOR_UNBLINDED = "SPONSOR_UNBLINDED",
  SYSTEM_REDACTED = "SYSTEM_REDACTED"
}
