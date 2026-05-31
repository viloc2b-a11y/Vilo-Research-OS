import { PharmacyRuntimeBlueprint } from "./phase1-domain";
import { evaluatePharmacyBlueprintActivation } from "./phase1-blueprint-gate";

export type PharmacyDocumentRole =
  | "packing_slip"
  | "depot_shipment_notice"
  | "chain_of_custody"
  | "receipt_confirmation"
  | "discrepancy_evidence"
  | "quarantine_evidence"
  | "correction_support";

export interface PharmacyDocumentDependency {
  role: PharmacyDocumentRole;
  required: boolean;
  document_id: string | null;
}

export interface PharmacyDocumentDependencyCheck {
  can_activate_runtime: boolean;
  missing_required_roles: PharmacyDocumentRole[];
  dependencies: PharmacyDocumentDependency[];
}

export function evaluatePharmacyDocumentDependencies(
  blueprint: PharmacyRuntimeBlueprint,
  dependencies: PharmacyDocumentDependency[]
): PharmacyDocumentDependencyCheck {
  const activationGate = evaluatePharmacyBlueprintActivation(blueprint);
  const missingRequiredRoles = dependencies
    .filter((dependency) => dependency.required && !dependency.document_id)
    .map((dependency) => dependency.role);

  return {
    can_activate_runtime: activationGate.is_active && missingRequiredRoles.length === 0,
    missing_required_roles: missingRequiredRoles,
    dependencies
  };
}

export function requiredPhase1ReceiptDocumentRoles(): PharmacyDocumentRole[] {
  return ["packing_slip", "depot_shipment_notice"];
}

export function requiredPhase1CorrectionDocumentRoles(): PharmacyDocumentRole[] {
  return ["correction_support"];
}
