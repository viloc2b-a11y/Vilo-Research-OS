# Phase 5.0 — Runtime API Layer Plan

## Data Integrity & Sponsor-Ready Collection Engine

**Status:** Planning only — no route implementation, no UI, no new migrations.  
**Parents:** [`PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`](./PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md) · [`PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`](./PHASE4B2-RUNTIME-E2E-QA-HARNESS.md) · [`PHASE4C13-PUBLISH-SOURCE-PACKAGE-RPC.md`](./PHASE4C13-PUBLISH-SOURCE-PACKAGE-RPC.md)

**Baseline (GREEN — do not alter):** Phase 3C visit RPCs (`0013`) · Phase 4B runtime DDL/RPCs (`0020`–`0039`) · Phase 4C publish layer (`0026`–`0033`).

**Staging proof (4B.2B):** Full mutating E2E — **17 pass / 0 fail / 1 skip**. Report: `tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json`.

**What this system is:** A regulated **data collection, integrity, packaging, and sponsor/CRO/EDC-readiness** platform — not a diagnosis or treatment decision-support system.

**What this system is not:** The API and UI do **not** own medical judgment, protocol medical necessity, or “clinical logic.” They collect structured study data, enforce **data integrity** rules, surface **findings/queries**, and prepare auditable exports.

---

## 0. Primary goal — sponsor-ready collected data

Collected data must be:

| Property | Meaning |
|----------|---------|
| **Complete** | Required source fields captured; missing data visible before export |
| **Consistent** | Cross-field and cross-visit values align with rules and subject history |
| **Protocol-aligned** | Schedule/window/procedure context visible; deviations documented, not silently ignored |
| **Subject-history-aware** | Prior visits/responses inform consistency checks (read-side / findings) |
| **Source-definition-compliant** | Values match published field widgets, bindings, and SDV lineage |
| **Audit-traceable** | Append-only corrections/addenda; operational events; finding lifecycle |
| **Sponsor/export-ready** | Package status classifies readiness for handoff to sponsor/CRO/EDC |

**Correct principle:** Data integrity rules live in **validated backend RPCs**, **database constraints**, **source definitions**, **protocol schedule metadata**, and **validation/finding workflows**. API endpoints are thin wrappers that **preserve integrity**, **normalize errors**, and **surface findings**. UI must **guide** users to prevent bad entry but must **not** become the source of truth.

---

## 1. Architecture summary

Phase 5.0 adds a **Next.js App Router API layer** under `app/api/source/**` (and scoped `app/api/visit/**`, `app/api/subject/**`, `app/api/study/**` for reconciliation reads) that exposes the validated **collection + integrity** runtime as HTTP endpoints.

```text
Client (future UI / integrator)
  → Route Handler (auth + JSON shape + tenant context)
  → Supabase server client (user JWT — never service_role for collection writes)
  → Postgres RPC (writes) / RLS SELECT (reads + reconciliation views)
  → Constraints, source definitions, schedule metadata, finding workflows
```

```text
┌─────────────────────────────────────────────────────────────┐
│  app/api/*  (Phase 5.0)                                     │
│  - request shape validation only                            │
│  - resolve organization_id from session                     │
│  - map HTTP ↔ RPC; pass through warnings[] when present     │
│  - normalize hard errors vs soft findings in responses      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Source of truth (frozen Phase 3C / 4B / 4C)                │
│  - publish_source_package → definitions + published snapshots │
│  - open / save / submit → capture + freeze                  │
│  - findings → query / integrity workflow                    │
│  - correct / addendum → controlled post-submit change       │
│  - RLS + triggers + schedule/procedure tables (reads)       │
└─────────────────────────────────────────────────────────────┘
```

**Phase 5 API supports (capabilities):**

1. Data capture  
2. Pre-submit validation  
3. Missing data detection  
4. Cross-field consistency checks  
5. Subject-history consistency checks  
6. Protocol/schedule alignment (visibility + findings — not capture blocking for window alone)  
7. Duplicate prevention (active response set lineage)  
8. Sponsor/export readiness checks  
9. Query/finding lifecycle  
10. Audit/history retrieval  

**Out of scope for 5.0:** Capture UI, new integrity RPCs/migrations, Playwright. **Deferred reads** (§4.E future): implemented as RLS SELECT + composed views until backend helpers exist (Phase 5.0.x / 5.1).

---

## 2. API design principles

| Principle | Rule |
|-----------|------|
| **Thin handlers** | Delegate to `lib/api/source/*`; no integrity algorithms in TypeScript |
| **RPC-first writes** | Mutations call existing `public.*` RPCs only |
| **RLS-first reads** | Reconciliation endpoints SELECT under user JWT; no service role |
| **Hard vs soft** | Distinguish **hard validation errors** (block) from **soft integrity findings** (allow + surface) — see §3 |
| **Warnings alongside success** | `save-draft` may return `200` + `warnings[]` for protocol deviation risks |
| **Explicit tenant** | `organization_id` verified against membership on every route |
| **Sponsor-ready framing** | Export/readiness endpoints classify `ready` / `ready_with_warnings` / `not_ready_due_to_blockers` |
| **No PHI in logs** | IDs and codes only — never field values in application logs |
| **Not decision support** | No diagnosis, treatment, or medical-necessity language in API contracts |

---

## 3. Integrity model — blocking vs non-blocking

### 3.1 Terminology

| Term | Definition |
|------|------------|
| **Hard validation error** | Blocks the requested action; user must fix or use the correct workflow (correction/addendum) |
| **Soft integrity finding** | Action may succeed; issue requires visibility, acknowledgment, or follow-up |
| **Protocol deviation risk** | Potential schedule/procedure/window issue to **document and escalate** — not automatic capture denial |
| **Export readiness warning** | Data exists but may not be sponsor-ready until findings resolved or documented |

### 3.2 Hard-block conditions (may block)

The system **may block** when:

| Condition | Typical layer |
|-----------|----------------|
| Informed consent missing/invalid before capture where study rules require it | RPC / study config (future hook; document in readiness) |
| User lacks authorization / tenant access | API pre-check + RLS + RPC `FORBIDDEN` |
| Source definition unpublished or wrong SDV binding on PE | RPC / lineage triggers |
| Invalid value type/format for field widget | RPC `VALUE_TYPE_MISMATCH` |
| Submitted value mutation outside correction/addendum | RLS + RPC |
| Required source field missing at **submit** | RPC `submit_source_response_set` |
| Duplicate active response set would corrupt lineage | DB unique index + RPC |
| Visit **locked** (normal draft save) | RPC `VISIT_LOCKED` — regulatory immutability boundary |

### 3.3 Non-blocking alert conditions (must not block capture)

The system **must not block** data entry solely for:

| Condition | System behavior |
|-----------|-----------------|
| Visit out of protocol window | Soft finding + dashboard visibility |
| Procedure not performed | Finding; visible on integrity endpoint |
| Procedure performed late / off schedule | Finding |
| Missing optional procedure | Warning |
| Missing expected lab/vendor/ePRO data | Export readiness warning |
| Protocol window exception documented | Allow; link to deviation note |
| Visit completed with unresolved operational issue | Finding; export may be `ready_with_warnings` |

**Operational principle:** **Alert, document, escalate, and make visible** — do not block capture for operational deviations unless the issue affects **legal/regulatory capture validity** (hard-block list §3.2).

### 3.4 Protocol deviation workflow (planning)

```text
Detect (schedule/procedure/window metadata + findings)
  → Surface (API warnings / GET deviation-risks / visit integrity)
  → Document (POST deviation-note — reason, optional link to finding)
  → Escalate (finding acknowledge → resolve/waive)
  → Include in sponsor/export readiness classification
```

This is **operational and data-quality governance**, not medical decision-making.

---

## 4. Endpoint groups

Base paths: `/api/source`, `/api/visit`, `/api/subject`, `/api/study`.

### A. Source publish APIs

**Purpose:** Publish **source definitions** from approved packages into Phase 4A runtime + Phase 4C audit snapshots.

| Method | Path | Phase |
|--------|------|-------|
| `POST` | `/api/source/publish` | 5.0 |
| `GET` | `/api/source/publish/:packageId` | 5.0 |
| `GET` | `/api/source/publish/:packageId/status` | 5.0 — **sponsor package status** |

### B. Runtime data collection APIs

**Purpose:** Open a capture episode, save draft values, submit/freeze for audit.

| Method | Path | Phase | Behavior notes |
|--------|------|-------|----------------|
| `POST` | `/api/source/response-set/open` | 5.0 | Idempotent open; hard-block on auth/binding/locked visit |
| `POST` | `/api/source/response-set/save-draft` | 5.0 | **Allows save** when window/procedure soft issues exist; return `warnings[]` |
| `POST` | `/api/source/response-set/submit` | 5.0 | **Blocks** missing required **source fields** only; not solely for visit window deviation |

### C. Data correction / addendum APIs

**Purpose:** Controlled post-submit change with append-only audit trail.

| Method | Path | Phase |
|--------|------|-------|
| `POST` | `/api/source/response/correct` | 5.0 |
| `POST` | `/api/source/response-set/addendum` | 5.0 |

### D. Data integrity finding APIs

**Purpose:** Query/finding lifecycle for missing data, consistency, format, and protocol deviation documentation.

| Method | Path | Phase |
|--------|------|-------|
| `POST` | `/api/source/findings` | 5.0 |
| `POST` | `/api/source/findings/:id/acknowledge` | 5.0 |
| `POST` | `/api/source/findings/:id/resolve` | 5.0 |
| `POST` | `/api/source/findings/:id/waive` | 5.0 |

### E. Read / reconciliation APIs

**Purpose:** Manifest, history, findings, missing data, export readiness, sponsor package status — **read-only**, RLS-scoped.

| Method | Path | Phase |
|--------|------|-------|
| `GET` | `/api/source/response-set/:id` | 5.0 |
| `GET` | `/api/source/response-set/:id/history` | 5.0 |
| `GET` | `/api/source/response-set/:id/findings` | 5.0 |
| `GET` | `/api/source/response-set/:id/manifest` | 5.0 |
| `GET` | `/api/source/response-set/:id/integrity` | **5.0.x** — missing procedures, window status, unresolved findings |
| `GET` | `/api/source/response-set/:id/missing-data` | **5.0.x** — required fields empty / not submitted |
| `GET` | `/api/source/response-set/:id/export-readiness` | **5.0.x** — `ready` \| `ready_with_warnings` \| `not_ready_due_to_blockers` |
| `GET` | `/api/source/response-set/:id/deviation-risks` | **5.1** — protocol deviation risk summary |
| `POST` | `/api/source/response-set/:id/deviation-note` | **5.1** — document reason/comment (audit) |
| `GET` | `/api/subject/:id/data-consistency` | **5.1** — cross-visit consistency (read) |
| `GET` | `/api/study/:id/sponsor-export-readiness` | **5.1** — study-level export gate |
| `GET` | `/api/visit/:id/integrity` | **5.1** — visit-level procedure/window/finding rollup |
| `GET` | `/api/visit/:id/window-status` | **5.1** — scheduled vs actual vs protocol window |
| `GET` | `/api/study/:id/procedure-compliance` | **5.1** — expected vs performed procedures |

**Visit lifecycle (existing):** `complete_procedure_execution`, `complete_visit`, `lock_visit` remain in `lib/actions/*` (Phase 3C) — separate from source capture API pass.

---

## 5. Endpoint behavior (integrity-focused)

### 5.1 `POST .../save-draft`

| Aspect | Rule |
|--------|------|
| Hard block | Auth, tenant, visit locked, invalid shape, RPC `VALUE_TYPE_MISMATCH` |
| Allow | Entry when visit out of window, procedure not done, late procedure |
| Response | `{ ok, data, errors, warnings[] }` — `warnings` from soft checks (read-side helpers or RPC pass-through when added) |
| UI expectation | Show warnings inline; do not clear entered data |

### 5.2 `POST .../submit`

| Aspect | Rule |
|--------|------|
| Hard block | Missing required **source definition** fields; invalid types; set not mutable |
| Do not block | Solely because visit is out of protocol window or optional procedure missing |
| On failure | Return `SUBMIT_VALIDATION_FAILED` + per-field errors (RPC) |
| On success | Optionally include `warnings[]` for export readiness / deviation risks |

### 5.3 `GET .../response-set/:id/integrity` (future)

Returns aggregated **reconciliation** (SELECT + views, no TS rules):

```json
{
  "ok": true,
  "data": {
    "source_response_set_id": "uuid",
    "missing_required_fields": [],
    "missing_procedures": [],
    "out_of_window_visit": false,
    "late_procedures": [],
    "unresolved_findings": [],
    "protocol_deviation_risks": []
  }
}
```

### 5.4 `GET .../response-set/:id/export-readiness` (future)

```json
{
  "ok": true,
  "data": {
    "status": "ready | ready_with_warnings | not_ready_due_to_blockers",
    "blockers": [],
    "warnings": [],
    "sponsor_package_refs": []
  }
}
```

| Status | Meaning |
|--------|---------|
| `ready` | No blockers; warnings acceptable or none |
| `ready_with_warnings` | Export allowed with documented exceptions |
| `not_ready_due_to_blockers` | Hard integrity failures (e.g. unsubmitted required set, open error-severity findings per policy) |

### 5.5 `GET .../deviation-risks` + `POST .../deviation-note` (future)

- **Risks:** Read-only classification of schedule/procedure/window issues linked to set/visit.  
- **Note:** Append operational/deviation documentation (reason required); may link to finding id — implementation via operational_events or dedicated table in **future migration** (not Phase 5.0).

---

## 6. Request / response contracts

### 6.1 Common envelope

**Success (HTTP 200):**

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": {},
  "errors": [],
  "warnings": []
}
```

- `errors[]` — hard validation failures (may still be HTTP 422 with `ok: false`).  
- `warnings[]` — soft integrity / protocol deviation / export readiness items; **do not** imply failure when `ok: true`.

**Warning item shape:**

```json
{
  "code": "PROTOCOL_DEVIATION_RISK",
  "severity": "warning",
  "message": "Visit occurred outside protocol window",
  "context": { "visit_id": "uuid", "rule_reference": "SCHEDULE_WINDOW" }
}
```

### 6.2 Write bodies (unchanged mapping — see prior plan)

Publish, open, save-draft, submit, correct, addendum, findings — same JSON shapes as Phase 5.0 draft; RPC parameter mapping unchanged (§8).

### 6.3 Read shapes

| Endpoint | `data` highlights |
|----------|-------------------|
| `GET .../response-set/:id` | Set + current responses + `visit_status` |
| `GET .../history` | Full audit trail (responses, corrections, addenda) |
| `GET .../findings` | Integrity findings / queries |
| `GET .../manifest` | SDV fields/sections for capture |
| `GET .../missing-data` | Required vs captured matrix |
| `GET .../integrity` | §5.3 rollup |
| `GET .../export-readiness` | §5.4 classification |

Reads **compose** existing tables; they **must not** re-implement submit validation in TypeScript.

---

## 7. Error normalization

| Source | HTTP | `code` | Category |
|--------|------|--------|----------|
| No session | 401 | `AUTH_REQUIRED` | Hard |
| Org mismatch | 403 | `FORBIDDEN` | Hard |
| Invalid JSON shape | 400 | `INVALID_INPUT` | Hard |
| RPC `ok: false` (submit validation) | 422 | `SUBMIT_VALIDATION_FAILED` | Hard |
| `VISIT_LOCKED` | 409 | `VISIT_LOCKED` | Hard |
| `VALUE_TYPE_MISMATCH` | 422 | `VALUE_TYPE_MISMATCH` | Hard |
| `SET_NOT_MUTABLE` | 409 | `SET_NOT_MUTABLE` | Hard |
| Soft protocol/window issue | 200 | — | Warning in `warnings[]` |
| Not found (RLS) | 404 | `NOT_FOUND` | Hard |

**Implementation:** `lib/api/source/map-rpc-error.ts` — never conflate `warnings` with `errors`.

---

## 8. RPC mapping table (Phase 5.0 writes)

| API route | Postgres RPC | Notes |
|-----------|--------------|-------|
| `POST /api/source/publish` | `publish_source_package` | DEFINER; definitions + snapshots |
| `POST /api/source/response-set/open` | `open_source_response_set` | INVOKER |
| `POST /api/source/response-set/save-draft` | `save_source_draft` | INVOKER; attach warnings in API layer from reads |
| `POST /api/source/response-set/submit` | `submit_source_response_set` | INVOKER; required-field hard block |
| `POST /api/source/response/correct` | `correct_source_response` | INVOKER |
| `POST /api/source/response-set/addendum` | `add_source_addendum` | INVOKER |
| `POST /api/source/findings` | `create_source_validation_finding` | INVOKER |
| `POST .../acknowledge` | `acknowledge_source_validation_finding` | INVOKER |
| `POST .../resolve` | `resolve_source_validation_finding` | INVOKER |
| `POST .../waive` | `waive_source_validation_finding` | INVOKER |

**Future reads (§4.E):** No new RPC required for v1 if implemented as RLS SELECT + SQL views; optional `phase5_*` helper functions in **later** migration only if composition becomes too heavy — not in 5.0.

---

## 9. No integrity rules in API (formerly “no logic in API”)

**Allowed in API:**

- Request shape validation (UUIDs, enums, one value slot per response item)  
- Session + `organization_id` membership  
- HTTP mapping and error/warning envelopes  
- **Aggregating** read models from RLS queries (counts, lists, classifications already defined in DB or config)  
- Attaching **precomputed** warning codes returned by RPC when backend adds them  

**Forbidden in API:**

- Deciding medical appropriateness of a visit or procedure  
- Blocking capture **only** for out-of-window visit (use warnings + findings)  
- Re-implementing required-field matrix, widget matching, finding state machine, correction lineage  
- Mutating `published_*` except via `publish_source_package`  
- Using `service_role` as the collection actor  

**Litmus test:** If `validate-phase4b-runtime-e2e.mjs --mutating` proves it at the RPC layer, the API only wraps it.

**UI role:** Guide entry (required indicators, warnings, deviation prompts); **backend remains source of truth.**

---

## 10. Security guardrails

| Guardrail | Enforcement |
|-----------|-------------|
| Multi-tenant isolation | `organization_id` + RLS |
| Collection authorization | RPC `user_can_manage_subject_enrollment` |
| Publish authorization | RPC `phase4c_user_can_publish_source_package` |
| Immutable submitted facts | Correction/addendum RPCs only |
| Visit lock | Hard block on draft save; correction/addendum still per 4B policy |
| No service role as collector | Lint ban in `app/api/source` |
| PHI | No values in logs/analytics — [`healthcare-compliance-rules`](../guardrails/healthcare-compliance-rules.md) |
| Not clinical decision support | Product copy + API codes use **data integrity** / **protocol deviation risk** language |

---

## 11. Test plan

### 11.1 Prerequisites

```bash
npm run db:validate-phase4b-runtime
npm run db:validate-phase4c
npm run db:validate-phase3c
npm run db:validate-phase4b-runtime-e2e:full -- --mutating  # staging
```

### 11.2 Phase 5.0 API tests

| Scenario | Expect |
|----------|--------|
| Happy path capture | open → save → submit |
| Save with window warning | 200 + `warnings` (when helper exists); data persisted |
| Submit missing required field | 422 hard error |
| Submit with window deviation only | **Success** if required fields complete (no hard block for window alone) |
| Finding lifecycle | create → acknowledge → resolve |
| Post-submit correct/addendum | append-only |
| Export readiness read | Classifies status without blocking prior capture |
| Hard: post-submit draft save | 409/422 |
| Hard: cross-tenant | 403 |

### 11.3 Regression

RPC E2E must remain **17 pass / 0 fail** after API work (no migration changes in 5.0).

---

## 12. Exact next step

1. **Scaffold** `lib/api/source/` (rpc-client, map-rpc-error, require-org, schemas) with **warnings[]** in envelope.  
2. **Implement Phase 5.0 write slice:** `open` → `save-draft` (pass-through warnings stub empty until read helpers exist) → `submit` → `GET manifest` + `GET response-set/:id`.  
3. **Spec** `PHASE5-SOURCE-API-CONTRACTS.md` appendix with hard vs soft codes.  
4. **Plan 5.0.x read endpoints:** `integrity`, `missing-data`, `export-readiness` as RLS SELECT compositions (no new RPCs until justified).  
5. **Plan 5.1:** `deviation-risks`, `deviation-note`, visit/subject/study reconciliation routes + UI on visit page.  
6. **Future migration gate (not 5.0):** Only if deviation-note or compliance views cannot be expressed via existing `operational_events` + findings — propose Phase 5.2 DDL separately.

**First PR:** Group B + minimal Group E (`manifest`, `response-set/:id`) — thinnest vertical slice for a collection screen.

---

## Appendix — File layout (planned)

```text
app/api/source/
  publish/...
  response-set/open|save-draft|submit|addendum|...
  response-set/[id]/route.ts
  response-set/[id]/history|findings|manifest|integrity|missing-data|export-readiness|deviation-risks/
  response/correct/
  findings/...
app/api/visit/[id]/integrity|window-status/     # 5.1
app/api/subject/[id]/data-consistency/          # 5.1
app/api/study/[id]/sponsor-export-readiness|procedure-compliance/  # 5.1

lib/api/source/
  rpc-client.ts
  map-rpc-error.ts
  warnings.ts          # merge soft findings into envelope
  readiness.ts         # classify export status (read-only)
  schemas/
```

---

## References

- Collection RPCs: `docs/PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`  
- E2E proof: `docs/PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`  
- Publish: `docs/PHASE4C13-PUBLISH-SOURCE-PACKAGE-RPC.md`  
- Visit actions: `lib/actions/complete-visit.ts`
