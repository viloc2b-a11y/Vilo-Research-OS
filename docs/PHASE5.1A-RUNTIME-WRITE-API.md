# Phase 5.1A — Runtime capture write API

**Status:** Implemented — thin wrappers over validated RPCs.  
**Parents:** [`PHASE5-SOURCE-API-CONTRACTS.md`](./PHASE5-SOURCE-API-CONTRACTS.md) · [`PHASE5-RUNTIME-API-LAYER-PLAN.md`](./PHASE5-RUNTIME-API-LAYER-PLAN.md)

**No migrations · no UI · no integrity logic in API · no `published_*` writes.**

---

## A. Purpose

Expose the **data collection write path** (open → save draft → submit) as authenticated Next.js App Router routes. Each handler:

1. Validates JSON **shape** only  
2. Verifies session + `organization_id` membership  
3. Calls the existing Postgres RPC  
4. Returns the standard [`ApiEnvelope`](./PHASE5-SOURCE-API-CONTRACTS.md) via `fromRpcEnvelope`

Data integrity rules remain in RPCs/RLS (Phase 4B).

---

## B. Routes created

| Method | Path | File |
|--------|------|------|
| `POST` | `/api/source/response-set/open` | `app/api/source/response-set/open/route.ts` |
| `POST` | `/api/source/response-set/save-draft` | `app/api/source/response-set/save-draft/route.ts` |
| `POST` | `/api/source/response-set/submit` | `app/api/source/response-set/submit/route.ts` |

**Shared libraries:**

| Module | Role |
|--------|------|
| `lib/api/source/auth.ts` | Session + org membership |
| `lib/api/source/validate.ts` | Request body shape (no Zod — not in deps) |
| `lib/api/source/call-rpc.ts` | `supabase.rpc` + envelope wrap |
| `lib/api/source/respond.ts` | `NextResponse.json` + HTTP status |

---

## C. RPC mapping

| Route | RPC | Args |
|-------|-----|------|
| `open` | `open_source_response_set` | `p_organization_id`, `p_study_id`, `p_study_version_id`, `p_study_subject_id`, `p_visit_id`, `p_procedure_execution_id`, `p_source_definition_version_id` |
| `save-draft` | `save_source_draft` | `p_organization_id`, `p_source_response_set_id`, `p_responses` |
| `submit` | `submit_source_response_set` | `p_organization_id`, `p_source_response_set_id`, `p_submit_reason` |

---

## D. Request / response examples

### Open

```http
POST /api/source/response-set/open
Content-Type: application/json
Cookie: <supabase session>

{
  "organization_id": "f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e",
  "study_id": "6bae715a-8536-4000-8d24-22b6a3dbb8c9",
  "study_version_id": "a6ef7089-1415-45d0-b435-4b5ca2b38328",
  "study_subject_id": "3bae1645-b94b-441c-b081-916a03896b0e",
  "visit_id": "bb6302e3-4672-4029-920d-a5e74dec5c17",
  "procedure_execution_id": "5fa0d67e-348b-4535-948b-70d88526db05",
  "source_definition_version_id": "2ee5a544-fba6-4edb-a5c1-61ba5e2eee00"
}
```

**Success (200):**

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": {
    "source_response_set_id": "4611b5ee-d26a-4b49-a572-f8a22873935c",
    "created": true
  },
  "errors": [],
  "warnings": [],
  "meta": {
    "requestId": "…",
    "timestamp": "2026-05-16T…",
    "source": "api",
    "rpc": "open_source_response_set",
    "hardBlockCount": 0,
    "warningCount": 0
  }
}
```

### Save draft

```http
POST /api/source/response-set/save-draft
```

```json
{
  "organization_id": "f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e",
  "source_response_set_id": "4611b5ee-d26a-4b49-a572-f8a22873935c",
  "responses": [
    {
      "source_field_id": "485b66fe-1629-4bd5-bfdf-379924cfa069",
      "value_text": "e2e-staging-value"
    }
  ]
}
```

RPC validates widget/value_type; API does not. Optional `comments` per item is passed through (RPC may not persist per 0034).

### Submit

```http
POST /api/source/response-set/submit
```

```json
{
  "organization_id": "f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e",
  "source_response_set_id": "4611b5ee-d26a-4b49-a572-f8a22873935c",
  "submit_reason": "phase5-api-smoke"
}
```

**Submit failure (422)** — RPC `SUBMIT_VALIDATION_FAILED` / missing required fields passed through in `errors[]`.

---

## E. Error / warning envelope

- **`errors[]`** → `ok: false`; HTTP from `httpStatusForEnvelope` (401/403/400/409/422).  
- **`warnings[]`** → does not set `ok: false`; reserved for future read-derived soft findings on save.  
- RPC messages preserved via `fromRpcEnvelope` / `normalizeRpcError` — not rewritten.  
- Each response includes `meta.requestId` for support correlation.

---

## F. Security model

| Control | Implementation |
|---------|----------------|
| Authentication | `createServerClient()` + `auth.getUser()` |
| Tenant | `organization_members` check before RPC |
| Clinical actor | `auth.uid()` inside RPC only — no service role |
| Writes | RPC only — no direct table DML |
| Published snapshots | Not touched by these routes |

Study enrollment and capture permissions are enforced in RPC (`user_can_manage_subject_enrollment`, RLS).

---

## G. QA commands

### Typecheck

```bash
cd vilo-os
npx tsc --noEmit
```

### Manual smoke (local `next dev` + staging session)

Sign in as `synthetic.staff.a@vilo-os.staging`, then:

```bash
# Open (replace UUIDs from discover-e2e-staging-ids.mjs --fresh)
curl -s -X POST http://localhost:3000/api/source/response-set/open \
  -H "Content-Type: application/json" \
  -b "cookies-from-browser" \
  -d @tmp/smoke/open.json | jq .

curl -s -X POST http://localhost:3000/api/source/response-set/save-draft \
  -H "Content-Type: application/json" \
  -b "cookies-from-browser" \
  -d @tmp/smoke/save-draft.json | jq .

curl -s -X POST http://localhost:3000/api/source/response-set/submit \
  -H "Content-Type: application/json" \
  -b "cookies-from-browser" \
  -d @tmp/smoke/submit.json | jq .
```

**Regression (unchanged RPC layer):**

```bash
npm run db:validate-phase4b-runtime
npm run db:validate-phase4b-runtime-e2e:full -- --mutating  # staging
```

No automated route test harness in repo yet — manual curl only.

---

## H. Next step

1. **5.1B** — `POST /api/source/response/correct`, `POST /api/source/response-set/addendum`, finding routes.  
2. **5.1C** — Read routes: `GET response-set/:id`, `manifest`, `findings`.  
3. **`scripts/validate-phase5-source-api.mjs`** — HTTP smoke against `next dev` with cookie jar.  
4. **5.2 UI** — Visit capture screen calling these three endpoints.

---

## References

- Contracts: `docs/PHASE5-SOURCE-API-CONTRACTS.md`  
- E2E proof: `docs/PHASE4B2-RUNTIME-E2E-QA-HARNESS.md`
