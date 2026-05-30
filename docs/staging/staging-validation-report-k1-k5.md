# K1–K5 Staging Validation Report

| Field | Value |
|-------|-------|
| Branch | `genspark-runtime-closure` |
| Report updated | 2026-05-27 |
| Checklist | [`staging-validation-checklist-k1-k5.md`](./staging-validation-checklist-k1-k5.md) |
| **Merge decision** | **NO-GO** (coordinator UI walkthrough pending) |

## Latest commits

- `ed814fa` protocol-to-vip smoke flow
- `1895735` live VIP client support
- `bb3a653` document intake visible as first workspace step

## Status at a glance

| Step | Status |
|------|--------|
| 1. Migrations `0122`→`0134` | **DONE** (applied `0106`→`0134` — prerequisites were missing) |
| 2. Smoke suites | **PASS** (local/static + post-migrate verify script) |
| 3. Coordinator walkthrough | **PENDING** — manual in staging UI |
| 4. Live eSignature boundaries | **PASS** (`staging-live-esignature-boundaries.mjs`) |

---

## 1. Migrations — DONE

**Initial state:** K1–K5 tables missing; `compliance_runtime_documents` and `runtime_source_package_publications` absent (staging behind spine).

**Action taken:**

```bash
npm run db:migrate:from -- 0106_document_intake_compliance_runtime.sql
```

Applied **28 migrations** (`0106` through `0134`), including `0122`–`0134`.

**Verify (`node scripts/staging-verify-k1-k5.mjs`):**

| Check | Result |
|-------|--------|
| Extensions `vector`, `pg_trgm` | OK |
| Prerequisite tables | OK |
| K1–K5 tables | OK |
| Append-only / scope triggers (sample) | OK |
| `operational_signature_requests_pending_unique_idx` | OK |

---

## 2. Smoke suites — PASS

Executed after migrations (static guardrails; not HTTP/UI against deployed Pages URL).

| Command | Result |
|---------|--------|
| `npm run document-intelligence:smoke` | PASS |
| `npm run source-blueprint-evidence:smoke` | PASS |
| `npm run source-blueprint-drafting:smoke` | PASS |
| `npm run source-blueprint-signoff:smoke` | PASS |
| `npm run operational-signature:smoke` | PASS |
| `npm run coordinator-command-center:smoke` | PASS |
| `npm run visit-runtime:smoke:study-scope` | PASS |
| `npm run study-workspace:smoke` | PASS |
| `npm run scan:protocol-safety` | PASS |

---

## 3. Coordinator walkthrough — PENDING

**Not executed in browser** (requires coordinator login on staging app).

Manual script — confirm `study_id` in URL at each step:

1. `/studies/<STUDY>/workspace`
2. Document Intelligence → Source Evidence → Drafting → Signoff
3. Operational Signatures (`/operational-signatures?study_id=…`)
4. Visit Execution (`/visit-runtime?study_id=…`) — should preselect study (`6a122bf`)
5. `/coordinator-command-center?study_id=…` — queues visible, read-only

Also verify: no cross-study leakage; no auto-publish / auto-sign.

---

## 4. Live eSignature boundaries — PASS

`node scripts/staging-live-esignature-boundaries.mjs` against staging `DATABASE_URL`:

| Check | Result |
|-------|--------|
| Create pending signature request | OK |
| Duplicate pending rejected (partial unique index) | OK |
| Cross-org study scope | SKIP (single-org staging) |
| Update completed `operational_signatures` blocked | OK |
| Delete `operational_signature_events` blocked | OK |

---

## Validated static boundaries — PASS

No evidence→runtime mutation paths in scoped K1–K4 libs (unchanged from prior audit). Coordinator command center remains read-only aggregation.

---

## Operational friction (updated)

| # | Issue | Status |
|---|-------|--------|
| 1 | Visit runtime `study_id` | Fixed `6a122bf` — confirm in UI walkthrough |
| 2 | Workspace ops-signatures link | Fixed `6a122bf` |
| 3 | Staging behind `0106` spine | **Resolved** — migrated `0106`→`0134` |
| 4 | `/command-center` vs `/coordinator-command-center` | Use K5 route for walkthrough |

---

## Go / No-Go

| Criterion | Status |
|-----------|--------|
| Migrations through `0134` on staging | ✅ |
| Smoke commands | ✅ |
| Coordinator walkthrough | ❌ Pending |
| Live eSignature DB boundaries | ✅ |
| Static mutation / auto-publish guards | ✅ |

### Decision: **NO-GO** until coordinator completes §3 walkthrough on staging UI.

---

## Helper scripts (this run)

| Script | Purpose |
|--------|---------|
| `scripts/staging-verify-k1-k5.mjs` | Verify tables/extensions; optional `--apply` for `0122`–`0134` only |
| `scripts/staging-live-esignature-boundaries.mjs` | Live DB boundary probes |

*Merge not performed.*
