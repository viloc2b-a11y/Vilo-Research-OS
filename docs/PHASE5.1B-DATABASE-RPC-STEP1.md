# Phase 5.1B — Database RPC Step 1

**Status:** Migration `0040` — history reconstruction + finding lifecycle event log.  
**Scope:** SQL only — no API routes, UI, or RPC rewrites of GREEN 0036/0037.

---

## A. Purpose

Deliver the **database-side** contracts for immutable history reconstruction and append-only finding lifecycle auditing, aligned with the Data Integrity & Sponsor-Ready Collection Engine.

**Important:** Correction, addendum, and finding **write RPCs already exist** and are GREEN (E2E 17/0/1). This step **does not replace** them.

---

## B. BEFORE / AFTER

### BEFORE (0036–0039)

| Capability | Location |
|------------|----------|
| `correct_source_response` | `0036_phase4b1_correction_addendum_rpc.sql` |
| `add_source_addendum` | `0036` |
| `create_source_validation_finding` | `0037_phase4b1_validation_finding_rpc.sql` |
| `acknowledge_source_validation_finding` | `0037` |
| `resolve_source_validation_finding` | `0037` |
| `waive_source_validation_finding` | `0037` |
| Append-only tables | `0022` corrections, `0023` addenda, `0024` findings |
| Chronology read RPC | **Not present** |
| Finding lifecycle event log | **Not present** (status on finding row only) |

### AFTER (0040)

| Addition | Purpose |
|----------|---------|
| `source_response_validation_finding_events` | Append-only state transitions (`prior_status` → `new_status`, actor, reason) |
| Trigger `source_response_validation_findings_lifecycle_log` | Logs INSERT/UPDATE status changes without altering 0037 RPC bodies |
| `get_source_response_set_history` | Read-only chronological reconstruction |

---

## C. RPC inventory (required list)

| # | RPC | Step 1 action |
|---|-----|----------------|
| 1 | `correct_source_response` | **Unchanged** — use 0036 |
| 2 | `add_source_addendum` | **Unchanged** — use 0036 |
| 3 | `create_source_validation_finding` | **Unchanged** — use 0037 |
| 4 | `acknowledge_source_validation_finding` | **Unchanged** — use 0037 |
| 5 | `resolve_source_validation_finding` | **Unchanged** — use 0037 |
| 6 | `waive_source_validation_finding` | **Unchanged** — use 0037 |
| 7 | `get_source_response_set_history` | **New in 0040** |

---

## D. Schema alignment notes (5.1B spec vs existing GREEN)

To preserve GREEN behavior, **no breaking changes** were made to enums or RPC signatures.

| 5.1B spec item | Existing implementation |
|----------------|----------------------|
| Finding severities `low/medium/high/critical` | `info` / `warning` / `error` on `0024` |
| Finding categories (`missing_required`, `protocol_deviation_risk`, …) | `finding_type`: `range`, `required`, `consistency`, `format`, `custom` |
| Addendum `addendum_text` / `structured_payload` | `late_entry_reason` + value on `source_responses` via `0036` RPC |
| Correction `original_value` / `corrected_value` columns | Facts on `source_responses` rows; metadata in `0022` (`prior_value_reference`, correction row) |

Future 5.1B+ migrations may add **parallel** category/severity maps or nullable columns — not in this step.

---

## E. Tables added

### `source_response_validation_finding_events`

| Column | Notes |
|--------|-------|
| `finding_id` | FK to findings |
| `response_set_id` | Denormalized for history queries |
| `prior_status` / `new_status` | Transition |
| `actor_user_id` | `auth.uid()` at transition |
| `reason` | Required for terminal transitions |
| `operational_event_id` | Optional link (nullable; RPC may set separately) |

Append-only: no UPDATE/DELETE policies for authenticated roles.

---

## F. Indexes added

| Index | Table |
|-------|-------|
| `source_response_validation_finding_events_set_occurred_idx` | `(response_set_id, occurred_at)` |
| `source_response_validation_finding_events_finding_idx` | `(finding_id, occurred_at)` |

---

## G. `get_source_response_set_history`

**Signature:** `(p_organization_id uuid, p_source_response_set_id uuid) returns jsonb`

**Security:** `SECURITY INVOKER` — RLS on underlying tables.

**Envelope:**

```json
{
  "ok": true,
  "code": "SUCCESS",
  "data": {
    "source_response_set_id": "…",
    "study_subject_id": "…",
    "procedure_execution_id": "…",
    "event_count": 12,
    "events": [
      {
        "occurred_at": "…",
        "event_kind": "response_set_opened",
        "actor_user_id": "…",
        "payload": {}
      }
    ]
  },
  "errors": [],
  "warnings": [],
  "meta": { "source": "rpc", "rpc": "get_source_response_set_history", "timestamp": "…" }
}
```

**Event sources (chronological union):**

1. Response set `opened_at` / `submitted_at`  
2. `operational_events` (submit, correct, addendum, finding RPC events)  
3. `source_response_corrections`  
4. `source_response_addenda`  
5. `source_response_validation_finding_events`  
6. Legacy findings without event rows (one-time `validation_finding_recorded`)  
7. Per-response snapshots (`draft_saved` / `submitted_snapshot`)  

**Does not:** mutate data, adjudicate protocol deviations, or re-run submit validation.

---

## H. Minimal test SQL

See `supabase/tests/phase51b_history_rpc_examples.sql`.

```bash
npm run db:migrate
npm run db:validate-phase4b-runtime
```

---

## I. Architectural risks

| Risk | Mitigation |
|------|------------|
| Duplicate timeline entries (operational + finding_events) | Consumers may dedupe by `payload.finding_id`; document in API read layer |
| Large history for busy sets | Paginate in future `get_source_response_set_history` v2; index on `(response_set_id, occurred_at)` |
| Trigger requires `auth.uid()` | Service-role bulk loads must not UPDATE findings outside user context |
| Pre-0040 findings lack lifecycle events | Fallback `validation_finding_recorded` row from findings table |

---

## J. Recommended follow-up before API routes

1. Apply `0040` on staging; smoke `get_source_response_set_history` on E2E set id.  
2. **5.1B Step 2 (API):** `POST` correct, addendum, findings + `GET` history route wrapping existing RPCs.  
3. Optional **0041:** map 5.1B severity/category vocabulary as additive columns (non-breaking).  
4. Optional history v2: cursor pagination + filter by `event_kind`.

---

## References

- `supabase/migrations/0036_phase4b1_correction_addendum_rpc.sql`  
- `supabase/migrations/0037_phase4b1_validation_finding_rpc.sql`  
- `supabase/migrations/0040_phase51b_history_and_finding_events.sql`  
- `docs/PHASE5-SOURCE-API-CONTRACTS.md`
