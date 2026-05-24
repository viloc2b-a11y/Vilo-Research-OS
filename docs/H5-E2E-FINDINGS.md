# H5 Phase 1: End-to-End Operational Findings

## Overview
This document inventories the operational state of the Vilo OS clinical runtime following H4 DB-level hardening. It assesses whether real-world execution by coordinators and investigators is safe, deterministic, and functionally complete.

**Crucial Finding:** Thanks to H3 and H4 hardening, **zero P0 runtime corruption vectors were found.** The database and TypeScript layers safely reject destructive, duplicate, or out-of-sequence operations. 

However, several **P1 (Operational Blockers)** and **P2 (UX/Consistency)** issues exist because the application layer has not been fully adapted to catch and gracefully handle the strict DB-level exceptions, or because edge-case recovery flows are missing.

---

## 1. Protocol Intake & Preparation
*   **Flow 1-5: Study Setup, Intake, Publish Prep, Snapshot Creation**
    *   **Expected:** Admin maps protocol, reviews schema, and creates immutable snapshot.
    *   **Actual:** Safe and functional. Snapshots are immutable.
    *   **Blocker Severity:** None (Safe)

## 2. Subject Lifecycle
*   **Flow 6: Subject Enrollment**
    *   **Expected:** Coordinator enrolls subject. Duplicate clicks are blocked.
    *   **Actual:** H3 OCC (`expected_updated_at`) blocks duplicate enrollment gracefully.
    *   **Blocker Severity:** None (Safe)
*   **Flow 7: External Randomization**
    *   **Expected:** Unblinded staff records randomization once. 
    *   **Actual:** H3 OCC blocks duplicate recording.
    *   **Blocker Severity:** None (Safe)

## 3. Visit Execution Runtime
*   **Flow 8: Visit Execution Initiation (Status changes)**
    *   **Expected:** Coordinator clicks "Check In" or "Start Visit". If visit is cancelled/locked elsewhere, UI informs them.
    *   **Actual:** DB trigger securely blocks transitions out of terminal states (H4). **However**, the Next.js Server Action (`updateVisitStatus`) does not catch the Postgres exception (`visit_status % is terminal`) to return a structured error. It results in an unhandled 500 error to the client.
    *   **Blocker Severity:** **P2 (UX Consistency)** - Database is safe, but UI crashes instead of recovering gracefully.

*   **Flow 9: Procedure Execution**
    *   **Expected:** Procedure executed and marked complete. Deleting an executing procedure is blocked.
    *   **Actual:** DB triggers (H4) block deletion if not pending. Safe.
    *   **Blocker Severity:** None (Safe)

*   **Flow 10: Source Capture**
    *   **Expected:** e-Source is captured. Submitting locks it.
    *   **Actual:** DB enforces `is_submitted` append-only correction chains (H4). 
    *   **Blocker Severity:** None (Safe)

## 4. Closeout & Integrity
*   **Flow 11: Coordinator Signature**
    *   **Expected:** Coordinator signs progress note. Deletion is blocked.
    *   **Actual:** DB enforces delete protection post-signature.
    *   **Blocker Severity:** None (Safe)

*   **Flow 12: Investigator Review/Signature**
    *   **Expected:** Investigator signs after coordinator.
    *   **Actual:** TS guards (H4 Phase 1) securely enforce signature sequence.
    *   **Blocker Severity:** None (Safe)

*   **Flow 13: Visit Completion/Lock**
    *   **Expected:** RPCs `complete_visit` and `lock_visit` promote procedure execution status and lock visit.
    *   **Actual:** DB triggers actively allow this specific valid transition while blocking others. Safe.
    *   **Blocker Severity:** None (Safe)

*   **Flow 14: Reopen Flow**
    *   **Expected:** Coordinator can correct a completed visit before PI lock.
    *   **Actual:** Currently, there is an RPC (`reopen_visit_investigator_closeout`), but the UI pathway for a coordinator to systematically request a reopen (un-complete) a procedure or visit with a mandatory audit reason is missing or brittle.
    *   **Blocker Severity:** **P1 (Operational Blocker)** - Clinical reality dictates mistakes happen; without an audited reopen workflow, coordinators are permanently stuck.

*   **Flow 15: PDF Export**
    *   **Expected:** PI can download immutable PDF of source data.
    *   **Actual:** eCRF/PDF snapshot generation is either incomplete or disconnected from the final `lock_visit` action.
    *   **Blocker Severity:** **P1 (Operational Blocker)** - Regulatory requirement for site monitoring files.

*   **Flow 16: Audit/Event Visibility**
    *   **Expected:** Monitors can view append-only `operational_events`.
    *   **Actual:** DB fully protects the events, but the Clinical Profile / Subject Chart lacks a unified "Audit Trail" dashboard for coordinators and monitors to trace these events securely.
    *   **Blocker Severity:** **P2 (UX Consistency / Missing Feature)**

---

## Recommended Execution Order for Fixes

1.  **P1: Implement Formal Audited Reopen Workflow**
    *   Add Server Action and UI modal to allow coordinators to request/perform a reopen of a `completed` (but not `locked`) procedure/visit, enforcing reason capture in `operational_events`.
2.  **P2: Graceful DB Exception Handling in Server Actions**
    *   Wrap core mutation actions (Visit Status, Procedure Status, Note Creation) in `try/catch` blocks that parse Postgres string exceptions (e.g., "Cannot mutate procedure execution because visit is locked") into standard `{ error: string }` UI responses.
3.  **P1: PDF eCRF Export Generation**
    *   Finalize the PDF export pipeline tied to the `lock_visit` lifecycle.
4.  **P2: Audit Trail Dashboard**
    *   Expose `operational_events` to the UI for monitoring transparency.
