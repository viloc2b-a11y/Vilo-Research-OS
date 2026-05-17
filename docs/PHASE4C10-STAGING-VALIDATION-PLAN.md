# Phase 4C.10 — Staging validation plan (publish persistence schema)

**Status:** Planning + catalog harness (read-only by default).

**Scope:** Migrations `0026`–`0032` (Phase 4C.9 publish persistence + Phase 4A link backfill patch).

**Out of scope:** `publish_source_package` RPC, UI, runtime capture RPC changes, weakening RLS.

**Baseline unchanged:** GREEN Phase **3C** (`0013`). Phase **4B** (`0020`–`0025`).

**Parents:** [`PHASE4C9-SOURCE-PUBLISH-PERSISTENCE-PLAN.md`](./PHASE4C9-SOURCE-PUBLISH-PERSISTENCE-PLAN.md) · [`PHASE4C8-SOURCE-PUBLISH-PACKAGE.md`](./PHASE4C8-SOURCE-PUBLISH-PACKAGE.md)

---

## A. Migration apply order

Apply **in this exact order** on staging (after `0001`–`0025` and Phase 4A `0014`–`0019`):

| # | File |
|---|------|
| 1 | `0026_source_publish_packages.sql` |
| 2 | `0027_published_source_definitions.sql` |
| 3 | `0028_published_source_rules_requirements.sql` |
| 4 | `0029_source_publish_approval_evidence.sql` |
| 5 | `0030_source_publish_persistence_helpers.sql` |
| 6 | `0031_phase4c_publish_validation_helpers.sql` |
| 7 | `0032_phase4c_published_phase4a_link_backfill.sql` |

**Dependency rule:** `0027`–`0029` require `0026`. `0032` replaces SDV/field immutability triggers from `0027` — must run after `0027`.

---

## B. Schema existence checks (automated)

Run:

```bash
npm run db:validate-phase4c
```

### Tables (11)

| Table |
|-------|
| `source_publish_packages` |
| `published_source_definition_versions` |
| `published_source_sections` |
| `published_source_fields` |
| `published_source_validation_rules` |
| `published_source_conditional_rules` |
| `published_source_workflow_requirements` |
| `published_source_signature_requirements` |
| `published_source_external_requirements` |
| `published_source_runtime_expectations` |
| `source_publish_approval_evidence` |

### Functions

| Function |
|----------|
| `phase4c_user_can_publish_source_package` |
| `phase4c_package_hash_is_valid` |
| `phase4c_assert_publish_package_eligible` |
| `phase4c_touch_persisted_package` |
| `phase4c_published_snapshot_before_write` |
| `phase4c_link_published_sdv_to_phase4a` |
| `phase4c_link_published_field_to_phase4a` |
| `phase4c_publish_package_is_consistent` |

### Violation views (0031)

All `phase4c_violation_*` views listed in Section F.

### Phase 4B FK confirmation (catalog)

Harness verifies `source_response_sets.source_definition_version_id` → `source_definition_versions` and `source_responses.source_field_id` → `source_fields` (no FK to `published_*`).

---

## C. RLS smoke tests (manual / mutating)

**Prerequisites:** Staging DB with synthetic org/study/users (`npm run db:provision` or existing fixtures). Use **authenticated** Supabase clients or `SET ROLE` / JWT tests — not `service_role` for publish path.

| # | Actor | Action | Expected |
|---|--------|--------|----------|
| C1 | Anonymous | `SELECT` / `INSERT` on `source_publish_packages` | Denied |
| C2 | User in Org A | `INSERT` package for Org B study | Denied |
| C3 | Org member, **not** on study | `INSERT` package | Denied |
| C4 | Study **monitor** / **viewer** | `INSERT` package / published rows | Denied |
| C5 | Study **coordinator** | `INSERT` package (`publish_ready=true`, valid status) | Allowed |
| C6 | Study **study_admin** | Same as C5 | Allowed |
| C7 | **Org admin** | Same as C5 | Allowed |
| C8 | Study member (any read role) | `SELECT` published rows for own study | Allowed |
| C9 | Org A member | `SELECT` Org B package | Denied |

**Note:** No broad `UPDATE` policies on `published_*`; link backfill uses `phase4c_link_published_*` (SECURITY DEFINER) only.

---

## D. Immutability tests (manual / mutating)

Execute in a transaction; `ROLLBACK` unless using disposable staging data.

| # | Test | Expected |
|---|------|----------|
| D1 | `DELETE` from any `published_*` snapshot table | Exception (deny trigger) |
| D2 | `UPDATE` `section_name` on `published_source_sections` | Exception |
| D3 | `UPDATE phase4a_source_definition_version_id` NULL → valid published 4A UUID | Success (once) |
| D4 | Repeat D3 with different UUID | Exception (cannot change once set) |
| D5 | `UPDATE phase4a_*` to NULL after set | Exception |
| D6 | `UPDATE phase4a_source_field_id` NULL → valid 4A field UUID | Success (once) |
| D7 | `phase4c_link_published_sdv_to_phase4a` when `persisted_at` set | Exception |
| D8 | `phase4c_link_*` when `publish_ready=false` | Exception (package insert policy prevents false ready; test helper on downgraded row if crafted via superuser) |
| D9 | `UPDATE` only `persisted_at` on package via `phase4c_touch_persisted_package` after full publish txn | Success |

---

## E. Package consistency tests (manual / mutating)

| # | Test | Expected |
|---|------|----------|
| E1 | `INSERT` package `publish_ready=false` | RLS deny |
| E2 | `INSERT` package `publish_ready=true`, `validation_status='invalid'` | CHECK constraint deny |
| E3 | `INSERT` approval `decision='rejected'` | RLS deny |
| E4 | Duplicate `(organization_id, package_id)` | Unique violation |
| E5 | `phase4c_package_hash_is_valid('sha256:' || 64 hex)` | `true` |
| E6 | `phase4c_assert_publish_package_eligible` before evidence | Exception |
| E7 | Insert matching `source_publish_approval_evidence` then assert | Success |
| E8 | `phase4c_touch_persisted_package` before evidence | Exception |

**Recommended publish transaction order (future RPC):**

1. `INSERT source_publish_packages`
2. `INSERT published_*` children (phase4a links NULL)
3. Create Phase 4A `source_definition_versions` / `source_fields` (`lifecycle_status=published`)
4. `phase4c_link_published_sdv_to_phase4a` (each SDV)
5. `phase4c_link_published_field_to_phase4a` (each field)
6. `INSERT source_publish_approval_evidence`
7. `phase4c_assert_publish_package_eligible`
8. `phase4c_touch_persisted_package`

---

## F. Violation view tests

After seeding intentional bad rows in a **disposable** staging branch (or query empty = 0 rows):

| View | Seed to trigger | Expect rows |
|------|-----------------|-------------|
| `phase4c_violation_package_not_ready_but_persisted` | `persisted_at` set + `publish_ready=false` | ≥1 |
| `phase4c_violation_package_invalid_validation_status` | `validation_status='invalid'` | ≥1 |
| `phase4c_violation_missing_approval_evidence` | `persisted_at` without evidence | ≥1 |
| `phase4c_violation_approval_hash_mismatch` | Evidence hash ≠ package | ≥1 |
| `phase4c_violation_persisted_missing_phase4a_sdv_link` | `persisted_at` + null phase4a SDV | ≥1 |
| `phase4c_violation_persisted_missing_phase4a_field_link` | `persisted_at` + null phase4a field | ≥1 |
| `phase4c_violation_published_section_without_sdv` | Orphan section compiler id | ≥1 |
| `phase4c_violation_published_field_without_section` | Orphan field section id | ≥1 |
| `phase4c_violation_duplicate_deterministic_sdv_ids` | Duplicate compiler SDV id | ≥1 |
| `phase4c_violation_duplicate_deterministic_field_ids` | Duplicate compiler field id | ≥1 |
| `phase4c_violation_runtime_expectation_orphan` | Rex with no matching section/visit | ≥1 (heuristic) |
| `phase4c_violation_capture_unpublished_sdv_binding` | SRS bound to draft SDV | ≥1 |

Clean staging after test: `phase4c_publish_package_is_consistent(org, package_id)` → `true`.

---

## G. Phase 4B linkage confirmation

| Runtime column | Must reference | Must NOT reference |
|----------------|----------------|---------------------|
| `source_response_sets.source_definition_version_id` | `source_definition_versions.id` | `published_source_definition_versions.id` |
| `source_responses.source_field_id` | `source_fields.id` | `published_source_fields.id` |

**Existing guard:** `0020` trigger requires `lifecycle_status = 'published'` on bind.

**Harness:** catalog query on `pg_constraint` (see `npm run db:validate-phase4c`).

---

## H. File-based pipeline (pre-DB)

Before DB publish tests, confirm file pipeline still green:

```bash
npm run schemas:validate
npm run compile:graph:golden
npm run compile:source:golden
npm run render:source-preview:golden
npm run approve:source-preview:golden
npm run build:publish-package:golden
```

---

## I. Exact staging command sequence

```bash
# 1. Env
# Copy .env.example → .env.local with DATABASE_URL_DIRECT (preferred for DDL)

# 2. Apply all migrations including 0026–0032
npm run db:migrate

# 3. Read-only catalog + violation view probe
npm run db:validate-phase4c

# 4. Optional JSON output
npm run db:validate-phase4c -- --json

# 5. Manual RLS / immutability / package tests (Sections C–F)
# Use Supabase SQL editor or psql with study users — not service_role for publish path

# 6. Confirm Phase 3C + 4B still green
npm run db:validate-phase3c
npm run db:validate-phase4a
```

---

## J. Smoke test checklist (sign-off)

- [ ] Migrations `0026`–`0032` applied without error
- [ ] `npm run db:validate-phase4c` → PASS (no FAIL)
- [ ] All 11 tables exist, RLS enabled
- [ ] All 8 Phase 4C functions exist
- [ ] All violation views exist
- [ ] Phase 4B FK targets confirmed (4A only)
- [ ] RLS matrix C1–C9 passed
- [ ] Immutability D1–D9 passed
- [ ] Package consistency E1–E8 passed
- [ ] Violation views F seeded + detected
- [ ] `phase4c_link_*` + `phase4c_touch_persisted_package` happy path in one transaction
- [ ] Phase 3C validation still green

---

## K. Risks before `publish_source_package` RPC

1. **`apply-migrations.mjs` must include 0026–0032** — otherwise staging catalog checks stay BLOCKED.
2. **Mutating tests need real auth users** — JWT role claims must match `study_members.role`.
3. **Phase 4A row creation** not in 0026–0032 — RPC must insert `source_definition_versions` / `source_fields` as `published` before link helpers.
4. **`phase4c_assert_publish_package_eligible` requires evidence before touch** — ordering in RPC is mandatory.
5. **Runtime expectation orphan view** is heuristic — false positives/negatives possible.
6. **No migration tracking table** — rely on `to_regclass` + file order discipline.
7. **SECURITY DEFINER link helpers** bypass RLS — acceptable if triggers + auth checks hold.

---

## L. Exact next step

1. Apply `0026`–`0032` on staging and run `npm run db:validate-phase4c`.
2. Complete manual checklist Sections C–F.
3. Implement `publish_source_package` RPC (single transaction, INVOKER + DEFINER helpers only).

---

*Regulatory-informed engineering posture only.*
