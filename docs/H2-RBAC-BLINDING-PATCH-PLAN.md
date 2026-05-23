# H2 RBAC and Blinding Patch Plan

**Scope:** This plan strictly outlines the P0 server-side permission and blinding fixes required to harden the clinical runtime. It excludes H3 concurrency work, broad refactoring, and database migrations unless absolutely required for P0 integrity.

---

## Order of Execution

1. **Phase 1: Blinding & Data Redaction Layer** (Subject Profile, Operational Events, PDF Exports)
2. **Phase 2: Administrative Mutation Guards** (Role Assignment)
3. **Phase 3: Signature Authority** (Investigator vs. Coordinator constraints)
4. **Phase 4: Source Publish & Intake Snapshot Authority** (Source Pipeline guards)

---

## Phase 1: Blinding & Data Redaction Layer

### 1. Subject Profile General & Enrollment Updates
- **Exact Files**: `lib/subject/subject-chart/actions.ts`
- **Exact Guards to Add**: Split or strictly branch the general update logic so unblinded field updates (`randomization_arm`, kit assignments) explicitly evaluate `canManageUnblindedData`.
- **Role/Capability Required**: `unblinded_staff` (`canManageUnblindedData`).
- **Blinded-Field Redaction Rules**: Strip `randomization_arm` and unblinded IP assignments from API responses and generic profile queries unless `canViewUnblindedData` is asserted.
- **Tests/Smokes to Add**: Smoke test attempting to update randomization fields with a standard coordinator role (must 403/fail).
- **Risk if not fixed**: P0 unblinded data leakage via generic profile mutation or read payloads.

### 2. Operational Events Visibility Redaction
- **Exact Files**: `lib/ops/workspace-read-model.ts` (or relevant operational event fetching layers).
- **Exact Guards to Add**: Server-side payload redaction over the `operational_events` fetch pipeline.
- **Role/Capability Required**: Standard reader vs. `canViewUnblindedData`.
- **Blinded-Field Redaction Rules**: If an event type is `external_randomization_recorded` or involves unblinded IP dispensing, its `payload` and `metadata` must be redacted or entirely omitted for users without `canViewUnblindedData`.
- **Tests/Smokes to Add**: Smoke test fetching event logs as a blinded coordinator to assert `randomization_arm` does not appear in payloads.
- **Risk if not fixed**: P0 exposure of treatment assignment through operational audit trails.

### 3. Procedure PDF Export
- **Exact Files**: `app/api/procedure-executions/[id]/pdf/route.ts`
- **Exact Guards to Add**: Re-verify unblinded access before rendering the PDF payload if the procedure definition is flagged as unblinded.
- **Role/Capability Required**: `canViewUnblindedData` if the procedure is unblinded; otherwise standard read access.
- **Blinded-Field Redaction Rules**: Entire export is blocked for blinded users if the source is an unblinded procedure.
- **Tests/Smokes to Add**: Blinded user requesting PDF of an unblinded IP dispense (must 403).
- **Risk if not fixed**: P0 leakage of unblinded source via downloadable PDF artifacts.

---

## Phase 2: Administrative Mutation Guards

### 4. Admin User/RBAC Role Mutations
- **Exact Files**: `lib/admin/users/actions.ts`
- **Exact Guards to Add**: Target privilege cross-check. Prevent an org admin from assigning `unblinded_staff` to a user who has previously signed blinded documents in the study. Ensure deactivated users are completely blocked from executing any clinical mutation actions.
- **Role/Capability Required**: `org_admin` (`isOrgAdminForOrganization`).
- **Blinded-Field Redaction Rules**: N/A.
- **Tests/Smokes to Add**: Smoke test attempting to grant `unblinded_staff` role to an investigator who has active signed visits (must throw domain error).
- **Risk if not fixed**: P0 compliance breach by accidentally granting unblinded views to a blinded investigator.

---

## Phase 3: Signature Authority

### 5. Investigator & Coordinator Procedure Signatures
- **Exact Files**: `lib/subject/visit-runtime/actions.ts`, `lib/visit-runtime/signProcedure.ts`
- **Exact Guards to Add**: Enforce strict bipartite signature roles. Require `canSignClinicalSourceForRole` matching the intended signature tier (Investigator vs Coordinator). Block blinded investigators from signing unblinded source.
- **Role/Capability Required**: `investigator` (PI/Sub-I) or `coordinator`. `unblinded_staff` if the procedure is unblinded.
- **Blinded-Field Redaction Rules**: N/A.
- **Tests/Smokes to Add**: Smoke test coordinator attempting an investigator-level signature (must 403).
- **Risk if not fixed**: P0 regulatory invalidation if a coordinator signs PI reviews, or if an investigator signs unblinded IP administration.

---

## Phase 4: Source Publish & Intake Snapshot Authority

### 6. Intake Snapshot & Publish Candidate Authority
- **Exact Files**: `lib/protocol-intake-publish-prep/actions.ts`
- **Exact Guards to Add**: Add explicit publish authority checks on snapshot creation and candidate approvals, rather than falling back to standard source drafting permissions.
- **Role/Capability Required**: `source_manager` / `org_admin` (`canPublishSource` or equivalent top-level permission).
- **Blinded-Field Redaction Rules**: N/A.
- **Tests/Smokes to Add**: Smoke test a standard coordinator attempting to approve a publish candidate (must 403).
- **Risk if not fixed**: P0 risk of unauthorized modification to clinical runtime execution rules via unverified source publication.
