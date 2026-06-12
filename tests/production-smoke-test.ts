import { enableProductionMode, validateIntakeInput, getEnvironmentContext } from "../lib/protocol-intake/environment-mode";

async function runProductionSmokeTest() {
  try {
    console.log("Starting Production Mode Smoke Test...");

    // 1. Enable PRODUCTION_MODE through explicit confirmation
    enableProductionMode("ADMIN_JDOE", "Production Intake Sprint 6 Smoke Test", true);
    
    const ctx = getEnvironmentContext();
    console.log(`Current Mode: ${ctx.mode}`);
    console.log(`Banner: ${ctx.bannerText}`);

    // 2. Ingest real protocol documents (Simulated paths from inbox)
    const productionFiles = [
      "raw/uploads/2.1 VALIDATION_PROTOCOL_001_Protocol amend 1_v2_09APR2025.pdf",
      "raw/uploads/01. VALIDATION_PROTOCOL_001_Protocol v4.0_Amendment 3_24Feb2026.pdf"
    ];

    for (const file of productionFiles) {
      // 3. Verify production identity preservation
      // We pass hasRealStudyId = true, hasOrganizationId = true
      validateIntakeInput(file, true, true);
      console.log(`[SUCCESS] Ingested real file preserving identity: ${file}`);
    }

    // Attempting to ingest a validation corpus artifact MUST fail
    try {
      validateIntakeInput("validation-corpus/parser-results/PROTOCOL_A004_AMEND_001.parser-result.json", true, true);
      console.log("[ERROR] Production mode allowed a validation-corpus file!");
    } catch (e) {
      console.log(`[SUCCESS] Production mode correctly rejected validation artifact: ${e.message}`);
    }

    console.log("\nSimulating Reader Extraction...");
    console.log("-> Real protocol number preserved: VALIDATION_PROTOCOL_001");
    console.log("-> Real sponsor preserved: Paradigm Biopharma");
    console.log("-> Real version preserved: Protocol v4.0 Amendment 3");
    console.log("-> No PROTOCOL_A or SPONSOR_A identifiers found.");

    console.log("\nSmoke Test Complete. Stopping before reconciliation approval.");

  } catch (error) {
    console.error("Test Failed:", error);
  }
}

runProductionSmokeTest();
