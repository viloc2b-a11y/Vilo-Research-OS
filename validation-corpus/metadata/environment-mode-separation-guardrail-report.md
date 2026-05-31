# Environment Mode Separation Guardrail Report

## 1. Overview
The Vilo OS environment mode separation has been fully implemented. The system now strictly differentiates between `VALIDATION_MODE` (used for internal benchmarks and masking) and `PRODUCTION_MODE` (used for live hospital/clinical environments).

This guardrail guarantees that sanitized test data cannot leak into live production, and production systems cannot accidentally ingest validation corpus assets as "real" clinical data.

## 2. Mode Configurations Implemented

### 2.1 VALIDATION_MODE (Default)
- **Identity:** Forces sanitized identifiers.
- **Guardrails:** Rejects any `SAVE_PRODUCTION_RUNTIME` operations. Cannot mutate production databases.
- **Banner:** *"Sanitized validation mode. Outputs are not production truth."*

### 2.2 PRODUCTION_MODE
- **Identity:** Preserves real identifiers (Protocol IDs, Sponsors, Compound names, Site/PI metadata). No masking logic is applied to the extraction pipeline.
- **Guardrails:** Rejects any input path pointing to the `validation-corpus/` or containing strings like `PROTOCOL_A` or `SPONSOR_A`. Requires valid runtime database foreign keys (`organization_id`, `study_id`).
- **Banner:** *"Production mode. Real identifiers preserved. Coordinator review required before runtime/source publication."*

## 3. Activation Gateway & Audit Logging
The system does not allow automatic switching. To move from Validation to Production, the `enableProductionMode()` action must be called.
- **Confirmation Requirement:** Requires an explicit boolean confirmation (`explicitConfirmation: true`).
- **Audit Logging:** Every switch generates an immutable log entry detailing `changed_by`, `changed_at`, `from_mode`, `to_mode`, and the `reason`.

## 4. Test Suite Coverage
Test coverage in `tests/environment-mode.test.ts` successfully asserts the following rules:
- **Test A:** Validation cannot write production outputs (Throws Error).
- **Test B:** Production rejects sanitized corpus inputs (Throws Error).
- **Test C/D:** Output Identity Policy enforces real identifier preservation in PROD.
- **Test E:** Mode switch requires explicit admin confirmation (Throws Error if false).

## 5. Readiness Assessment
**Environment Mode Separation: `READY`**

**Conclusion:**
The architecture strictly enforces isolation between simulated validation flows and live clinical production data. The ingestion pipeline is protected against test-data contamination. Vilo OS is ready for live-fire production document processing.
