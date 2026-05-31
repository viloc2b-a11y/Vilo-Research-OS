import { 
  enableProductionMode, 
  validateIntakeInput, 
  validateStorageWrite, 
  getEnvironmentContext 
} from "../lib/protocol-intake/environment-mode";

describe("Environment Mode Separation Guardrails", () => {
  
  test("Test A: Validation cannot write production outputs", () => {
    // Current mode is VALIDATION by default
    expect(() => validateStorageWrite("SAVE_PRODUCTION_RUNTIME")).toThrow(
      "Validation Guardrail Breach: Cannot write to production runtime or mutate study config while in VALIDATION mode."
    );
  });

  test("Test E: Mode switch requires admin confirmation", () => {
    // Try to switch to PROD without explicit confirmation boolean
    expect(() => enableProductionMode("ADMIN_1", "Ready for live", false)).toThrow(
      "Activation Failed: Explicit confirmation is required to enable PRODUCTION mode."
    );
  });

  test("Test B: Production rejects sanitized corpus inputs", () => {
    // Switch to PROD successfully
    enableProductionMode("ADMIN_1", "Ready for live", true);
    
    // Attempt to load a validation corpus artifact
    expect(() => validateIntakeInput("validation-corpus/parser-results/PROTOCOL_A004.json", true, true)).toThrow(
      "Production Guardrail Breach: Cannot process validation artifact 'validation-corpus' in PRODUCTION mode."
    );
  });

  test("Test C/D: Output Identity Policy", () => {
    // Verified by banner text and state
    const ctx = getEnvironmentContext();
    expect(ctx.mode).toBe("PRODUCTION");
    expect(ctx.bannerText).toContain("Real identifiers preserved.");
  });

});
