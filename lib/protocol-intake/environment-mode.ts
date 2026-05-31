export type ViloReaderMode = "VALIDATION" | "PRODUCTION";

export interface ModeState {
  currentMode: ViloReaderMode;
  enabledBy: string | null;
  enabledAt: string | null;
}

export interface ModeAuditLog {
  changed_by: string;
  changed_at: string;
  from_mode: ViloReaderMode;
  to_mode: ViloReaderMode;
  reason: string;
  confirmation_provided: boolean;
}

// Memory singleton for demo purposes. In production, this binds to the backend config/env.
let currentState: ModeState = {
  currentMode: "VALIDATION", // Default is STRICTLY Validation
  enabledBy: "SYSTEM",
  enabledAt: new Date().toISOString()
};

const auditLogs: ModeAuditLog[] = [];

/**
 * Switch from Validation to Production Mode
 */
export function enableProductionMode(adminUserId: string, reason: string, explicitConfirmation: boolean): void {
  if (currentState.currentMode === "PRODUCTION") return;
  
  if (!explicitConfirmation) {
    throw new Error("Activation Failed: Explicit confirmation is required to enable PRODUCTION mode.");
  }

  // Record Audit
  auditLogs.push({
    changed_by: adminUserId,
    changed_at: new Date().toISOString(),
    from_mode: "VALIDATION",
    to_mode: "PRODUCTION",
    reason: reason,
    confirmation_provided: true
  });

  currentState = {
    currentMode: "PRODUCTION",
    enabledBy: adminUserId,
    enabledAt: new Date().toISOString()
  };
}

/**
 * Fetch current mode and display banner text.
 */
export function getEnvironmentContext(): { mode: ViloReaderMode, bannerText: string } {
  if (currentState.currentMode === "VALIDATION") {
    return {
      mode: "VALIDATION",
      bannerText: "Sanitized validation mode. Outputs are not production truth."
    };
  } else {
    return {
      mode: "PRODUCTION",
      bannerText: "Production mode. Real identifiers preserved. Coordinator review required before runtime/source publication."
    };
  }
}

/**
 * Hard Check: Validates input paths and objects before processing.
 */
export function validateIntakeInput(inputPath: string, hasRealStudyId: boolean, hasOrganizationId: boolean): void {
  if (currentState.currentMode === "PRODUCTION") {
    const forbiddenKeywords = [
      "validation-corpus", "sanitized", "structured-tables", 
      "parser-results", "PROTOCOL_A", "SPONSOR_A", "INVESTIGATIONAL_PRODUCT_A"
    ];

    for (const keyword of forbiddenKeywords) {
      if (inputPath.includes(keyword)) {
        throw new Error(`Production Guardrail Breach: Cannot process validation artifact '${keyword}' in PRODUCTION mode.`);
      }
    }

    if (!hasRealStudyId || !hasOrganizationId) {
      throw new Error("Production Guardrail Breach: Real study_id and organization_id are required in PRODUCTION mode.");
    }
  }
}

/**
 * Hard Check: Prevents validation mode from mutating production.
 */
export function validateStorageWrite(targetOperation: "SAVE_SANITIZED" | "SAVE_PRODUCTION_RUNTIME"): void {
  if (currentState.currentMode === "VALIDATION" && targetOperation === "SAVE_PRODUCTION_RUNTIME") {
    throw new Error("Validation Guardrail Breach: Cannot write to production runtime or mutate study config while in VALIDATION mode.");
  }
}
