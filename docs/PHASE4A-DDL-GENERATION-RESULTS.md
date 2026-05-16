# Phase 4A — DDL generation results (Versioned Protocol Builder)

**Design reference:** [`PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md`](./PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md)  
**Generated:** 2026-05-15 (agent) — **migrations not applied in this task**.

---

## A. Migration files created

| File | Purpose |
|------|---------|
| `supabase/migrations/0014_source_definitions.sql` | Instrument shells per study (`organization_id`, RLS, authoring actors). |
| `supabase/migrations/0015_source_definition_versions.sql` | Version rows, lifecycle, publish/retire stamping, immutability triggers, RLS. |
| `supabase/migrations/0016_source_fields.sql` | Normalized field manifests keyed to a version; authoring only on draft/in_review parents. |
| `supabase/migrations/0017_procedure_source_bindings.sql` | One default binding per procedure; FK must be **published**. |
| `supabase/migrations/0018_procedure_execution_source_version_fk.sql` | Nullable `procedure_executions.source_definition_version_id` + optional FK guard trigger. |
| `supabase/migrations/0019_phase4a_validation_helpers.sql` | Reusable JSON/size helpers + published/authoring predicates for future RPC/UI. |

**Orchestration:** `scripts/apply-migrations.mjs` now appends `0014`–`0019` after `0013_visit_completion_and_locking_rpc.sql`.

**Note:** This repo’s migration runner still **does not** include `0012_complete_procedure_execution_rpc.sql` (Phase 3B definitions); `0013` carries the current visit/procedure RPC behavior. Do not change that ordering without an explicit re-baseline.

---

## B. Tables / functions / policies per migration

### `0014_source_definitions`

- **Table:** `public.source_definitions` (`organization_id`, `study_id`, unique `(study_id, code)`, `created_*` / `updated_*` actors).
- **Triggers:** `enforce_row_study_organization_consistency`, `generic_set_updated_at`, `phase4a_source_definitions_touch_actors`.
- **RLS:** SELECT (org member + `user_has_study_access` or org admin), INSERT/UPDATE (`user_can_edit_study_definitions`), DELETE **denied** (`using (false)`).

### `0015_source_definition_versions`

- **Table:** `public.source_definition_versions` (+ optional `study_version_id`, `lifecycle_status` check, `supersedes_version_id` self-FK, capped `validation_rules_manifest` / `meta` JSON sizes on write).
- **Function + trigger:** `phase4a_sdv_before_write` on `source_definition_versions_coalesce_publish` (coerces org/study from parent definition, blocks client `published_*` on insert, enforces publish/retire transitions, freezes published payload, server `published_at` / `published_by_user_id`, freezes `updated_*` on published no-op rows).
- **RLS:** SELECT (same study access pattern), INSERT (editors, only `draft|in_review`), UPDATE (editors; correctness from trigger), DELETE (editors, only `draft|in_review`).

### `0016_source_fields`

- **Table:** `public.source_fields` (denormalized org/study for RLS, legibility constraints on `label` / `instructions`, `sort_order`, `widget_hint`, `validation_rules` object, optional `options`).
- **Triggers:** `phase4a_source_fields_before_write` (draft/in_review parents only, JSON octet caps), `enforce_row_study_organization_consistency`, `generic_set_updated_at`.
- **RLS:** SELECT (study access), INSERT/UPDATE/DELETE (editors).

### `0017_procedure_source_bindings`

- **Table:** `public.procedure_source_bindings` with `default_source_definition_version_id` (published-only per trigger), unique `(study_id, procedure_definition_id)`.
- **Triggers:** `phase4a_procedure_bindings_normalize`, `enforce_row_study_organization_consistency`, `generic_set_updated_at`.
- **RLS:** SELECT (study access), INSERT/UPDATE/DELETE (editors).

### `0018_procedure_execution_source_version_fk`

- **Column:** `procedure_executions.source_definition_version_id uuid null` referencing `source_definition_versions(id)` **ON DELETE RESTRICT**.
- **Index:** `procedure_executions_source_definition_version_id_idx`.
- **Trigger:** `phase4a_pe_source_definition_version_optional_fk` via `procedure_executions_enforce_z_source_definition_version` (runs **after** `procedure_executions_enforce_visit` alphabetically; validates **published** lifecycle + study match when non-null).

### `0019_phase4a_validation_helpers.sql`

- **Functions:** `phase4a_jsonb_octet_length`, `phase4a_jsonb_within_limit`, `phase4a_sdv_authoring_editable`, `phase4a_sdv_is_published_binding_target` (grants to `authenticated`).

---

## C. RLS summary

- **Tenancy:** Every new table includes `organization_id`; policies require membership via `user_organization_ids()` plus either `user_is_org_admin` **or** `user_has_study_access(study_id)` on reads.
- **Writes:** Inserts/updates/deletes (where allowed) require `user_can_edit_study_definitions(study_id)` (`study_admin`, `coordinator`, `lab`, or org admin surrogate from helper).
- **Deletes:** `source_definitions` hard-denied at policy layer; `source_definition_versions` deletes limited to `draft|in_review`; executions/bindings follow editor rules (bindings retargetable while templates evolve).
- **`anon`:** No table grants were broadened; helper execution is `authenticated` only (`service_role` retains bypass as platform default).

---

## D. Immutability rules (authoring vs bindings)

- **Draft / in_review:** `source_definition_versions` payloads (hash, manifests, labels, version metadata) are editable; `source_fields` mutate freely subject to JSON caps.
- **Published:** Core authoring columns are immutable; `published_at` / `published_by_user_id` cannot be client-supplied on insert; noop updates on published rows freeze `updated_at` / `updated_by_user_id`.
- **Retired / amended / terminal:** Rows cannot be updated again after reaching `retired` or `amended`. From `published`, only transitions to `retired` **or** `amended` are permitted, without mutating the published payload (retirement stamps `retired_*`).
- **Bindings:** `procedure_source_bindings` always reference a **published** instrument version; executions may only store **published** IDs when the nullable FK is populated.
- **Evidence trail:** New regulated content requires a **new** `source_definition_versions` row (never overwriting published rows).

---

## E. Compatibility with Phase 3C

- **`complete_procedure_execution`, `complete_visit`, `lock_visit`** SQL bodies were **not** modified.
- **`procedure_executions.source_definition_version_id`** defaults to **NULL** for all existing and new rows until Phase 4B binds it; trigger no-ops when NULL.
- Trigger ordering uses `procedure_executions_enforce_z_*` so **`procedure_executions_enforce_visit`** still normalizes `study_id` / `organization_id` **before** optional source-FK validation.
- Nullable FK + `ON DELETE RESTRICT` does not affect current completion flows that never touch the column.

---

## F. Risks / blockers

- **Cascade deletes:** Dropping a `study`/`organization` cascades through instruments; this is operational teardown, not an app-level “delete published” control. If org-level hard deletes must be blocked for compliance, add a separate governance process beyond Phase 4A DDL.
- **`0012` omission in `apply-migrations.mjs`:** Fresh environments relying solely on the Node migrator still won’t apply `0012`; ensure the database already reflects Phase 3C via `0013` (or reconcile the file list deliberately).
- **`retired` bindings:** Triggers still require **published** targets; when an instrument is retired, teams must repoint bindings to the next **published** successor before retiring the old row (operational playbooks, not yet automated).
- **`auth.uid()` null:** Service / SQL editor sessions without JWT will leave `created_by` / `published_by` null unless future RPCs stamp service actors; acceptable for migrations, but production publish flows should run as authenticated users or dedicated RPCs.

---

## G. Ready for manual SQL Editor apply?

**Yes**, with these caveats:

1. Apply **`0014` → `0019` in order** on a database that already reflects migrations through **`0013`** (or equivalent Phase 3C DDL).
2. Prefer the **direct/session** connection string for DDL (matches existing migration guidance in `apply-migrations.mjs`).
3. Smoke-test after apply: `npm run db:validate-phase4a` (BLOCKED pre-migration exits **0** by design; GREEN after objects exist).
4. Regression: `npm run db:validate-phase3c` should remain GREEN — no RPC definitions were touched.

No migrations were executed as part of authoring this document.
