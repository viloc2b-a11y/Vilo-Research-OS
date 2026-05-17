# Phase 4C.13 — `publish_source_package` RPC

**Status:** Implemented in migration `0033_publish_source_package_rpc.sql` (no UI, no API route, no runtime capture RPCs).

**Parents:** [`PHASE4C12-PUBLISH-SOURCE-PACKAGE-RPC-PLAN.md`](./PHASE4C12-PUBLISH-SOURCE-PACKAGE-RPC-PLAN.md) · [`PHASE4C8-SOURCE-PUBLISH-PACKAGE.md`](./PHASE4C8-SOURCE-PUBLISH-PACKAGE.md)

**Baseline (unchanged):** Phase 3C RPCs · Phase 4B migrations `0020`–`0025` · publish DDL `0026`–`0032`.

---

## A. Purpose

`publish_source_package` is the **single atomic transaction** that persists an approved file-based publish package into:

1. **Phase 4A** runtime FK targets (`source_definition_versions`, `source_fields`)
2. **Phase 4C** immutable audit mirrors (`published_*`, `source_publish_approval_evidence`)
3. **`source_publish_packages`** persistence state (`persisted_at`)

Phase 4A remains the capture FK target. Phase 4C `published_*` rows are insert-only snapshots with optional `phase4a_*` link columns set via `0032` helpers.

---

## B. RPC signature

```sql
public.publish_source_package(
  p_organization_id   uuid,
  p_study_id          uuid,
  p_study_version_id  uuid,
  p_publish_package   jsonb,
  p_source_definitions jsonb,
  p_approval          jsonb
) returns jsonb;
```

**Return shape:**

```json
{
  "package_id": "pkg_…",
  "persisted_at": "…",
  "idempotent_replay": false,
  "phase4a_source_definition_version_ids": { "sdv_…": "uuid" },
  "phase4a_source_field_ids": { "field_…": "uuid" },
  "published_snapshot_counts": { "…": 0 },
  "validation_status": "warning",
  "warnings": []
}
```

---

## C. Security model

| Control | Behavior |
|---------|----------|
| `SECURITY DEFINER` | Runs with definer rights; `search_path = public` |
| `auth.uid()` | Required; fails with `AUTH_REQUIRED` |
| Authorization | `phase4c_user_can_publish_source_package(organization_id, study_id)` |
| Grants | `EXECUTE` to `authenticated` only; no `service_role` assumption |
| Tenant | Study must belong to `p_organization_id`; `study_version_id` must belong to study |

Actor for approval evidence is always `auth.uid()` (not JSON `reviewer_user_id`).

---

## D. Eligibility checks

Before writes (fail closed):

- `publish_ready = true`
- `approval.decision = 'approved'` and `publish_eligible = true`
- `validation_snapshot.errors` and `validation_report.errors` empty; `validation_report.passed = true`
- `validation_status` in `valid` \| `warning`
- `phase4c_package_hash_is_valid` on `source_definitions_hash`, `preview_hash`, `approval_hash`
- Package ↔ approval hash alignment; graph metadata alignment across package, definitions, approval
- `package_id` required

Post-insert (before `persisted_at`):

- `phase4c_assert_publish_package_eligible`
- `phase4c_publish_package_is_consistent`

---

## E. Transaction order

1. Auth + role + tenant validation  
2. Idempotency on existing `source_publish_packages` row  
3. Insert `source_publish_packages` header  
4. Phase 4A: insert `source_definition_versions` (`draft`) → `source_fields` → publish SDVs (`lifecycle_status = published`)  
5. Insert `published_source_definition_versions`, `published_source_sections`, `published_source_fields`  
6. `phase4c_link_published_sdv_to_phase4a` / `phase4c_link_published_field_to_phase4a` (0032 helpers)  
7. Insert rule/requirement `published_*` tables + `source_publish_approval_evidence`  
8. Assert eligible + consistent  
9. `phase4c_touch_persisted_package`  
10. Return summary JSON  

---

## F. Phase 4A mapping

| Compiler / JSON | Phase 4A column |
|-----------------|-----------------|
| `instrument_code` / `visit_code` | Resolves `source_definitions` via `phase4c_resolve_source_definition_for_instrument` |
| SDV row | `source_definition_versions`: `version_label`, `schema_manifest_hash` = `input_hash`, `meta` with compiler IDs |
| Lifecycle | Insert as `draft`; fields while draft; `UPDATE` to `published` with server-managed `published_at` / `published_by_user_id` |
| Field row | `field_key`, `label`, `instructions` ← `display_label`, `widget_hint` ← `phase4c_map_compiler_data_type_to_widget(data_type)`, `sort_order` sequential per SDV |

Mappings stored in temp tables `_phase4c_sdv_map` and `_phase4c_field_map` for link helpers and return JSON.

---

## G. Phase 4C snapshot persistence

Snapshots copy compiler deterministic IDs (`source_definition_version_id`, `source_section_id`, `source_field_id`, rule IDs) into `published_*` tables scoped by `(organization_id, package_id)`.

Rule arrays persisted: validation, conditional, workflow, signature, external, runtime expectations.

---

## H. Idempotency

| Condition | Outcome |
|-----------|---------|
| No prior row | Full publish |
| `persisted_at` set + same hashes | Return `phase4c_build_publish_summary(..., idempotent_replay: true)` |
| `persisted_at` set + different hashes | `PACKAGE_HASH_CONFLICT` |
| Row exists, `persisted_at` null | `PACKAGE_PUBLISH_INCOMPLETE` |

Hashes compared: `source_definitions_hash`, `preview_hash`, `approval_hash` (not recomputed in SQL).

---

## I. Dry-run validator

```bash
npm run dry-run:publish-source-package:golden
```

Script: `scripts/dry-run-publish-source-package.mjs`

- Reads `tmp/publish/source-publish-package.golden-basic.json`, `tmp/compiled/source-definitions.golden-basic.json`, `tmp/approvals/source-preview-approval.golden-basic.json`
- Validates IDs, `publish_ready`, approval, hashes, counts vs array lengths
- **No DB** by default
- Optional `--call-rpc` with `DATABASE_URL_DIRECT` or `DATABASE_URL` plus `--organization-id`, `--study-id`, `--study-version-id`, `--actor-user-id` (sets `request.jwt.claim.sub` for staging QA)

---

## J. QA plan

| Step | Command |
|------|---------|
| Artifact dry-run | `npm run dry-run:publish-source-package:golden` |
| Apply migration | `npm run db:migrate` (includes `0033`) |
| Schema catalog | `npm run db:validate-phase4c` |
| Staging RPC (manual) | Build golden package pipeline, then dry-run `--call-rpc` with real tenant UUIDs |

Do not auto-call RPC in CI unless staging env and actor UUIDs are explicitly configured.

---

## K. Remaining risks

- **Field key normalization:** Compiler field names must satisfy Phase 4A `field_key` snake_ascii constraint; publish may fail on exotic keys.
- **Instrument code sanitization:** Non-ASCII instrument codes are rewritten; operators should keep compiler codes ASCII-safe.
- **Partial failure:** Any exception rolls back the transaction; incomplete headers without `persisted_at` block replay until cleaned up.
- **Auth simulation:** Direct Postgres `--call-rpc` uses JWT claim simulation; production callers must use authenticated Supabase clients.
- **No package_hash recompute:** Header `package_hash` stored when provided in package JSON; not derived inside RPC unless extended later.
