# Phase 2 — Schema generation results (SQL only, not applied)

**Source of truth:** `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md`  
**Generated:** 2026-05-15  
**Status:** Migrations **authored** — **not** executed against any database in this step.

---

## A. Files created

| Path | Purpose |
|------|---------|
| `supabase/migrations/0003_studies.sql` | Studies + org-scoped RLS (tightened in 0005) |
| `supabase/migrations/0004_study_versions.sql` | Immutable study version rows |
| `supabase/migrations/0005_study_members.sql` | Study membership + SECURITY DEFINER helpers + policy replacement |
| `supabase/migrations/0006_visit_and_procedure_definitions.sql` | Visit/procedure defs + map + editor helper |
| `supabase/migrations/0007_study_subjects.sql` | Enrollment registry |
| `supabase/migrations/0008_visits.sql` | Visit instances |
| `supabase/migrations/0009_procedure_executions.sql` | Procedure executions |
| `supabase/migrations/0010_operational_events.sql` | Append-only operational stream |
| `supabase/migrations/0011_attachments.sql` | Attachment metadata |
| `scripts/apply-migrations.mjs` | **Updated** `MIGRATION_FILES` to include `0003`–`0011` (runner alignment only). |

**Unchanged (per instructions):** `0002_audit_foundation.sql` — no schema changes to `audit_events`. `0010` adds a `COMMENT ON public.operational_events` clarifying separation from `audit_events` (comment only).

---

## B. Tables / logical enums per migration

### 0003_studies.sql

- **Table:** `studies` — columns include `organization_id`, `slug`, `name`, `status` (`draft` \| `active` \| `paused` \| `closed`), timestamps; partial unique index on `(organization_id, slug)` when slug non-empty.

### 0004_study_versions.sql

- **Table:** `study_versions` — `version_label`, `effective_date`, `protocol_identifier`, `metadata` JSONB; unique `(study_id, version_label)`.

### 0005_study_members.sql

- **Table:** `study_members` — `role` ∈ `study_admin`, `coordinator`, `monitor`, `lab`, `finance`, `viewer`.
- **Functions (SECURITY DEFINER):** `user_study_ids()`, `user_has_study_access(uuid)`, `user_is_study_admin(uuid)`, `user_can_manage_study_roster(uuid)`.
- **Policies replaced:** `studies`, `study_versions` (see §C).

### 0006_visit_and_procedure_definitions.sql

- **Tables:** `visit_definitions`, `procedure_definitions`, `visit_def_procedure_map`.
- **Logical enums:** none as `CREATE TYPE`; status-like fields use `text` + `CHECK` where specified in plan.
- **Function:** `user_can_edit_study_definitions(uuid)` (study_admin, coordinator, lab, or org admin).

### 0007_study_subjects.sql

- **Table:** `study_subjects` — `enrollment_status` ∈ `screening`, `screen_failed`, `enrolled`, `withdrawn`, `completed`.
- **Function:** `user_can_manage_subject_enrollment(uuid)` (org admin or study roles: study_admin, coordinator, lab).

### 0008_visits.sql

- **Table:** `visits` — `visit_status` ∈ `scheduled`, `checked_in`, `in_progress`, `completed`, `cancelled`, `no_show`.

### 0009_procedure_executions.sql

- **Table:** `procedure_executions` — `execution_status` ∈ `pending`, `in_progress`, `completed`, `not_applicable`, `cancelled`; optional `billable_*` columns for future finance.
- **Unique:** `(visit_id, procedure_definition_id)`.

### 0010_operational_events.sql

- **Table:** `operational_events` — `event_type` free `text` (extensible); `payload` JSONB capped (~512 KiB); append-only for JWT roles.
- **Function:** `user_can_append_operational_events(uuid)` (org admin or study_admin / coordinator / lab).
- **Trigger:** `enforce_operational_events_consistency()` normalizes FKs from `visit_id` / `procedure_execution_id`.

### 0011_attachments.sql

- **Table:** `attachments` — `entity_type` ∈ `study`, `study_subject`, `visit`, `procedure_execution`; polymorphic `entity_id` (no single FK by design).

---

## C. RLS policies included (summary)

**Patterns (no `current_setting('app.current_organization_id')`):**

- **Organization gate:** `organization_id in (select public.user_organization_ids())` everywhere, combined with study helpers from **0005** where applicable.
- **Study gate:** `public.user_has_study_access(study_id)` or `id in (select public.user_study_ids())` for `studies`; admins may bypass read via `public.user_is_org_admin(organization_id)` where noted.
- **`study_members`:** uses **only** SECURITY DEFINER helpers for membership checks to **avoid recursion** on `study_members` (same strategy as `organization_members` in `0001`).

**Per-table behavior:**

| Migration | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| 0003 studies | Org members → 0005 narrows to org admin **or** study member | Org admin | Org admin / study admin (0005) | Org admin |
| 0004 study_versions | Org → 0005 study scope | Org admin → 0005 study_admin + org admin | *(none)* | *(none)* |
| 0005 study_members | Study members | Roster managers | Roster managers | Org admin or study_admin |
| 0006 defs + map | Study access or org admin | Definition editors | Definition editors | Definition editors |
| 0007 study_subjects | Study access | Enrollment managers | Enrollment managers | Org admin / study_admin |
| 0008 visits | Study access | Enrollment managers | Enrollment managers | Org admin / study_admin |
| 0009 procedure_executions | Study access | Enrollment managers | Enrollment managers | Org admin / study_admin |
| 0010 operational_events | Study access | Append roles only | **none** | **none** |
| 0011 attachments | Study access | Enrollment managers | **none** (MVP) | Org admin / study_admin |

**`audit_events`:** unchanged; admin read policy from `0002` only.

---

## D. Risks found / outstanding

| Risk | Notes |
|------|--------|
| **Role semantics** | MVP policies bundle “operational” power into `user_can_manage_subject_enrollment`, `user_can_edit_study_definitions`, etc. Monitors/viewers/finance can still **read** wide content once in `study_members`; column-level blinding is **not** in these migrations (per plan §9). |
| **Denormalized `organization_id`** | Triggers align `organization_id` with `studies` / visit / procedure rows; drift is reduced but **application** must still avoid trusting client-supplied org IDs. |
| **Polymorphic attachments** | No FK to `entity_id`; incorrect links are possible—application validation required before Phase 2b storage policies. |
| **Operational `event_type`** | Unconstrained text; typos possible—consider CHECK or enum in a later migration after product stabilizes. |
| **`operational_events` trigger** | `BEFORE INSERT OR UPDATE` exists for service-role corrections; authenticated roles have **no** UPDATE policy (append-only). |
| **Procedure uniqueness** | `unique(visit_id, procedure_definition_id)` blocks repeat procedures on the same visit; repeated draws need a later occurrence column if required. |
| **Postgres trigger syntax** | Migrations use `EXECUTE FUNCTION` (PostgreSQL 14+). Supabase 15 is fine; older local Postgres may need `PROCEDURE` wording. |

---

## E. Validation plan before applying

1. **Order:** Apply strictly `0001` → `0002` → `0003` … → `0011` on a **staging** branch/database.
2. **Smoke:** After each migration, `\dt public.*` / spot-check FKs; run `0005` and verify no RLS recursion (select from `study_members` as a member user).
3. **Isolation:** Extend Phase 1b-style checks: two users, two orgs, two studies; prove no cross-org/cross-study reads/writes via anon key.
4. **Append-only:** Confirm authenticated role cannot UPDATE/DELETE `operational_events` or `study_versions`.
5. **Synthetic seed:** Service role creates studies + `study_members`; JWT users exercise CRUD allowed by policies (`npm run db:provision` extension later).
6. **Regression:** Re-run `npm run db:validate` after Phase 2 apply to ensure Phase 1b gates still pass.

---

## F. Ready for manual SQL Editor execution?

**Yes**, with caveats:

- Files use `IF NOT EXISTS`, `create or replace`, and `drop policy if exists` where practical—suitable for careful **manual** execution in order.
- For production, prefer `npm run db:migrate` (or Supabase CLI migrations) so history stays auditable.
- **Do not** run on production until staging validation (§E) passes.

---

## References

- `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md`
- `supabase/migrations/0001_auth_foundation.sql`, `0002_audit_foundation.sql`
