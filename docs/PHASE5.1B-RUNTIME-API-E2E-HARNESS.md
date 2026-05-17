# Phase 5.1B Step 3 — Runtime API E2E harness

**Status:** Implemented  
**Parents:** [`PHASE5.1B-RUNTIME-API-STEP2.md`](./PHASE5.1B-RUNTIME-API-STEP2.md) · [`PHASE5-SOURCE-API-CONTRACTS.md`](./PHASE5-SOURCE-API-CONTRACTS.md)

QA-only: validates HTTP envelopes, auth, tenant isolation, append-only lineage, and history reconstruction for Phase 5.1B routes. Does **not** modify RPCs, routes (except middleware API bypass), or UI.

---

## Commands

| Command | Mode |
|---------|------|
| `npm run db:validate-phase51b-runtime-api-e2e` | Planning (no HTTP) |
| `npm run db:validate-phase51b-runtime-api-e2e:live` | Live HTTP + DB assertions (`--profile full`) |

Report: `tmp/runtime-e2e/phase51b-runtime-api-e2e-report.json`

---

## Live prerequisites

1. Catalog green: `npm run db:validate-phase4b-runtime`
2. Golden artifacts (unless `--skip-publish`)
3. **Next.js dev server:** `npm run dev` (default base `http://localhost:3000` or `E2E_API_BASE_URL`)
4. Staging IDs: `node scripts/discover-e2e-staging-ids.mjs [--fresh]`
5. `.env.local` with Supabase + `DATABASE_URL`

Example live run:

```bash
npm run dev
node scripts/discover-e2e-staging-ids.mjs --fresh
npm run db:validate-phase51b-runtime-api-e2e:live -- \
  --organization-id <org> \
  --study-id <study> \
  --study-version-id <sv> \
  --study-subject-id <subject> \
  --visit-id <visit> \
  --procedure-execution-id <pe> \
  --actor-user-id <user-a-uuid>
```

Reuse an existing submitted set:

```bash
npm run db:validate-phase51b-runtime-api-e2e:live -- \
  --skip-fixture --skip-publish \
  --organization-id <org> \
  --response-set-id <submitted-set-uuid> \
  --actor-user-id <user-a-uuid>
```

---

## Coverage map

| Step | Validates |
|------|-----------|
| `fixture_submitted_set` | RPC setup: publish (optional), open, draft, submit |
| `auth_unauthenticated` | No session → `401` + `UNAUTHORIZED` envelope |
| `auth_invalid_request` | Bad UUID → `400` + `INVALID_REQUEST` |
| `auth_wrong_tenant` | User B + org A resource → `403` / `FORBIDDEN` |
| `correction_api` | `POST /api/source/response/correct` envelope + RPC |
| `correction_lineage` | Prior `source_responses` row unchanged; new `is_current` |
| `correction_repeat` | Second correction; correction count increases |
| `addendum_api` | `POST /api/source/response-set/addendum` |
| `addendum_preserved` | Submitted rows unchanged |
| `finding_resolve_path` | create → acknowledge → resolve + `finding_events` |
| `finding_waive_path` | create → waive + events |
| `history_chronology` | GET history ordered; correction/finding kinds present |
| `history_replay` | Two GETs → identical fingerprint |
| `history_read_no_mutation` | Read does not add corrections/events |
| `pagination_placeholder` | `meta.pagination.applied === false` (full profile) |

---

## Envelope contract (asserted on every API response)

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": {},
  "errors": [],
  "warnings": [],
  "meta": {
    "requestId": "<uuid>",
    "timestamp": "<iso>",
    "source": "api",
    "rpc": "<rpc_name>",
    "hardBlockCount": 0,
    "warningCount": 0
  }
}
```

Helpers: `scripts/lib/source-api-e2e.mjs` → `assertApiEnvelope()`.

---

## Architecture notes

- **Fixture** uses Postgres RPCs (same as Phase 4B E2E) to reach a submitted response set; **mutations under test** use HTTP only.
- **Middleware:** `/api/source/**` bypasses login redirect so routes return JSON `401` (not HTML login).
- **Auth cookies:** Supabase SSR cookie jar via `signInForCookieHeader()`.
- **DB reads** after writes verify append-only lineage; not a substitute for RPC integrity.

---

## Known gaps / risks (documented, not fixed in Step 3)

| Area | Note |
|------|------|
| History duplication | RPC may emit overlapping operational + `finding_events` rows; harness does not dedupe |
| Pre-0040 findings | Lifecycle events only for findings touched after migration `0040` |
| Addendum field | Requires uncaptured field; may `skip` with `NO_ADDENDUM_ELIGIBLE_FIELD` |
| Severity taxonomy | API accepts RPC values (`info` / `warning` / `error`), not low/medium/high |
| Live server | Planning mode passes without Next.js; live requires running dev server |
