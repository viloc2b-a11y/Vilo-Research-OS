# Phase 5.0 — Source API Contracts

**Status:** Contracts + envelope library (no routes).  
**Parent:** [`PHASE5-RUNTIME-API-LAYER-PLAN.md`](./PHASE5-RUNTIME-API-LAYER-PLAN.md)  
**Implementation:** `lib/api/source/types.ts` · `lib/api/source/errors.ts` · `lib/api/source/envelope.ts`

---

## A. Purpose

Define the **shared HTTP JSON contract** for the Data Integrity & Sponsor-Ready Collection Engine API layer before route handlers exist.

Goals:

- One envelope shape for all `/api/source/**` (and related reconciliation) responses  
- Clear separation of **hard-block errors** (action failed) vs **soft warnings** (alert / document / escalate)  
- Pass-through of Postgres RPC `errors[]` without hiding messages  
- Types for future read models (`integrity`, `export-readiness`, findings) without implementing queries in 5.0  

The API does **not** adjudicate final protocol deviation status or perform medical decision support.

---

## B. Envelope structure

Every JSON response uses:

```typescript
interface ApiEnvelope<T> {
  ok: boolean
  code: string
  data: T | null
  errors: ApiError[]
  warnings: ApiWarning[]
  meta: {
    requestId: string
    timestamp: string      // ISO-8601
    source: 'api'
    rpc?: string           // e.g. save_source_draft
    hardBlockCount: number
    warningCount: number
  }
}
```

### Invariants

| Rule | Behavior |
|------|----------|
| `warnings[]` alone | **Never** set `ok: false` |
| `errors[]` non-empty | **`ok: false`** |
| `data` on success | Populated when RPC/read succeeded |
| `data` on hard failure | `null` unless partial semantics are explicitly documented later |
| `meta.hardBlockCount` | Always `errors.length` |
| `meta.warningCount` | Always `warnings.length` |

### Builders

| Function | Use |
|----------|-----|
| `okEnvelope(data, options?)` | Success + optional warnings |
| `errorEnvelope(code, errors, options?)` | Hard failure |
| `fromRpcEnvelope(rpcResult, options?)` | Map RPC jsonb → envelope |
| `fromRpcThrown(error, options?)` | Supabase/Postgres throw → envelope |
| `apiError(code, message, context?)` | Construct `ApiError` |
| `warning(code, message, context?)` | Construct `ApiWarning` |
| `normalizeRpcError(error)` | Single throw → `ApiError[]` |

---

## C. Hard-block vs soft-warning model

| Category | `ok` | User action | Examples |
|----------|------|-------------|----------|
| **Hard validation error** | `false` | Fix input, use correction/addendum, or stop | Missing required field at submit, invalid type, no auth |
| **Soft integrity finding** | `true` (may coexist) | Continue capture; acknowledge/query | Visit out of window, procedure late |
| **Protocol deviation risk** | `true` + warning | Document via finding / deviation note (5.1) | Schedule misalignment |
| **Export readiness warning** | `true` on capture; read endpoint classifies | Resolve before sponsor export | Unresolved findings |

**Capture rules (API behavior):**

- `save-draft` → may return `200` + `warnings[]`; must not hard-block solely for window/procedure soft issues.  
- `submit` → hard-block for missing **required source fields**; not solely for visit window deviation.  
- API **does not** decide final protocol deviation disposition — backend findings + human workflow do.

---

## D. Error / warning catalog

### D.1 Hard-block codes (`errors[]`)

| Code | Typical source | HTTP (suggested) |
|------|----------------|------------------|
| `UNAUTHORIZED` | `AUTH_REQUIRED`, no session | 401 |
| `FORBIDDEN` | RPC `FORBIDDEN`, role | 403 |
| `INVALID_REQUEST` | Shape / `INVALID_INPUT` | 400 |
| `SOURCE_DEFINITION_UNPUBLISHED` | Unpublished SDV | 422 |
| `FIELD_BINDING_INVALID` | PE/SDV mismatch, addendum manifest | 422 |
| `VALUE_TYPE_INVALID` | `VALUE_TYPE_MISMATCH` | 422 |
| `REQUIRED_FIELD_MISSING` | `SUBMIT_VALIDATION_FAILED` | 422 |
| `SUBMITTED_VALUE_IMMUTABLE` | `SET_NOT_MUTABLE`, `VISIT_LOCKED` (draft) | 409 |
| `TENANT_SCOPE_VIOLATION` | `ORGANIZATION_MISMATCH` | 403 |
| `LINEAGE_CONFLICT` | Duplicate active set / lineage | 409 |
| `NOT_FOUND` | Missing row under RLS | 404 |
| `RPC_ERROR` | Unmapped Postgres message | 422 |
| `INTERNAL_ERROR` | Unexpected 5xx | 500 |

Unknown RPC codes are passed through in `error.code` with `source: 'rpc'` and original message preserved in `message` / `context`.

### D.2 Warning codes (`warnings[]`)

| Code | Meaning |
|------|---------|
| `VISIT_OUT_OF_WINDOW` | Visit outside protocol schedule window |
| `PROCEDURE_NOT_PERFORMED` | Expected procedure not completed |
| `PROCEDURE_LATE` | Procedure performed off schedule |
| `EXPECTED_LAB_MISSING` | Expected lab/vendor data absent |
| `EPRO_INCOMPLETE` | ePRO not completed when expected |
| `UNRESOLVED_FINDINGS` | Open/acknowledged findings remain |
| `EXPORT_READY_WITH_WARNINGS` | Export allowed with documented exceptions |
| `PROTOCOL_DEVIATION_RISK` | Potential deviation — visibility only |

Warnings use `severity` default `warning`; may be `info` or `error` for display weight — still does not set `ok: false` alone.

### D.3 Read model types (future routes)

| Type | Purpose |
|------|---------|
| `ApiFindingSummary` | Finding row in lists |
| `ApiIntegrityStatus` | `GET .../integrity` rollup |
| `ApiExportReadiness` | `status`: `ready` \| `ready_with_warnings` \| `not_ready_due_to_blockers` |

---

## E. RPC mapping principles

1. **Writes** call existing RPCs only; use `fromRpcEnvelope(await supabase.rpc(...))`.  
2. **Never strip** RPC `errors[]` — map each item to `ApiError` with `source: 'rpc'`.  
3. **Exception strings** `CODE: message` → map prefix via `normalizeRpcError` (e.g. `VISIT_LOCKED` → `SUBMITTED_VALUE_IMMUTABLE`).  
4. **Optional RPC `warnings`** (future) append to API `warnings[]`; API may add read-derived warnings later.  
5. **Reads** return `okEnvelope` from SELECT composition; no re-validation of submit rules in TypeScript.  
6. Set `meta.rpc` to the function name for traceability.  

---

## F. Examples

### F.1 Success with warnings (save draft)

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": { "saved": 3, "skipped": 0 },
  "errors": [],
  "warnings": [
    {
      "code": "VISIT_OUT_OF_WINDOW",
      "message": "Visit date is outside the protocol window for V_SCREENING",
      "severity": "warning",
      "source": "integrity_read",
      "context": { "visit_id": "…", "rule_reference": "SCHEDULE_WINDOW" }
    }
  ],
  "meta": {
    "requestId": "8f2c…",
    "timestamp": "2026-05-16T20:00:00.000Z",
    "source": "api",
    "rpc": "save_source_draft",
    "hardBlockCount": 0,
    "warningCount": 1
  }
}
```

### F.2 Hard failure (submit — required field)

```json
{
  "ok": false,
  "code": "SUBMIT_VALIDATION_FAILED",
  "data": null,
  "errors": [
    {
      "code": "REQUIRED_FIELD_MISSING",
      "message": "Required field fld_xyz has no current value",
      "source": "rpc",
      "context": { "rpc_code": "REQUIRED_FIELD_EMPTY", "source_field_id": "…" }
    }
  ],
  "warnings": [],
  "meta": {
    "requestId": "a91b…",
    "timestamp": "2026-05-16T20:01:00.000Z",
    "source": "api",
    "rpc": "submit_source_response_set",
    "hardBlockCount": 1,
    "warningCount": 0
  }
}
```

### F.3 RPC throw (visit locked on draft save)

```json
{
  "ok": false,
  "code": "SUBMITTED_VALUE_IMMUTABLE",
  "data": null,
  "errors": [
    {
      "code": "SUBMITTED_VALUE_IMMUTABLE",
      "message": "cannot save draft on a locked visit",
      "source": "rpc",
      "context": { "rpc_prefix": "VISIT_LOCKED", "raw": "VISIT_LOCKED: …" }
    }
  ],
  "warnings": [],
  "meta": { "requestId": "…", "timestamp": "…", "source": "api", "rpc": "save_source_draft", "hardBlockCount": 1, "warningCount": 0 }
}
```

### F.4 Export readiness (read — future)

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": {
    "status": "ready_with_warnings",
    "blockers": [],
    "warnings": [
      { "code": "UNRESOLVED_FINDINGS", "message": "2 findings not resolved", "severity": "warning" }
    ]
  },
  "errors": [],
  "warnings": [],
  "meta": { "requestId": "…", "timestamp": "…", "source": "api", "hardBlockCount": 0, "warningCount": 0 }
}
```

Note: export readiness warnings may appear in `data` for structured reads; route-level `warnings[]` is for **action** responses (save/submit).

---

## G. Exact next step

1. Implement `app/api/source/response-set/open/route.ts` using `fromRpcEnvelope` + `httpStatusForEnvelope`.  
2. Add Zod request schemas in `lib/api/source/schemas/response-set.ts`.  
3. Wire `require-session` / `require-org` helpers (mirror `lib/auth/session.ts`).  
4. Add `scripts/validate-phase5-source-api.mjs` smoke tests against first three routes.  

**Do not** add migrations or integrity algorithms in the API layer.

---

## References

- Plan: `docs/PHASE5-RUNTIME-API-LAYER-PLAN.md`  
- RPC contracts: `docs/PHASE4B1-RUNTIME-CAPTURE-RPC-PLAN.md`  
- E2E proof: `tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json`
