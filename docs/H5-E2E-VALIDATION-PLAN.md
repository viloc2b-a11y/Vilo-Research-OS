# H5 Phase 1: End-to-End Operational Validation Plan

## Goal
Validate the Vilo OS clinical execution engine as a real coordinator runtime. Ensure determinism, idempotency, and regulatory compliance across all interconnected operational flows (from Intake to Visit Lock).

## Methodology
Validation will execute complete operational flows using existing `PARA_OA_012` / `MV40618` fixtures. We will simulate adversarial and high-concurrency environments to trigger potential state machine fractures.

**Roles Simulated:**
*   Coordinator (Primary operational actor)
*   PI / Sub-I (Review and sign-off)
*   Blinded / Unblinded Staff (Permissions boundary testing)
*   Admin (Protocol Intake and Study setup)

**Attack Vectors Simulated:**
*   Stale updates / double-clicks (Optimistic Concurrency checks)
*   Out-of-order transitions (e.g., PI signing before Coordinator)
*   Destructive operations (Attempting physical DELETEs on active runtime)
*   Cross-tenant / unauthorized execution attempts
*   Mutations on locked or verified entities

## Validation Flows

### 1. Protocol Intake & Preparation
*   **Flow 1: Study Setup** (Tenant boundary, base creation)
*   **Flow 2: Protocol Intake** (Upload, parsing bounds)
*   **Flow 3: Intake Review** (Approvals, schema validation)
*   **Flow 4: Publish Prep** (Mapping procedures, schedule derivation)
*   **Flow 5: Snapshot Creation** (Immutability of protocol definition)

### 2. Subject Lifecycle
*   **Flow 6: Subject Enrollment** (Idempotency, duplication checks)
*   **Flow 7: External Randomization** (Idempotency, unblinded boundaries)

### 3. Visit Execution Runtime
*   **Flow 8: Visit Execution Initiation** (State machine `scheduled` -> `checked_in` -> `in_progress`)
*   **Flow 9: Procedure Execution** (Mapping resolution, duplication checks)
*   **Flow 10: Source Capture** (e-Source data entry, draft lock checks)

### 4. Closeout & Integrity
*   **Flow 11: Coordinator Signature** (Visit Progress Notes, operational lock)
*   **Flow 12: Investigator Review/Signature** (Role enforcement, sequence enforcement)
*   **Flow 13: Visit Completion/Lock** (RPC terminal promotion, DB triggers)
*   **Flow 14: Reopen Flow** (Strict audit trail, status rollback restrictions)
*   **Flow 15: PDF Export** (Source snapshot accuracy, eCFR generation)
*   **Flow 16: Audit/Event Visibility** (Append-only verification of `operational_events`)

## Severity Definitions
*   **P0:** Unsafe runtime corruption (Data loss, bypassed terminal states, invalid regulatory sequence)
*   **P1:** Operational blocker (Coordinator cannot physically complete a valid protocol workflow)
*   **P2:** UX/Consistency issue (Error bubbles up poorly, misleading UI state, but DB is safe)
*   **P3:** Polish (Visual misalignment, missing tooltips)
