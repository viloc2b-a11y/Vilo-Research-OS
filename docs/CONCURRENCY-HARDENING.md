# H3 Concurrency & Stale-State Hardening Plan

## Goal
Prevent duplicate runtime execution, stale data overwrites, double submissions, signing of stale states, and inconsistent closeout flows by enforcing robust concurrency controls, idempotency keys, and optimistic concurrency versioning across the Vilo OS clinical runtime.

---

## 1. Enrollment + Schedule Generation
*   **Current Mutation Path:** `enrollSubjectAction` -> Supabase RPC or direct insert for `study_subjects` and `visits` / `procedure_executions`.
*   **Duplicate Risk:** High. Double-clicking "Enroll" could attempt to generate duplicate schedules, duplicate subject rows, and trigger duplicate webhook/operational events.
*   **Stale-State Risk:** Low. This is primarily a creation operation.
*   **Expected-Version / Idempotency Strategy:** Implement an idempotency key (e.g., frontend-generated UUID passed as `idempotency_key` to the RPC) or utilize a strict unique constraint on `(organization_id, study_id, patient_id)` combined with an `INSERT ... ON CONFLICT DO NOTHING`.
*   **Required Guard Location:** Server action (`enrollSubjectAction`) and Supabase RPC.
*   **Test/Smoke Needed:** Submit two identical enrollment requests concurrently; verify only one succeeds and the other returns an "already enrolled" safe error.
*   **Risk Severity:** P0

## 2. External Randomization + Schedule Generation
*   **Current Mutation Path:** `randomizeSubjectAction` or external webhook integration -> updates `study_subjects` arm and triggers `generateSubjectVisitSchedule`.
*   **Duplicate Risk:** High. Concurrent external webhooks or UI double-clicks could spawn duplicate conditional visits or overwrite arm assignment.
*   **Stale-State Risk:** Medium. Concurrent updates to patient status.
*   **Expected-Version / Idempotency Strategy:** Use an idempotency key for the webhook payload. For the UI, ensure the subject's current status/version matches expectations before applying randomization.
*   **Required Guard Location:** API Route (`/api/webhooks/randomization`), Server action (`randomizeSubjectAction`), and corresponding DB functions.
*   **Test/Smoke Needed:** Fire concurrent webhook events for the same subject; confirm only the first triggers schedule generation and the second is safely ignored.
*   **Risk Severity:** P0

## 3. Source Capture Save/Submit
*   **Current Mutation Path:** `saveSourceCaptureAction` / `submitSourceCaptureAction` -> updates `source_responses` and `source_response_sets`.
*   **Duplicate Risk:** Low for saves (upserts based on key), Medium for submits (could double-submit).
*   **Stale-State Risk:** High. Two coordinators editing the same response set concurrently could overwrite each other's work (last-write-wins).
*   **Expected-Version / Idempotency Strategy:** Optimistic Concurrency Control (OCC). Require `expected_version` in the payload. The DB must reject updates if the current `version` != `expected_version`, prompting the user to reload.
*   **Required Guard Location:** Supabase RPC for saving/submitting responses, validated at the Server Action layer.
*   **Test/Smoke Needed:** Submit a save with a stale `expected_version`; assert a `STALE_WRITE_ERROR` is returned.
*   **Risk Severity:** P0

## 4. Procedure Signatures
*   **Current Mutation Path:** `signProcedureAction` -> updates `procedure_executions` signature fields and logs `operational_events`.
*   **Duplicate Risk:** Medium. Double-clicking could generate duplicate signature events.
*   **Stale-State Risk:** High. A coordinator might sign a procedure while another is concurrently modifying the underlying `source_responses`.
*   **Expected-Version / Idempotency Strategy:** The signature action must require the current `source_response_set_version`. If the underlying responses have changed since the user loaded the page, the signature must be blocked.
*   **Required Guard Location:** `signProcedureAction` and the `sign_procedure` Supabase RPC.
*   **Test/Smoke Needed:** Attempt to sign a procedure with a stale version hash/number; assert the signature is rejected.
*   **Risk Severity:** P0

## 5. Investigator Closeout
*   **Current Mutation Path:** `signInvestigatorReviewAction` -> updates `visits.status` to `signed` and records signature.
*   **Duplicate Risk:** Low.
*   **Stale-State Risk:** High. PI signs the visit while a coordinator concurrently modifies a procedure or re-opens a progress note.
*   **Expected-Version / Idempotency Strategy:** The investigator review must supply an expected checksum or combined version hash of all `procedure_executions` and `source_response_sets` within the visit.
*   **Required Guard Location:** `signInvestigatorReviewAction` and visit closeout Supabase RPC.
*   **Test/Smoke Needed:** Modify a visit procedure concurrently while a PI submits a closeout signature; assert the closeout is blocked due to stale visit state.
*   **Risk Severity:** P0

## 6. Reopen with Reason
*   **Current Mutation Path:** `reopenInvestigatorReviewAction` / `reopenCoordinatorProgressNoteAction`.
*   **Duplicate Risk:** Low.
*   **Stale-State Risk:** Medium. Concurrently reopening and modifying could lead to race conditions.
*   **Expected-Version / Idempotency Strategy:** Check `expected_status` or `expected_version` of the visit. Only allow reopening if the current DB state exactly matches the state presented to the user.
*   **Required Guard Location:** Reopen server actions.
*   **Test/Smoke Needed:** Attempt to reopen a visit that is already in a `draft` or `in_progress` state; assert a safe no-op or error.
*   **Risk Severity:** P1

## 7. Procedure Source Binding After Runtime Execution
*   **Current Mutation Path:** Updating `source_definition_versions` bindings to procedures.
*   **Duplicate Risk:** Medium.
*   **Stale-State Risk:** High. Binding a new source definition while the procedure is currently active or being executed.
*   **Expected-Version / Idempotency Strategy:** Assert that the procedure is not currently `in_progress` or `signed`. Use OCC for binding updates.
*   **Required Guard Location:** Source binding actions.
*   **Test/Smoke Needed:** Attempt to re-bind a procedure that has already captured data; assert rejection.
*   **Risk Severity:** P1

## 8. Task Materialization
*   **Current Mutation Path:** `materializeSubjectWorkflowTasks` / `subject_workflow_actions`.
*   **Duplicate Risk:** High. Concurrent triggers could spawn duplicate tasks for the same event.
*   **Stale-State Risk:** Low.
*   **Expected-Version / Idempotency Strategy:** Idempotency key based on the triggering `operational_event_id` or state hash. `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`.
*   **Required Guard Location:** Materialization pipeline/RPC.
*   **Test/Smoke Needed:** Trigger materialization twice simultaneously; confirm only one set of tasks is created.
*   **Risk Severity:** P1

## 9. Source Publish Snapshot / Final Publish Boundary
*   **Current Mutation Path:** `createSourcePackageSnapshotAction` / `publishSourcePackageFromArtifacts`.
*   **Duplicate Risk:** High. Double-clicking could generate multiple snapshots or trigger multiple publish RPCs.
*   **Stale-State Risk:** High. Publishing a package while the underlying draft is concurrently being modified.
*   **Expected-Version / Idempotency Strategy:** Publish RPC must accept an idempotency key (e.g., `draftKey_packageId`). The draft itself should lock or increment a version upon approval, and the snapshot must reference that exact version.
*   **Required Guard Location:** Publish actions and Supabase RPCs.
*   **Test/Smoke Needed:** Double-click publish; confirm second request returns idempotency hit. Modify draft concurrently with publish; confirm publish fails.
*   **Risk Severity:** P1

## 10. Admin Role Concurrent Mutation
*   **Current Mutation Path:** `updateUserRolesAction`.
*   **Duplicate Risk:** Low.
*   **Stale-State Risk:** Medium. Two admins concurrently modifying the same user's roles.
*   **Expected-Version / Idempotency Strategy:** Include `expected_role_hash` or `expected_updated_at` in the mutation. Block update if the user's roles were modified since the UI loaded.
*   **Required Guard Location:** Admin user actions.
*   **Test/Smoke Needed:** Concurrent role updates on the same user; assert the second fails with a stale state error.
*   **Risk Severity:** P2

---

## H3 Execution Order (Top P0s)
1. **Source Capture Save/Submit (Flow 3):** Implement OCC for `source_response_sets` to prevent data loss from concurrent coordinator edits.
2. **Procedure Signatures & Investigator Closeout (Flows 4 & 5):** Prevent signing of stale data by coupling signatures to `source_response_set_versions` or visit state hashes.
3. **Enrollment & External Randomization (Flows 1 & 2):** Implement strict idempotency keys to prevent duplicate subject/schedule creation.
