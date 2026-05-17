# Phase 4B.2B — E2E skipped coverage expansion plan

**Status:** Planning only — no migrations, no new RPCs, no UI/API.  
**Parents:** [`PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`](./PHASE4B2-RUNTIME-E2E-QA-HARNESS.md) · [`PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`](./PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md) · [`PHASE3C-VALIDATION-RESULTS.md`](./PHASE3C-VALIDATION-RESULTS.md)

**Baseline (GREEN, do not alter):** Phase 3C visit RPCs · Phase 4C publish layer · Phase 4B runtime schema `0020`–`0039`.

---

## A. Current E2E status

Latest mutating run (post-`0038` submit RLS + `0039` attribution fix):

| Metric | Value |
|--------|-------|
| **Pass** | 11 |
| **Fail** | 0 |
| **Skip** | 6 |
| **Report** | `tmp/runtime-e2e/phase4b-runtime-e2e-report.json` |

### Passing coverage (core capture path)

| Step | Validates |
|------|-----------|
| `publish_package` → `bind_procedure_execution` | 4C → 4A bind |
| `open_response_set` | Idempotent open |
| `save_draft` | Draft upsert |
| `submit_freeze` | Submit RLS + freeze |
| `save_after_submit_denied` | Post-submit draft blocked |
| `create_finding` → `acknowledge_finding` → `resolve_or_waive_finding` | DQ lifecycle |
| `correct_response` | Append-only correction + set `corrected` |

### Skipped coverage (4B.2B target)

| Step | Skip reason (v1 harness) |
|------|---------------------------|
| `add_addendum` | Hard-coded skeleton skip — no field discovery |
| `complete_visit` | PE not `completed`/`verified` — prerequisite chain not run |
| `lock_visit` | Visit not `completed` |
| `save_after_lock_denied` | Cascaded from lock |
| `correction_after_lock_allowed` | Cascaded from lock |
| `tenant_isolation` | `--cross-org-user-id` not supplied |

---

## B. Why each skipped case matters

### B.1 Addendum (`add_source_addendum`)

**Regulatory / product risk:** Late-entry fields (newer published SDV or fields never captured on bound manifest) are a distinct workflow from correction. Missing E2E leaves `source_response_addenda` provenance and post-lock addendum RLS unproven in staging.

**What must be true:**

- Field has **no** current response on the **applied** SDV field (`field_key` match when introduced SDV ≠ bound SDV).
- Set status allows post-submit change (`submitted`, `corrected`, `addended`, etc. per `phase4b_srs_allows_post_submit_change`).
- Addendum does not mutate prior submitted `value_*`.

### B.2 Visit complete + lock (Phase 3C integration)

**Regulatory / product risk:** Visit lock is the immutability boundary for normal capture. Without E2E we do not prove:

- `save_source_draft` fails when `visits.visit_status = locked`.
- `correct_source_response` / `add_source_addendum` still succeed when authorized (4B policy: correction/addendum allowed after visit lock).

**Dependency:** Phase 3C `complete_procedure_execution` → `complete_visit` → `lock_visit` on the **same** `visit_id` used for capture tests (or a dedicated lock-track visit).

### B.3 Tenant / role isolation

**Security risk:** Capture RPCs must fail for users outside org or study scope even if they guess UUIDs. Phase 3C already proves visit RPC isolation; 4B must prove the same for `open_source_response_set`, `save_source_draft`, `submit_source_response_set`, and correction/addendum paths.

**Minimum denial matrix:**

| Actor | Expected on org-A study resources |
|-------|-----------------------------------|
| `synthetic.staff.b` (Org Beta admin, no study membership on phase2-validation-study) | Deny |
| `synthetic.staff.c.orga.only` (Org Alpha member, study_members row removed) | Deny |
| Optional: monitor (study access, not enrollment) | Deny **draft save**; may allow finding acknowledge (already partially covered) |

---

## C. Addendum test design

### C.1 Goal

Execute `add_source_addendum` on a **submitted or corrected** set where at least one **optional** field on the bound SDV has no current response.

### C.2 Field selection algorithm (harness)

After `submit_freeze` (and optionally after `correct_response`):

```sql
-- Find addendum-eligible field on bound SDV
select sf.id as introduced_field_id, sf.widget_hint
from source_fields sf
where sf.source_definition_version_id = :bound_sdv
  and not exists (
    select 1 from source_responses sr
    where sr.response_set_id = :set_id
      and sr.source_field_id = sf.id
      and sr.is_current = true
  )
limit 1;
```

If zero rows: **skip with explicit reason** `NO_ADDENDUM_ELIGIBLE_FIELD` (do not fail the run).

If row found: call `add_source_addendum(org, set_id, introduced_field_id, value_json, reason)` with `p_introduced_by_source_definition_version_id` = bound SDV (simple path — no cross-SDV `field_key` match required for v1).

### C.3 Pass conditions

| Check | Expected |
|-------|----------|
| RPC | `ok: true`, `addendum_id` + `response_id` present |
| `source_response_addenda` | Row with `introduced_*` / `applied_*` provenance |
| `source_responses` | New current row, `is_submitted=true`, value populated |
| Set status | `addended` (or remains `corrected` if already corrected — document actual) |
| Prior rows | Unchanged `value_*` on fields that were submitted |

### C.4 Optional v2: cross-SDV addendum

Publish **two** golden packages (or second publish with new field) so introduced SDV ≠ bound SDV; assert `field_key` resolution to applied field. Defer to Phase 4B.2C — not required for minimum coverage.

---

## D. Lock behavior test design

### D.1 Goal

On a dedicated staging visit, run Phase 3C lifecycle **then** re-assert 4B rules on the same visit used for capture (or a parallel visit with an existing submitted set).

### D.2 Recommended track split

| Track | Visit | Purpose |
|-------|-------|---------|
| **Capture track** | Fresh visit (`discover-e2e-staging-ids.mjs --fresh`) | publish → open → save → submit → findings → correct → **addendum** |
| **Lock track** | Second fresh visit OR reuse capture visit after addendum | PE complete → visit complete → lock → 4B post-lock probes |

**Minimum:** Single visit if ordering is: capture through submit → complete PE → complete visit → lock → post-lock probes → addendum (addendum allowed after lock per 4B). Confirm ordering against [`PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`](./PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md) — addendum is explicitly post-lock allowed.

### D.3 Phase 3C prerequisite chain (same actor JWT)

| Order | RPC | Pass condition |
|-------|-----|----------------|
| L1 | `complete_procedure_execution(p_procedure_execution_id)` | `ok: true`, execution `completed` |
| L2 | `complete_visit(p_visit_id)` | `ok: true`, visit `completed` |
| L3 | `lock_visit(p_visit_id)` | `ok: true`, visit `locked` |

Use existing synthetic coordinator (`synthetic.staff.a@vilo-os.staging`) — same pattern as `validate-phase3c.mjs`.

### D.4 Post-lock 4B probes

| Step | RPC | Expected |
|------|-----|----------|
| `save_after_lock_denied` | `save_source_draft` | Reject (`VISIT_LOCKED` / RLS / `ok: false`) |
| `correction_after_lock_allowed` | `correct_source_response` on submitted current row | **Pass** when actor has `phase4b_user_can_correct_source` |
| Optional | `add_addendum` after lock | **Pass** on eligible field (proves addendum path under visit lock) |

### D.5 Fixture requirements

- Visit definition `V_SCREENING` mapped to procedure definition used by PE (already in phase2-validation-study).
- PE starts `pending` before L1.
- Do **not** use Phase 3C locked fixture visit `f3f5949b-…` (permanently locked from prior QA).

---

## E. Tenant isolation test design

### E.1 Goal

Prove cross-tenant and cross-study denial without `service_role` as clinical actor.

### E.2 Actors (from `db:provision` + Phase 3C patterns)

| User | UUID source | Role in test |
|------|-------------|--------------|
| **Actor A** | `--actor-user-id` (coordinator on study) | Positive control — already used |
| **User B** | `synthetic.staff.b@vilo-os.staging` | Org Beta — deny open/save/submit on Org Alpha IDs |
| **User C** | `synthetic.staff.c.orga.only@vilo-os.staging` | Org Alpha member, **no** `study_members` on phase2-validation-study — deny |

Resolve B/C UUIDs once per staging run via `auth.users` email lookup (script helper), or new flags:

- `--denied-user-b-id`
- `--denied-user-c-id`

### E.3 Denial probes (per denied user, `sql.begin` + `request.jwt.claim.sub`)

| Probe | RPC | Expected |
|-------|-----|----------|
| T1 | `open_source_response_set` (same args as actor A) | `FORBIDDEN` / not found / `ok: false` |
| T2 | `save_source_draft` on known `source_response_set_id` | Deny |
| T3 | `submit_source_response_set` | Deny |
| T4 | `correct_source_response` | Deny |
| T5 | `add_source_addendum` | Deny |

**Pass:** No row mutation occurs (read set status + response count before/after optional).

### E.4 Optional: monitor positive partial

| Probe | RPC | Expected |
|-------|-----|----------|
| M1 | `acknowledge_source_validation_finding` as monitor | Pass (study access) |
| M2 | `save_source_draft` as monitor | Deny (enrollment required) |

Requires `--monitor-user-id` from study_members role `monitor`.

---

## F. Required fixture / data setup

### F.1 Staging tenants (existing)

| Asset | Source |
|-------|--------|
| Org Alpha + phase2-validation-study | `npm run db:provision` + Phase 2/3C seed |
| Synthetic users A/B/C | `scripts/provision-synthetic.mjs` |
| Golden-basic publish artifacts | `npm run build:publish-package:golden` |

### F.2 Per-run disposable rows (mutating)

| Asset | How |
|-------|-----|
| Fresh visit + PE | `node scripts/discover-e2e-staging-ids.mjs --fresh` |
| Bound SDV on PE | Harness after publish (existing) |
| Submitted response set | Harness steps 4–6 (existing) |

### F.3 Addendum-specific

| Requirement | Notes |
|-------------|-------|
| ≥1 uncaptured field on bound SDV | Usually automatic if submit only persisted required fields |
| Set in post-submit status | After submit or after correct |
| Operational events permission | Actor must satisfy `user_can_append_operational_events` (coordinator OK) |

### F.4 Lock-specific

| Requirement | Notes |
|-------------|-------|
| Visit `scheduled` → `completed` → `locked` | Via Phase 3C RPCs |
| PE `pending` → `completed` before visit complete | `complete_procedure_execution` |
| Dedicated visit | Avoid locked fixture from 3C regression |

### F.5 Isolation-specific

| Requirement | Notes |
|-------------|-------|
| User B UUID | Query by email; not member of study |
| User C UUID | Org member only; confirm no `study_members` row |
| Known `source_response_set_id` from capture track | For T2–T5 |

### F.6 No new migrations or RPCs

All tests call **existing** functions only. Fixture setup may use:

- Harness SQL (PE bind only — already done)
- Phase 3C RPCs (complete PE/visit/lock)
- Optional **read-only** catalog queries

Avoid `service_role` for clinical writes. `service_role` acceptable only for UUID discovery / optional visit insert in `discover-e2e-staging-ids.mjs` (documented staging-only exception).

---

## G. Safety constraints

| Rule | Enforcement |
|------|-------------|
| Staging only | Never run `--mutating` against production |
| Explicit mutating | Default remains planning/dry-run; `--mutating` required |
| No service_role clinical actor | Denied users use JWT simulation only |
| No published_* direct writes | Publish only via `publish_source_package` |
| No Phase 3C / 4C code changes | Call RPCs as-is |
| Disposable visits | Prefer `--fresh` per run; do not reuse locked 3C fixture visit |
| Report skips | Skips are acceptable with explicit `detail`; only fail on regression of currently passing steps |
| PHI | Synthetic identifiers only (`SUBJ-P2VAL-001`, etc.) |

---

## H. Proposed harness changes (4B.2B — script only)

Target: `scripts/validate-phase4b-runtime-e2e.mjs` (incremental; no new migration).

| Change | Description |
|--------|-------------|
| **H1** | Implement `resolveAddendumEligibleField(sql, setId, sdvId)` and run `add_addendum` step |
| **H2** | Add `--fresh` passthrough or document `discover-e2e-staging-ids.mjs --fresh` in harness preamble |
| **H3** | Add Phase 3C block: `complete_procedure_execution` → `complete_visit` → `lock_visit` before post-lock steps |
| **H4** | Wire `save_after_lock_denied` / `correction_after_lock_allowed` to run only when visit actually locked |
| **H5** | Add `--cross-org-user-id` / `--denied-study-user-id` (C) / auto-resolve from emails |
| **H6** | Add `tenant_isolation` sub-steps T1–T5 with before/after row counts |
| **H7** | Optional `--profile full` vs `--profile core` (core = current 11 steps; full = +skipped expansion) |
| **H8** | Extend report JSON: `profile`, `skipped_reason_code`, `isolation` array |

**New npm script (optional):**

```json
"db:validate-phase4b-runtime-e2e:full": "node scripts/validate-phase4b-runtime-e2e.mjs --profile full"
```

**Docs:** Link this plan from [`PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`](./PHASE4B2-RUNTIME-E2E-QA-HARNESS.md) § Known limitations.

---

## I. QA commands

### Catalog gate (always)

```bash
npm run db:validate-phase4b-runtime
npm run db:validate-phase4c
npm run db:validate-phase3c
```

### Planning (no writes)

```bash
npm run db:validate-phase4b-runtime-e2e
```

### Full mutating expansion (after harness H1–H6)

```bash
# 1. Fresh visit/PE
node scripts/discover-e2e-staging-ids.mjs --fresh

# 2. Run with all IDs + denied users (resolve UUIDs from auth.users)
npm run db:validate-phase4b-runtime-e2e -- --mutating --mode existing \
  --organization-id "<org>" \
  --study-id "<study>" \
  --study-version-id "<sv>" \
  --study-subject-id "<subject>" \
  --visit-id "<fresh-visit>" \
  --procedure-execution-id "<fresh-pe>" \
  --actor-user-id "<user-a>" \
  --cross-org-user-id "<user-b>" \
  --denied-study-user-id "<user-c>"
```

### Success criteria (4B.2B)

| Area | Target |
|------|--------|
| Core path | 11 pass / 0 fail (no regression) |
| Addendum | pass OR explicit skip `NO_ADDENDUM_ELIGIBLE_FIELD` |
| Lock chain | `complete_visit` + `lock_visit` pass; post-lock steps pass |
| Isolation | T1–T5 pass (all denied) |
| **Total** | ≥15 pass, 0 fail, ≤1 explicit skip |

---

## J. Exact next step

1. **Implement harness H1–H6** in `validate-phase4b-runtime-e2e.mjs` (script-only PR; no DDL).
2. Resolve staging UUIDs for User B/C once; store in local staging sheet (not committed).
3. Run **full mutating** profile on fresh visit; archive report as `tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json`.
4. Update [`PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`](./PHASE4B2-RUNTIME-E2E-QA-HARNESS.md) status to **4B.2B complete** when skip count ≤1 and isolation passes.
5. **Then** begin Phase 5 UI/API read models calling existing RPCs only.

**Defer (4B.2C):** cross-SDV addendum with second publish; seeded mode; Supabase Auth client path parallel to postgres JWT simulation.
