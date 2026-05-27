# K1–K5 Staging Validation Report

| Field | Value |
|-------|-------|
| Branch | `genspark-runtime-closure` |
| Validation baseline | `28bf592` (checklist) |
| Post-validation fix | `6a122bf` (visit-runtime `study_id`, workspace ops-signatures link) |
| Report date | 2026-05-27 |
| Checklist | [`staging-validation-checklist-k1-k5.md`](./staging-validation-checklist-k1-k5.md) |
| **Merge decision** | **NO-GO** |

## Status at a glance

| Area | Status |
|------|--------|
| Staging migrations `0122`→`0134` | **PENDING** — not applied or verified in this run |
| Coordinator manual walkthrough | **PENDING** — not executed on staging |
| Static smoke suites (local) | **PASS** — guardrails only, not live staging |
| Static runtime / mutation boundaries | **PASS** — scoped lib audit |
| Operational eSignature boundaries (live DB/UI) | **PENDING** |
| Known UI blockers (pre-`6a122bf`) | **ADDRESSED in code** — requires staging re-check |

---

## Executive summary

Local automated validation on `genspark-runtime-closure` passed all checklist smoke commands and static boundary audits. **Staging database migrations were not applied** in this environment (`supabase link` unavailable; Docker off). **Manual coordinator walkthrough and live eSignature tests were not run.**

After the initial validation pass, commit `6a122bf` addressed two UI navigation blockers (visit-runtime `study_id` preselection; study workspace link to operational signatures). **Merge remains NO-GO** until staging migrations, manual walkthrough, and live boundary checks complete.

---

## 1. Supabase migrations (0122 → 0134) — PENDING

| Check | Status |
|-------|--------|
| Pre-deploy backup / PITR | Not verified |
| `pgvector` + `pg_trgm` on staging | Not verified |
| Migrations applied in order | **Not executed** |
| Post-apply FK / trigger / RLS checks | **Not executed** |

**Operator actions:**

```bash
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase migration list --linked
# backup first
npx supabase db push --linked
```

**Migration range:** `0122` (K1 ingestion) through `0134` (operational signature hardening). All files present in `supabase/migrations/`.

**Section verdict:** **BLOCKED** until staging operator confirms apply.

---

## 2. Smoke checklist — PASS (local/static)

Run at validation baseline `28bf592`. Static guardrails only — **not** live staging HTTP/DB.

| Command | Result |
|---------|--------|
| `npm run document-intelligence:smoke` | PASS |
| `npm run source-blueprint-evidence:smoke` | PASS |
| `npm run source-blueprint-drafting:smoke` | PASS |
| `npm run source-blueprint-signoff:smoke` | PASS |
| `npm run operational-signature:smoke` | PASS |
| `npm run coordinator-command-center:smoke` | PASS |
| `npm run scan:protocol-safety` | PASS |

Additional after `6a122bf`: `npm run visit-runtime:smoke:study-scope` PASS, `npm run study-workspace:smoke` PASS.

**Re-run on staging** after migrations and with staging app config.

---

## 3. Manual coordinator walkthrough — PENDING

| Check | Status |
|-------|--------|
| Full spine in browser (staging) | Not executed |
| Cross-study data isolation | Not executed |
| `study_id` in URL across modules | Code updated (`6a122bf`); **staging UI not re-verified** |
| Evidence/draft/signoff do not mutate runtime | Static pass |
| No auto-publish / auto-sign | Static pass |
| Coordinator Command Center read-only | Static pass |

**Walkthrough route (staging):**

`Document Intelligence` → `Source Evidence Review` → `Draft Suggestions` → `Signoff & Audit` → `Runtime Source` → `Operational Signatures` → `Visit Execution`

Confirm `study_id` in URL at each step. Use `/coordinator-command-center?study_id=<STUDY>` (not `/command-center`).

**Section verdict:** **PENDING** manual staging session.

---

## 4. Validated static boundaries — PASS

| Boundary | Result |
|----------|--------|
| Evidence ≠ runtime truth | No forbidden writes in scoped evidence/drafting/signoff/doc-intel libs |
| Active reference ≠ publish | RPC + audit `runtime_mutated: false` |
| Draft suggestions advisory | `source_blueprint_draft_suggestions` only |
| Signoff/audit = review artifacts | No `runtime_source_*` / `published_source_*` writes |
| Ops signature server-side hash | `artifact-loader` + `sign-artifact` |
| Coordinator command center | Read-only `.select()` aggregation |

Confirm against staging data after migrations.

---

## 5. Evidence / runtime mutation leak scan — PASS (static)

No writes to `runtime_source_*`, `published_source_*`, `protocol_reconciliation_*`, or `visit_runtime_*` in scoped K1–K4 libraries.

---

## 6. Operational eSignature boundaries — PENDING (live)

| Control | Static | Live staging |
|---------|--------|--------------|
| Append-only signatures/events | PASS (`0133`) | Not run |
| Duplicate pending rejected | PASS (`0134` index) | Not run |
| Org/study scope | PASS (trigger + app) | Not run |
| Role enforcement | PASS | Not run |
| Explicit user sign action | PASS | Not run |

---

## 7. Operational friction

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | High | Visit runtime ignored `?study_id=` | **Fixed in `6a122bf`** — pending staging UI confirm |
| 2 | Medium | Study workspace missing operational signatures link | **Fixed in `6a122bf`** |
| 3 | Low | `/command-center` vs `/coordinator-command-center` naming | Open — use K5 route for walkthrough |
| 4 | Info | Smokes are static; not live staging | Open until staging re-run |
| 5 | Info | Migration apply blocked in validation environment | Open — staging operator action |
| 6 | Low | K4 signoff lacks K5-style `explicit_user_action` flag | Accepted — button-gated in UI |

---

## 8. Go / No-Go

| Criterion | Status |
|-----------|--------|
| Migrations `0122`–`0134` on staging | ❌ Pending |
| Smoke commands on staging-configured app | ❌ Pending re-run |
| Coordinator walkthrough | ❌ Pending |
| Live eSignature boundary tests | ❌ Pending |
| Static mutation / auto-publish / auto-sign guards | ✅ Pass |

### Decision: **NO-GO**

**Required before merge:**

1. Apply and verify migrations `0122`→`0134` on staging.
2. Complete coordinator manual walkthrough (§3).
3. Run live eSignature boundary checks (§6).
4. Re-run smoke suite from staging-configured environment.

---

## Appendix — Validation environment

- Supabase CLI `2.101.0`; **no linked staging project** in validation run
- Docker unavailable (`supabase start` not run)
- Smokes executed locally; migrations not pushed to remote

*Merge not performed.*
