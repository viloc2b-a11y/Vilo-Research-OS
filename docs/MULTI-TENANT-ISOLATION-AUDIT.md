# Multi-Tenant Isolation Audit

Date: 2026-05-19

## Scope

Reviewed the operational shell and Source API tenant boundaries for reads driven by user-controlled route IDs:

- Coordinator Command Center
- Study Workspace
- Subject Workspace
- Visit Workspace
- Operational read models
- Source API auth guard

No database migrations were added.

## Tenant Boundary

Vilo OS uses two layers of tenant isolation:

1. Supabase RLS remains the database enforcement layer.
2. Server read models and pages now apply explicit organization membership checks and `organization_id` filters where the schema exposes the column.

The app should treat route IDs (`studyId`, `subjectId`, `visitId`, `responseSetId`, `procedureExecutionId`) as untrusted until scoped through organization membership.

## Findings Fixed

### Visit Workspace

Risk: the visit page loaded a visit by ID and then used child queries for study, procedure executions, and source response sets without explicit organization filters.

Fix:

- Verifies the signed-in user belongs to the visit organization.
- Filters study banner, procedure executions, and source response sets by `organization_id`.
- Keeps validation findings scoped through already organization-scoped response sets.
- Uses the canonical study-scoped subject route for subject navigation.

### Study Workspace

Risk: the study page and study read model relied primarily on RLS after resolving `studyId`.

Fix:

- Loads `organization_id` with the study.
- Verifies organization membership before rendering.
- Filters study subjects by `organization_id`.
- Removes the extra unscoped study organization lookup.

### Subject Workspace

Risk: subject routes resolved `subjectId` under RLS but did not perform an explicit organization membership check before loading secondary panels.

Fix:

- Verifies organization membership after subject resolution.
- The workspace read model also performs the same membership check before loading visits, procedures, source sets, workflow, operational intelligence, and clinical profile links.

### Command Center / Source Engine Blockers

Risk: validation findings do not carry `organization_id`, so they must never be queried globally by status/severity alone.

Fix already present in the hardened read model:

- Fetches response sets scoped by the user's organization memberships.
- Queries blockers only by those scoped response set IDs.
- Builds blocker links using the scoped response set organization.

### Source API

Reviewed `lib/api/source/auth.ts`.

Status:

- API routes have a reusable `requireSourceApiContext`.
- Mutating Source API paths can call `requireOrganizationMember`.
- The guard checks membership through `organization_members` before accepting a requested `organization_id`.

## Validation Added

Added `scripts/validate-multi-tenant-isolation.mjs`.

This is a lightweight static safety check for the critical operational files. It is not a substitute for RLS tests, but it catches accidental removal of key membership checks and organization filters.

Run:

```bash
node scripts/validate-multi-tenant-isolation.mjs
```

## Remaining Risk / Follow-Up

- Some lower-level legacy loaders still rely on Supabase RLS when called with a single record ID. Current pages now gate those calls through organization membership first, but future callers should preserve that pattern.
- `source_response_validation_findings` appears to rely on parent `source_response_sets` for tenant scope. That is acceptable if RLS enforces the relationship, but a future schema-level `organization_id` on findings would simplify audits.
- This audit is static plus build-time validation. A production-grade tenant audit should add integration tests using two organizations, two users, and cross-tenant IDs to confirm RLS and server code fail closed together.
