# Runtime Integrity Gates (H4)

## Overview
This document outlines the strict clinical runtime integrity gates enforced within Vilo OS. The H4 phase successfully transitioned the system from trusting the application layer (Typescript) to enforcing true operational immutability and state machine transitions directly within PostgreSQL. This guarantees deterministic behavior regardless of whether a mutation is executed via a valid UI workflow or an out-of-band database access (e.g., Supabase Studio service roles).

## Protected Tables

The following critical clinical execution tables are protected:
- `visits`
- `procedure_executions`
- `source_response_sets`
- `source_responses`
- `visit_progress_notes`
- `operational_events`

## 1. TS-Layer Guards (H4 Phase 1)
Application-layer TypeScript guards prevent standard user actions from submitting invalid state transitions.

*   **Terminal States:** Visits with statuses of `locked`, `completed`, `cancelled`, or `no_show` are strictly terminal from a procedure mutation standpoint.
*   **Procedure Execution Mutability:** The `signProcedure` action explicitly checks the parent `visit_status` via a database join and blocks any signature/completion request if the visit is terminal.
*   **Signature Sequencing:** Investigator review signatures are explicitly blocked unless the underlying coordinator signature has already been applied.

## 2. DB-Level Runtime Transition Guards (Migration `0073`)
Native Postgres `BEFORE UPDATE` triggers enforce state machine transitions, rejecting physical DB updates that violate clinical workflow sequences.

*   **`visits` (`visits_runtime_guard`)**
    *   **Blocked:** Any status transition out of a terminal state (`locked`, `cancelled`, `no_show`).
    *   **Blocked:** Any status transition out of `completed` *except* to `locked`.
*   **`procedure_executions` (`procedure_executions_runtime_guard`)**
    *   **Blocked:** Any transition out of the `verified` state (verified executions are fully immutable).
    *   **Blocked:** Any mutation if the parent visit is in a terminal state (`locked`, `cancelled`, `no_show`).
    *   **Allowed Exception:** If the parent visit is `completed`, the *only* allowed mutation is transitioning the procedure execution status from `completed` to `verified` (the `lock_visit` RPC workflow).
*   **`operational_events` (`operational_events_immutability_guard`)**
    *   **Protected:** Enforces absolute append-only immutability. No updates or deletes are permitted under any circumstance, even by `SECURITY DEFINER` service roles.

## 3. DB-Level Delete Protection Guards (Migration `0074`)
Native Postgres `BEFORE DELETE` triggers prevent the destruction of clinical data via cascading deletes or direct service role intervention. Physical deletion is strictly reserved for "draft" or "scheduled" states prior to actual clinical execution.

*   **`visits` (`visits_delete_guard`)**
    *   **Blocked:** Deletion unless `visit_status = 'scheduled'`.
*   **`procedure_executions` (`procedure_executions_delete_guard`)**
    *   **Blocked:** Deletion unless `execution_status = 'pending'`.
*   **`source_response_sets` (`source_response_sets_delete_guard`)**
    *   **Blocked:** Deletion unless `status` is `'draft'` or `'archived'`.
*   **`source_responses` (`source_responses_delete_guard`)**
    *   **Blocked:** Deletion if `is_submitted = true`. Correcting data requires an append-only correction chain.
*   **`visit_progress_notes` (`visit_progress_notes_delete_guard`)**
    *   **Blocked:** Deletion if `coordinator_signature_status = 'signed'` or `investigator_review_status = 'signed'`.

## Remaining Known Gaps
While physical deletion and state machine corruption are now natively blocked, the following operational gaps remain:

1.  **Draft Garbage Collection:** While `status = 'draft'` sets and `scheduled` visits can be deleted natively, there is no automated garbage collection job to prune stale or abandoned drafts over time.
2.  **UI-Specific DB Error Translation:** If an administrator attempts to delete a subject or study containing clinical data (e.g., a `completed` visit), the database transaction will cleanly abort via the Postgres trigger exception. However, the Vilo UI may bubble this up as a generic 500 error rather than a descriptive "Cannot delete subject with executed visits" message.
3.  **Destructive Service-Role Actions Blocked:** This is a feature, not a bug, but operational administrators should be aware that even with service-role (SuperAdmin) access, destructive actions are strictly blocked by triggers except for the allowed draft/scheduled exceptions. Support engineers must follow valid logical cancellation workflows instead of attempting manual row drops.
