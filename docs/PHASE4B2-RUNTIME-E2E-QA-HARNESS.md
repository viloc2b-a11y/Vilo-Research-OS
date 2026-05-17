# Phase 4B.2 — Runtime end-to-end QA harness

**Status:** Core + **4B.2B expansion** (`scripts/validate-phase4b-runtime-e2e.mjs`). See [`PHASE4B2B-E2E-SKIPPED-COVERAGE-PLAN.md`](./PHASE4B2B-E2E-SKIPPED-COVERAGE-PLAN.md).  
**Parents:** [`PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`](./PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md) · [`PHASE4C13-PUBLISH-SOURCE-PACKAGE-RPC.md`](./PHASE4C13-PUBLISH-SOURCE-PACKAGE-RPC.md) · [`PHASE3C-VISIT-LIFECYCLE-RESULTS.md`](./PHASE3C-VALIDATION-RESULTS.md)

**Explicitly out of scope:** UI, Next.js API routes, new runtime RPCs, changes to Phase 3C / Phase 4C publish migrations, direct writes to `published_*` (except via existing `publish_source_package`), `service_role` as clinical actor.

---

## A. Purpose

Validate the **live staging runtime chain** before UI/API work:

```text
publish_source_package (4C)
  → Phase 4A source_definition_versions + source_fields
  → procedure_execution binding (SDV on PE)
  → open_source_response_set
  → save_source_draft
  → submit_source_response_set (freeze)
  → validation finding lifecycle (create → acknowledge → resolve|waive)
  → correct_source_response (append-only)
  → add_source_addendum (when eligible)
  → complete_visit + lock_visit (Phase 3C, existing path)
  → post-lock behavior (draft blocked; correction/addendum allowed when authorized)
  → tenant / cross-user denial (when test users supplied)
```

**Catalog validators (already GREEN) remain prerequisites:**

- `npm run db:validate-phase4b-runtime`
- `npm run db:validate-phase4c`
- `npm run db:validate-phase3c`

This harness exercises **behavior**, not schema existence.

---

## B. Required staging prerequisites

### Environment

| Variable | Required for | Notes |
|----------|----------------|-------|
| `DATABASE_URL_DIRECT` or `DATABASE_URL` | `--mutating` | Direct Postgres preferred for DDL/RPC QA (same as `db:migrate`) |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ANON_KEY` | Optional Supabase client path | Not required for default harness (uses Postgres + `request.jwt.claim.sub`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not** for clinical RPCs | Only for optional user provisioning (`db:provision`); never clinical actor |

### Golden artifacts (compile pipeline)

Before E2E, build golden-basic handoff (or biospecimen variant):

```bash
npm run compile:graph:golden
npm run compile:source:golden
npm run render:source-preview:golden
npm run approve:source-preview:golden
npm run build:publish-package:golden
```

Default paths (relative to `vilo-os/`):

| Artifact | Default path |
|----------|----------------|
| Publish package | `tmp/publish/source-publish-package.golden-basic.json` |
| Source definitions | `tmp/compiled/source-definitions.golden-basic.json` |
| Approval | `tmp/approvals/source-preview-approval.golden-basic.json` |

### Required IDs (`existing` mode)

Supply UUIDs for a **staging study** where the actor has **coordinator** or **study_admin** (and publish permission for step 1):

| ID | Role |
|----|------|
| `organization_id` | Tenant |
| `study_id` | Study scope |
| `study_version_id` | Protocol version row |
| `study_subject_id` | Subject on study |
| `visit_id` | Visit instance (not locked at start, or use dedicated E2E visit) |
| `procedure_execution_id` | PE for mapped procedure; will receive `source_definition_version_id` after publish/bind |
| `actor_user_id` | Auth user with enrollment + publish rights |

Optional isolation actors:

| ID | Role |
|----|------|
| `monitor_user_id` | Study member `monitor` — acknowledge / resolve-waive path |
| `cross_org_user_id` | User in another org — denial checks (`synthetic.staff.b@vilo-os.staging`) |
| `denied_study_user_id` | Org member without study enrollment — denial checks (`synthetic.staff.c.orga.only@vilo-os.staging`) |

**Discovery:** Reuse IDs from `db:provision` + Phase 3C synthetic study (`phase2-validation-study`) or document tenant-specific staging sheet. Do not commit UUIDs to repo.

### Procedure execution binding

After publish, bind PE to a **Phase 4A** `source_definition_version_id` returned in publish summary (`phase4a_source_definition_version_ids` or query `source_definition_versions` where `lifecycle_status = 'published'`). Capture RPCs must **not** reference `published_*` rows for writes.

---

## C. Test modes

| Mode | Flag | Behavior |
|------|------|----------|
| **Planning (default)** | _(none)_ | Validates CLI + artifact presence; emits step plan JSON; **no** RPC mutations |
| **Profile basic** | `--profile basic` (default) | Core capture path (11 steps) when mutating |
| **Profile full** | `--profile full` | Core + addendum + visit lock + isolation probes (4B.2B) |
| **Existing staging study** | `--mode existing` | Uses supplied tenant UUIDs |
| **Seeded test** | `--mode seeded` | Reserved: would create disposable study/subject/visit via approved provision helpers; **requires** `--mutating` and is **not** implemented in v1 skeleton |

**Fresh visit for lock chain:** Use `node scripts/discover-e2e-staging-ids.mjs --fresh` before a full mutating run so `complete_procedure_execution` → `complete_visit` → `lock_visit` are not blocked by prior locks.

---

## D. Test sequence (18 steps; full profile)

| # | Step ID | Profile | Action | Pass condition |
|---|---------|---------|--------|----------------|
| 1 | `publish_package` | basic+full | `publish_source_package` with golden package | `ok: true`; Phase 4A + 4C persist per RPC contract |
| 2 | `verify_phase4a` | basic+full | Count `source_definition_versions` / `source_fields` for study | Rows exist; `lifecycle_status = published` on new SDVs |
| 3 | `bind_procedure_execution` | basic+full | Set PE `source_definition_version_id` if not already bound | PE points to published SDV UUID |
| 4 | `open_response_set` | basic+full | `open_source_response_set` | `ok: true`; idempotent second call returns same set |
| 5 | `save_draft` | basic+full | `save_source_draft` with valid required field values | Draft rows `is_submitted = false` |
| 6 | `submit_freeze` | basic+full | `submit_source_response_set` | Set `submitted`; current responses `is_submitted = true` |
| 7 | `save_after_submit_denied` | basic+full | `save_source_draft` after submit | Fails (`SET_NOT_MUTABLE` / RLS / exception) |
| 8 | `create_finding` | basic+full | `create_source_validation_finding` | Finding `status = open` |
| 9 | `acknowledge_finding` | basic+full | `acknowledge_source_validation_finding` | `open` → `acknowledged` |
| 10 | `resolve_or_waive_finding` | basic+full | `resolve_source_validation_finding` | Terminal `resolved` |
| 11 | `correct_response` | basic+full | `correct_source_response` | New response row; prior demoted; prior `value_*` unchanged |
| 12 | `add_addendum` | **full** | `add_source_addendum` | Addendum + response row **or** `SKIP` `NO_ADDENDUM_ELIGIBLE_FIELD` |
| 13 | `complete_procedure_execution` | **full** | `complete_procedure_execution` (3C) | PE `completed`/`verified` |
| 14 | `complete_visit` | **full** | `complete_visit` (3C) | Visit `completed` when procedures satisfied |
| 15 | `lock_visit` | **full** | `lock_visit` (3C) | Visit `locked`; SRS lock attribution when present |
| 16 | `save_after_lock_denied` | **full** | `save_source_draft` | Blocked (`VISIT_LOCKED` / not mutable) |
| 17 | `correction_after_lock_allowed` | **full** | `correct_source_response` | Succeeds when actor authorized; append-only |
| 18 | `tenant_isolation` | **full** | Cross-org / denied-study / monitor probes | All configured probes denied **or** `SKIP` `IDS_NOT_PROVIDED` |

**4B.2B target (full mutating):** ≥15 pass / 0 fail / ≤1 skip (addendum skip only when no eligible field).

---

## E. Expected pass/fail conditions

| Concern | Expected |
|---------|----------|
| Open idempotency | Second `open_source_response_set` returns same `source_response_set_id` |
| Draft save | Updates/creates draft only; does not set `is_submitted` |
| Submit | Freezes values; set status `submitted` |
| Post-submit save | **Must fail** |
| Correction | New row + `source_response_corrections`; prior current demoted; original submitted values **unchanged** |
| Addendum | `source_response_addenda` with introduced/applied provenance |
| Finding lifecycle | Reaches terminal state; no `source_responses` mutation on resolve/waive |
| Visit lock | Normal draft save blocked; correction/addendum allowed per 4B policies |
| `published_*` | No harness INSERT/UPDATE except via `publish_source_package` |
| Runtime binding | `source_response_sets` / `source_responses` reference Phase 4A SDV/fields only |

---

## F. Script behavior

**Script:** `scripts/validate-phase4b-runtime-e2e.mjs`  
**npm:** `npm run db:validate-phase4b-runtime-e2e` (basic profile)  
**npm:** `npm run db:validate-phase4b-runtime-e2e:full` (full profile planning default)

### CLI

```text
node scripts/validate-phase4b-runtime-e2e.mjs [options]

Options:
  --mutating                 Execute live RPCs (default: planning/dry-run only)
  --profile basic|full       Default: basic (full = 4B.2B expansion steps)
  --mode existing|seeded     Default: existing
  --publish-package <path>
  --source-definitions <path>
  --approval <path>
  --organization-id <uuid>
  --study-id <uuid>
  --study-version-id <uuid>
  --study-subject-id <uuid>
  --visit-id <uuid>
  --procedure-execution-id <uuid>
  --actor-user-id <uuid>
  --monitor-user-id <uuid>       Optional — monitor save/correct denial
  --cross-org-user-id <uuid>     Optional — cross-org open/save denial
  --denied-study-user-id <uuid>  Optional — org member without study access
  --skip-publish                 Use already-published SDVs (existing staging)
  --help
```

### Auth pattern (mutating)

Same **staging-only** pattern as `scripts/dry-run-publish-source-package.mjs`:

- Postgres connection via `DATABASE_URL_DIRECT` / `DATABASE_URL`
- `set_config('role', 'authenticated', true)`
- `set_config('request.jwt.claim.sub', <actor_user_id>, true)`
- `SELECT public.<rpc>(...)`

**No** `service_role` clinical writes. Optional future: Supabase JS client with user password sign-in (requires documented test credentials only).

### Report output

| Profile | Path |
|---------|------|
| `basic` | `tmp/runtime-e2e/phase4b-runtime-e2e-report.json` |
| `full` | `tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json` |

Each step record includes: `step`, `status`, `actor_user_id`, `rpc`, `expected`, `actual`, `key_ids`, `errors`, `detail`. Isolation step adds `isolation[]` probe results.

```json
{
  "ok": true,
  "profile": "full",
  "mode": "existing",
  "mutating": false,
  "steps": [
    {
      "step": "add_addendum",
      "status": "planned",
      "actor_user_id": null,
      "rpc": null,
      "expected": null,
      "actual": null,
      "key_ids": {},
      "detail": "..."
    }
  ],
  "summary": { "passed": 0, "failed": 0, "skipped": 0, "planned": 18 }
}
```

Step `status` values: `pass` | `fail` | `skip` | `planned` | `blocked`.

---

## G. Safe usage

1. Run catalog validators first (all PASS).
2. Run harness **without** `--mutating` to validate inputs and review the plan.
3. Use a **dedicated staging visit/PE** for mutating runs (data is modified).
4. Pass `--mutating` only when IDs and artifacts are confirmed.
5. Never point mutating runs at production.
6. Do not store secrets or production UUIDs in git.

### Staging command examples

**Planning (default):**

```bash
npm run db:validate-phase4b-runtime-e2e -- \
  --mode existing \
  --organization-id "<org-uuid>" \
  --study-id "<study-uuid>" \
  --study-version-id "<sv-uuid>" \
  --study-subject-id "<subject-uuid>" \
  --visit-id "<visit-uuid>" \
  --procedure-execution-id "<pe-uuid>" \
  --actor-user-id "<user-uuid>"
```

**Mutating core (basic profile):**

```bash
npm run db:validate-phase4b-runtime-e2e -- \
  --mutating \
  --mode existing \
  --organization-id "<org-uuid>" \
  --study-id "<study-uuid>" \
  --study-version-id "<sv-uuid>" \
  --study-subject-id "<subject-uuid>" \
  --visit-id "<visit-uuid>" \
  --procedure-execution-id "<pe-uuid>" \
  --actor-user-id "<user-uuid>"
```

**Mutating full (4B.2B — fresh visit + isolation actors):**

```powershell
# 1. Fresh visit/PE (staging)
node scripts/discover-e2e-staging-ids.mjs --fresh

# 2. Full profile (PowerShell)
npm run db:validate-phase4b-runtime-e2e:full -- --mutating --mode existing `
  --organization-id "<org-uuid>" `
  --study-id "<study-uuid>" `
  --study-version-id "<sv-uuid>" `
  --study-subject-id "<subject-uuid>" `
  --visit-id "<fresh-visit-uuid>" `
  --procedure-execution-id "<fresh-pe-uuid>" `
  --actor-user-id "<coordinator-user-uuid>" `
  --cross-org-user-id "<user-b-uuid>" `
  --denied-study-user-id "<user-c-uuid>" `
  --monitor-user-id "<monitor-user-uuid>"
```

Resolve User B/C/monitor UUIDs from `auth.users` by email (`synthetic.staff.b@…`, `synthetic.staff.c.orga.only@…`). Do not commit UUIDs to git.

**Skip publish (SDV already on staging study):**

```bash
npm run db:validate-phase4b-runtime-e2e -- --mutating --skip-publish ...
```

### Mutating warning

`--mutating` performs real inserts/updates under RLS as the actor user. It may publish packages, create response sets, submit clinical draft data, and lock visits. Use an isolated staging tenant.

---

## H. Known limitations

| Limitation | Notes |
|------------|--------|
| `seeded` mode | Documented only; mutating seed not implemented |
| Draft payload builder | Mutating run loads required fields from DB; may `SKIP` if none |
| Addendum step | `SKIP` `NO_ADDENDUM_ELIGIBLE_FIELD` when every bound SDV field already has a current response |
| Cross-SDV addendum | Not covered — requires second publish (4B.2C) |
| Supabase Auth client path | Not used; Postgres `sql.begin` + `request.jwt.claim.sub` |
| Biospecimen golden | Requires full compile pipeline artifacts (not checked into `tmp/`) |
| Isolation | `SKIP` `IDS_NOT_PROVIDED` when neither `--cross-org-user-id` nor `--denied-study-user-id` |
| Visit lock chain | Requires **fresh** visit; locked Phase 3C fixture visit will skip PE/visit/lock steps |
| Reused visit after lock | Post-lock steps skip with `VISIT_NOT_LOCKED` if lock chain did not run |

---

## I. Exact next step after E2E pass

1. Run **full profile** mutating harness on a **fresh** staging visit until ≥15 pass / 0 fail / ≤1 skip.
2. Archive `tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json`.
3. Begin **Phase 5 UI/API** read models that call existing RPCs only (no new clinical write paths).
4. Add Playwright/API smoke with real Supabase Auth sessions (separate from DB-direct harness).

---

## J. QA commands (catalog gate)

```bash
npm run db:validate-phase4b-runtime
npm run db:validate-phase4c
npm run db:validate-phase3c
npm run db:validate-phase4b-runtime-e2e
npm run db:validate-phase4b-runtime-e2e:full
```

Catalog validators must PASS before trusting E2E mutating results.
