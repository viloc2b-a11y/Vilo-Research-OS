# Phase 5.1C — Canonical read APIs

**Status:** Implemented — RPC read models + thin GET routes.  
**Parents:** [`PHASE5.1B-RUNTIME-API-STEP2.md`](./PHASE5.1B-RUNTIME-API-STEP2.md) · [`PHASE5-SOURCE-API-CONTRACTS.md`](./PHASE5-SOURCE-API-CONTRACTS.md)

**Migration:** `0041_phase51c_read_rpcs.sql`  
**No UI · no caching · no write-path changes.**

---

## Routes

| Method | Path | RPC |
|--------|------|-----|
| `GET` | `/api/source/response-set/[id]?organization_id=` | `get_source_response_set` |
| `GET` | `/api/source/response-set/[id]/manifest?organization_id=` | `get_source_response_set_manifest` |
| `GET` | `/api/source/response-set/[id]/findings?organization_id=` | `list_source_response_set_findings` |
| `GET` | `/api/source/response-set/[id]/history?organization_id=` | `get_source_response_set_history` (5.1B) |

All require session + `organization_id` query param.

### Findings query filters

| Param | Values |
|-------|--------|
| `active_only` | `true` / `1` → status in `open`, `acknowledged` |
| `status` | `open` \| `acknowledged` \| `resolved` \| `waived` |
| `severity` | `info` \| `warning` \| `error` |

---

## Read model: `GET /response-set/[id]`

`data` shape (RPC-owned):

| Section | Contents |
|---------|----------|
| `response_set` | Metadata: ids, org/study/subject/visit/PE, SDV ref, status, attribution timestamps |
| `fields[]` | Per SDV field: `field_key`, `current_effective`, `history[]` (all sequences, raw values) |
| `corrections[]` | Append-only correction rows + `prior_value` / `corrected_value` payloads |
| `addenda[]` | Late-entry provenance + `structured_payload` when linked response exists |
| `findings_summary` | `active[]` + `counts` (status + severity) |
| `placeholders` | `signatures`, `reviews`, `sdv`, `verification` (not implemented) |
| `lineage` | `immutable_append_only`, `history_rpc`, `chronology_ref` |

**Design:** `current_effective` is explicit; `history[]` preserves prior rows (no hidden overwrite).

---

## Manifest: `GET /manifest`

Lightweight `data` — **no field payloads**:

- `status`, `timestamps`
- `completeness` (required field totals, `is_submitted`)
- `counts` (responses, corrections, addenda, findings)
- `latest_activity` (`occurred_at`, `event_kind`)
- `lineage_refs` (SDV, PE, history/detail RPC names)
- `chronology_checksum` — `null` placeholder

---

## Findings: `GET /findings`

`data` shape:

- `findings[]` — each with lifecycle `status`, attribution, `response_id` / `source_field_id`, `lifecycle_events[]`
- `filters_applied`
- `counts.returned` / `counts.total_in_set`

---

## QA

```bash
npm run db:migrate
npm run db:validate-phase4b-runtime
npx tsc --noEmit
```

Smoke (authenticated):

```http
GET /api/source/response-set/{id}?organization_id={org}
GET /api/source/response-set/{id}/manifest?organization_id={org}
GET /api/source/response-set/{id}/findings?organization_id={org}&active_only=true
```

---

## Risks (documented)

| Risk | Note |
|------|------|
| Response size | Full read includes all fields + full per-field history; paginate in future v2 |
| History overlap | Use `history` route for chronology; detail route for field-effective state |
| Pre-0040 findings | `lifecycle_events` may be empty for legacy rows |
