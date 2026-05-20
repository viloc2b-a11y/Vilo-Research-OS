# Phase 7B — VPI SQL Aggregation Engine

**Status:** Implemented  
**Depends on:** [PHASE7A-READ-LAYER.md](./PHASE7A-READ-LAYER.md)  
**Scope:** Single dashboard RPC + three SQL views. No UI, scoring, charts, trends, or sponsor layer.

---

## 1. Objective

Replace the Phase 7A client-side count fan-out (~200 Supabase round trips for large portfolios) with **one RPC** that returns pre-aggregated operational data. The TypeScript read layer keeps a **fallback** path (`VPI_USE_RPC=false` or RPC failure) identical to Phase 7A.

---

## 2. SQL objects

| Object | Type | Migration |
|--------|------|-----------|
| `subject_workflow_actions.assigned_user_id` | Column `uuid null` → `auth.users` | `0053_phase7b_vpi_sql_aggregation.sql` |
| `vpi_study_health_v1` | View | same |
| `vpi_subject_risk_signals_v1` | View | same |
| `vpi_coordinator_load_v1` | View | same |
| `vpi_load_dashboard()` | RPC → `jsonb` | same |

Supporting indexes (partial where noted) are created in the same migration.

### 2.1 `vpi_study_health_v1`

One row per study visible under RLS. Columns match coordinator study cards + health flags:

`organization_id`, `study_id`, `study_name`, `study_status`, `subject_count`, `enrolled_count`, `active_visit_count`, `missed_visit_count`, `open_query_count`, `open_findings_count`, `blocked_procedure_count`, `unsigned_over_48h_count`, `visits_closing_window_today`, `stale_study_flag`, `last_activity_at`

### 2.2 `vpi_subject_risk_signals_v1`

One row per active risk signal. `signal_kind` ∈:

`missed_visit`, `out_of_window`, `overdue_action`, `blocked_procedure`, `window_warning`, `unsigned_procedure_48h`, `window_closing_today`, `stale_subject`

Extra columns for TS mapping (not required by validator): `subject_identifier`, `study_name`, `signal_entity_id`.

`severity_rank`: `0` = critical, `1` = attention, `2` = warning (aligned with Phase 4 coordinator ordering).

### 2.3 `vpi_coordinator_load_v1`

One row per `(organization_id, user_id)` where `user_id = coalesce(assigned_user_id, created_by)` and the user has open workflow items.

`unassigned_queue` is the org-level count of open actions with `assigned_user_id is null` (repeated on each coordinator row for convenience).

### 2.4 `vpi_load_dashboard()`

No parameters. Returns:

```json
{
  "study_health": [],
  "subject_risk_signals": [],
  "coordinator_load": [],
  "generated_at": "2026-05-17T12:00:00.000Z"
}
```

Rows are limited to `organization_id in (select public.user_organization_ids())`. Study filter (`?studyId=`) is applied in TypeScript after the RPC returns.

**Parity note:** `visitSnapshot` (status histogram) is still loaded via the Phase 7A `loadVisitSnapshot` signal in RPC mode (one additional head-count query bundle). The four RPC keys above are the SQL aggregation contract; visit histograms are deferred to Phase 7B.1 or a future `visit_snapshot` key.

---

## 3. RLS strategy

| Layer | Mechanism |
|-------|-----------|
| Base tables | Existing policies: `user_organization_ids()` + `user_has_study_access(study_id)` |
| Views | `with (security_invoker = true)` — queries run as the **caller**, RLS on underlying tables applies |
| RPC | `security definer` with `auth.uid()` guard; result sets filtered to caller org memberships only |
| Anon | `revoke` select on views and `execute` on RPC |

There is **no** `user_can_access_organization()` in this repo. Membership uses `public.user_organization_ids()` from `0001_auth_foundation.sql`.

---

## 4. Fallback strategy

| Condition | Behavior |
|-----------|----------|
| `VPI_USE_RPC` unset or not `true` | `buildFromSignals()` — Phase 7A path |
| `VPI_USE_RPC=true` and RPC succeeds | `buildFromRpc()` maps JSON → `PerformanceReadModel` |
| RPC throws / returns error | `console.warn` + automatic fallback to `buildFromSignals()` |
| Explicit `opts.mode = 'fallback'` | Always signals |

Caps in `query-limits.ts` apply **only** to fallback mode.

---

## 5. Assumptions about existing tables

| Table | Usage |
|-------|--------|
| `studies` | Study dimension; `status`, `name` |
| `study_subjects` | `enrollment_status = 'enrolled'`; `subject_identifier` |
| `visits` | `visit_status`, `window_status`, `window_end`, `source_status`, `completed_at`, `target_date`, `scheduled_date` |
| `subject_workflow_actions` | `action_type`, `status`, `due_date`, `assigned_user_id`, `created_by` |
| `procedure_executions` | `validation_status = 'blocked'` |
| `source_response_validation_findings` | `status = 'open'`, joined via `source_response_sets.study_id` |
| `operational_events` | `occurred_at` for `last_activity_at` / stale flags |
| `organization_members` | RPC org scope (not `organization_memberships`) |

**Approximations (documented):**

- `unsigned_over_48h_count` / `unsigned_procedure_48h`: visits with `source_status <> 'signed'`, `completed_at` older than 48h — not a full procedure-level signature audit.
- `stale_study_flag`: no `operational_events` (or study activity) in 14 days.
- `stale_subject`: enrolled/screening subject with no visit or workflow `updated_at` in 30 days.
- `blocked_items` on coordinator load: blocked procedures where `performed_by_user_id` matches the coordinator user.

---

## 6. Migration rollback notes

```sql
-- Rollback order (manual)
drop function if exists public.vpi_load_dashboard();
drop view if exists public.vpi_coordinator_load_v1;
drop view if exists public.vpi_subject_risk_signals_v1;
drop view if exists public.vpi_study_health_v1;
drop index if exists public.vpi_workflow_assigned_user_idx;
drop index if exists public.vpi_visits_study_window_end_idx;
drop index if exists public.vpi_visits_unsigned_completed_idx;
alter table public.subject_workflow_actions drop column if exists assigned_user_id;
```

Re-deploy app with `VPI_USE_RPC=false` before rollback if the RPC path is live.

---

## 7. TypeScript integration

- `lib/performance/read-layer/rpc-dashboard.ts` — payload types + `mapRpcDashboardToReadModel()`
- `lib/performance/read-layer/aggregator.ts` — dual mode entry
- Feature flag: `VPI_USE_RPC=true` in `.env.local` / `.env.example`

---

## 8. Validation

```bash
npm run db:validate-phase7b-vpi-views   # static / catalog checks
npx tsc --noEmit
npm run build
```

Live DB checks (views exist, RPC callable) require `DATABASE_URL` and applied migration `0053`.

---

## 9. Out of scope (Phase 7B)

- ~~Scoring (Phase 7C)~~ — see [PHASE7C-SCORING-LITE.md](./PHASE7C-SCORING-LITE.md)
- ~~Command center UI (Phase 7E)~~ — see [PHASE7E-COMMAND-CENTER-MINIMAL.md](./PHASE7E-COMMAND-CENTER-MINIMAL.md)
- `vpi_visit_status_counts_v1` materialized aggregates
- Sponsor / trend layers
- `assigned_user_id` backfill from historical data
