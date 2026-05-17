# Phase 5.1B Step 2 — Runtime change-control & history API

**Status:** Implemented — thin wrappers over Phase 4B.1 / 5.1B RPCs.  
**Parents:** [`PHASE5.1A-RUNTIME-WRITE-API.md`](./PHASE5.1A-RUNTIME-WRITE-API.md) · [`PHASE5.1B-DATABASE-RPC-STEP1.md`](./PHASE5.1B-DATABASE-RPC-STEP1.md)

**No migrations · no UI · no table writes in routes · no history reconstruction in routes.**

---

## Routes

| Method | Path | RPC |
|--------|------|-----|
| `POST` | `/api/source/response/correct` | `correct_source_response` |
| `POST` | `/api/source/response-set/addendum` | `add_source_addendum` |
| `POST` | `/api/source/findings/create` | `create_source_validation_finding` |
| `POST` | `/api/source/findings/acknowledge` | `acknowledge_source_validation_finding` |
| `POST` | `/api/source/findings/resolve` | `resolve_source_validation_finding` |
| `POST` | `/api/source/findings/waive` | `waive_source_validation_finding` |
| `GET` | `/api/source/response-set/[id]/history?organization_id=` | `get_source_response_set_history` |

---

## Request shape notes (API → RPC)

| API field | RPC arg |
|-----------|---------|
| `correction_reason` (or `reason`) | `p_reason` |
| `corrected_value` | `p_corrected_value` |
| `finding_text` (or `message`) | `p_message` |
| `addendum_text` | `{ value_text }` + optional `p_reason` |
| `structured_payload` (or `value`) | `p_value` |
| `resolution_text` / `waiver_reason` | `p_comment` |

**Addendum:** `source_field_id` is required (RPC contract); value must be a widget payload object.

**History:** `limit` / `cursor` query params are accepted and echoed in `meta.pagination` with `applied: false` until the RPC supports paging.

---

## QA

```bash
npx tsc --noEmit
npm run db:validate-phase4b-runtime
```

Manual: authenticated session + org membership; call routes with staging IDs from E2E harness.
