import {
  Phase1ReceiptExpectation,
  PharmacyBlueprintActivationGate,
  PharmacyRuntimeBlueprint
} from "./phase1-domain";

export function evaluatePharmacyBlueprintActivation(
  blueprint: PharmacyRuntimeBlueprint | null | undefined
): PharmacyBlueprintActivationGate {
  if (!blueprint) {
    return { is_active: false, reason: "Pharmacy Runtime Blueprint is missing." };
  }

  if (!blueprint.document_center_id) {
    return { is_active: false, reason: "Document Center source is missing." };
  }

  if (!blueprint.document_reader_run_id) {
    return { is_active: false, reason: "Document Reader run is missing." };
  }

  if (!blueprint.crc_review_completed) {
    return { is_active: false, reason: "CRC review is not completed." };
  }

  if (blueprint.activation_status !== "active") {
    return { is_active: false, reason: "Pharmacy Runtime Blueprint is not active." };
  }

  return { is_active: true, reason: null };
}

export function assertPharmacyBlueprintActive(blueprint: PharmacyRuntimeBlueprint): void {
  const gate = evaluatePharmacyBlueprintActivation(blueprint);
  if (!gate.is_active) {
    throw new Error(gate.reason ?? "Pharmacy Runtime Blueprint is not active.");
  }
}

export function assertReceiptExpectationsFromActiveBlueprint(
  blueprint: PharmacyRuntimeBlueprint,
  expectations: Phase1ReceiptExpectation[]
): void {
  assertPharmacyBlueprintActive(blueprint);

  for (const expectation of expectations) {
    if (expectation.blueprint_id !== blueprint.blueprint_id) {
      throw new Error(`Receipt expectation ${expectation.expectation_id} is not linked to active blueprint.`);
    }

    if (expectation.source === "MANUAL_EXCEPTION" && !expectation.manual_exception_reason?.trim()) {
      throw new Error(`Manual exception expectation ${expectation.expectation_id} requires justification.`);
    }
  }
}
