# Vilo OS RBAC and Blinding Matrix (H2)

Scope: This document audits all server-side permission and blinding enforcement paths. It focuses on role-based access control (RBAC), organization membership, study ownership, and the strict protection of unblinded/sensitive data.

## Role matrix
The following roles are evaluated for server-side assertions:
- `org_admin`: Organization Administrator
- `investigator`: Principal or Sub-Investigator (Signature Authority)
- `coordinator`: Clinical Research Coordinator
- `unblinded_staff`: Unblinded Pharmacist / Independent Unblinded Staff
- `source_manager`: Source Builder / Publisher
- `monitor`: CRA / Monitor (Read-Only)

## 1. Study and Organization Setup

### Admin User/RBAC Role Mutations
- **Action/Route/RPC**: `lib/admin/users/actions.ts` (add member, update roles, deactivate user)
- **Current Guard Implementation**: Organization Owner/Admin checks (`isOrgAdminForOrganization`).
- **Missing Guard Risks**: Adding unblinded roles without cross-checking blinding boundaries; deactivated users retaining active sessions/tokens for clinical mutation.
- **Blinded Data Exposure Risk**: P0 if an admin accidentally grants unblinded access to a blinded coordinator.
- **Recommended Permission Model**: Require secondary authorization for unblinded role assignment. 
- **Required Server-Side Assertions**: Assert `isOrgAdminForOrganization`. Assert target user cannot escalate to `unblinded_staff` if they have signed blinded documents.
- **Role Matrix**: `org_admin` only.
- **Severity**: P0

## 2. Clinical and Subject Profile Access

### Subject General & Enrollment Update
- **Action/Route/RPC**: `updateSubjectGeneralAction`, `lib/subject/subject-chart/actions.ts`
- **Current Guard Implementation**: `canMutateOrganizationData`. Unblinded fields checked with `canManageUnblindedData`.
- **Missing Guard Risks**: Accidental return of unblinded fields in generic profile reads or RPC responses.
- **Blinded Data Exposure Risk**: P0 for `randomization_arm`, treatment assignment, and kit/IP fields.
- **Recommended Permission Model**: Split unblinded field updates into a separate server action with distinct role guards.
- **Required Server-Side Assertions**: Assert `canManageUnblindedData` before touching `randomization_arm` or IP assignment.
- **Role Matrix**: `unblinded_staff` for randomization fields; `coordinator`/`investigator` for blinded profile.
- **Severity**: P0

### Patient Profile Server Actions
- **Action/Route/RPC**: `lib/subject/patient-profile/actions.ts`
- **Current Guard Implementation**: Org access assumptions.
- **Missing Guard Risks**: Tenancy leak (reading profiles from another org).
- **Blinded Data Exposure Risk**: Low, unless profile contains unblinded concomitant medications.
- **Recommended Permission Model**: Standard `canMutateOrganizationData` with explicit `org_id` match.
- **Required Server-Side Assertions**: Assert `org_id` matches user's active org.
- **Role Matrix**: `coordinator`, `investigator`, `unblinded_staff`.
- **Severity**: P1

## 3. Visit and Procedure Runtime

### Visit Check-In and Status Mutation
- **Action/Route/RPC**: `checkInVisit`, `lib/actions/check-in-visit.ts`
- **Current Guard Implementation**: Authenticated user. Org/role permission often deferred to UI or read paths.
- **Missing Guard Risks**: Status mutation by unauthorized monitors or cross-org users.
- **Blinded Data Exposure Risk**: N/A
- **Recommended Permission Model**: Enforce `canMutateOrganizationData`.
- **Required Server-Side Assertions**: Assert `org_id` and role capabilities in the server action wrapper before RPC.
- **Role Matrix**: `coordinator`, `investigator`, `unblinded_staff`.
- **Severity**: P1

### Procedure Signature (Investigator/Coordinator)
- **Action/Route/RPC**: `signProcedureAction`, `signProcedure`, visit closeout signatures
- **Current Guard Implementation**: `canSignClinicalSource` or `canSignClinicalSourceForRole`.
- **Missing Guard Risks**: Signing unblinded procedures without `canViewUnblindedData`. Coordinator signing as Investigator.
- **Blinded Data Exposure Risk**: P0 if investigator can view/sign unblinded IP dispensing source.
- **Recommended Permission Model**: Strict bipartite signature roles. Unblinded source strictly blocked from blinded investigators.
- **Required Server-Side Assertions**: Assert `canSignClinicalSource`. If procedure is unblinded, assert `canViewUnblindedData`.
- **Role Matrix**: `investigator` (PI/Sub-I), `coordinator`, `unblinded_staff` (for IP).
- **Severity**: P0

### Procedure PDF Export
- **Action/Route/RPC**: `app/api/procedure-executions/[id]/pdf/route.ts`
- **Current Guard Implementation**: View permissions.
- **Missing Guard Risks**: PDF generation of unblinded source for a blinded user.
- **Blinded Data Exposure Risk**: P0 if PDF includes unblinded fields and is downloadable by blinded staff.
- **Recommended Permission Model**: Re-verify unblinded access before rendering PDF payload.
- **Required Server-Side Assertions**: Assert `canViewUnblindedData` if procedure definition is flagged as unblinded.
- **Role Matrix**: All authorized readers (dependent on blinding).
- **Severity**: P0

## 4. Source Capture and Review

### Source Capture Open/Save/Submit
- **Action/Route/RPC**: `saveCaptureDraftAction`, `submitCaptureAction`
- **Current Guard Implementation**: `canManageSourceDocuments` or `canEditClinicalSource`.
- **Missing Guard Risks**: Blinded staff executing unblinded source.
- **Blinded Data Exposure Risk**: P0.
- **Recommended Permission Model**: Require `canManageUnblindedData` on the capture API route if procedure is unblinded.
- **Required Server-Side Assertions**: Assert `canEditClinicalSource`. If unblinded, assert `canManageUnblindedData`.
- **Role Matrix**: `coordinator`, `investigator`, `unblinded_staff`.
- **Severity**: P0

### Source Response Read API Routes
- **Action/Route/RPC**: `app/api/source/response-set/[id]/route.ts`
- **Current Guard Implementation**: Permission assumptions on organizational boundaries.
- **Missing Guard Risks**: Leakage of unblinded response data to blinded monitors/coordinators.
- **Blinded Data Exposure Risk**: P0 for network-level data extraction.
- **Recommended Permission Model**: API layer must strip unblinded response sets unless requester has unblinded role.
- **Required Server-Side Assertions**: Assert blinding boundary on read.
- **Role Matrix**: All authorized readers.
- **Severity**: P0

## 5. Source Pipeline and Artifacts

### Source Builder Draft Create/Save/Delete
- **Action/Route/RPC**: `lib/source-builder/draft-actions-server.ts`
- **Current Guard Implementation**: Expected `canPrepareSourceDrafts` or `canManageSourceDocuments`.
- **Missing Guard Risks**: Coordinators deleting global source drafts.
- **Blinded Data Exposure Risk**: Low, source templates generally do not contain PHI/unblinded runtime data.
- **Recommended Permission Model**: Dedicated source builder role.
- **Required Server-Side Assertions**: Assert `canPrepareSourceDrafts`.
- **Role Matrix**: `source_manager`.
- **Severity**: P1

### Intake Review and Publish Snapshot Pipeline
- **Action/Route/RPC**: `lib/protocol-intake-publish-prep/actions.ts`
- **Current Guard Implementation**: `canPrepareSourceDrafts`.
- **Missing Guard Risks**: Unauthorized publish candidate approval altering clinical runtime execution rules.
- **Blinded Data Exposure Risk**: Low.
- **Recommended Permission Model**: Distinct publish authority (e.g., `canPublishSource`).
- **Required Server-Side Assertions**: Assert `canPublishSource` for snapshot and candidate approval.
- **Role Matrix**: `source_manager` / `org_admin`.
- **Severity**: P1

## 6. Operational Events

### Operational Events Visibility
- **Action/Route/RPC**: Operational calendar and audit views.
- **Current Guard Implementation**: Read models.
- **Missing Guard Risks**: Event log containing unblinded subjects' randomization status or IP assignment details.
- **Blinded Data Exposure Risk**: P0 if `operational_events` payload/metadata leaks treatment assignment.
- **Recommended Permission Model**: Event payload redaction for blinded users or strict event type filtering.
- **Required Server-Side Assertions**: Assert `canViewUnblindedData` if event type is `external_randomization_recorded` or unblinded IP dispense.
- **Role Matrix**: All authorized readers.
- **Severity**: P0
