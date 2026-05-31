export type SubjectSection = "GENERAL" | "VISITS" | "ADVERSE_EVENTS" | "MEDICAL_CONDITIONS" | "CONCOMITANT_MEDICATIONS" | "ALLERGIES" | "SURGICAL_HISTORY" | "PROGRESS_NOTES" | "DOCUMENTS" | "PROTOCOL_DEVIATIONS" | "EMERGENCY_CONTACTS" | "AUDIT_TRAIL";

export type ControlledTermValue = {
  code: string | null;
  label: string;
  sourceLibrary: string;
  freeTextOverride: boolean;
};

export interface AdverseEvent {
  id: string;
  eventTerm: ControlledTermValue;
  onsetDate: string;
  endDate?: string;
  ongoing: boolean;
  severity: ControlledTermValue;
  seriousness: ControlledTermValue;
  expectedness: ControlledTermValue;
  relatedness: ControlledTermValue;
  actionTaken: ControlledTermValue;
  outcome: ControlledTermValue;
  eventType: ControlledTermValue;
  status: string;
}

export interface MedicalCondition {
  id: string;
  diagnosis: ControlledTermValue;
  onsetDate: string;
  endDate?: string;
  ongoing: boolean;
  severity: string;
  notes?: string;
}

export interface ConcomitantMedication {
  id: string;
  medication: ControlledTermValue;
  dose: string;
  route: ControlledTermValue;
  frequency: ControlledTermValue;
  doseUnit: ControlledTermValue;
  startDate: string;
  stopDate?: string;
  ongoing: boolean;
  indication: string;
}

export interface Allergy {
  id: string;
  allergyType: string;
  allergen: ControlledTermValue;
  reaction: ControlledTermValue;
  severity: string;
  notes?: string;
}

export interface SurgicalHistory {
  id: string;
  procedure: ControlledTermValue;
  date: string;
  outcome: string;
  complications?: string;
  notes?: string;
}

export interface ProgressNote {
  id: string;
  note: string;
  category: string;
  createdBy: string;
  createdAt: string;
}

export interface ProtocolDeviation {
  id: string;
  description: string;
  date: string;
  category: string;
  rootCause: string;
  capa?: string;
  status: "CONFIRMED"; // Only confirmed are allowed in Subject Runtime
}

export interface SubjectDocument {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  notes?: string;
}
