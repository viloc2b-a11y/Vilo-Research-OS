# Phase 16B — Coordinator Operational Surface

Coordinator-first operational UX: Site → Study → Subject → Visit → Source → Next Action.

## Data sources (no fake dashboards)

- `visit_coordinator_orchestration_projections` — next actions, work queue
- `visit_readiness_projections` — blocked visits, source/signature counts
- `subject_coordinator_orchestration_projections` — subject queue
- `subject_runtime_projections` / `study_execution_projections`
- Existing read models: command center lists, workspace lists, visit runtime UI

## Work queue buckets

**Coordinator operational survival prioritization** (derived routing buckets — not a task-management system for sponsors or monitors).

Derived via `mapOperationalWorkQueue()`:

- Do now
- Blocked
- Needs PI/Sub-I
- Source incomplete
- Safety/governance
- Follow-up later

## Pilot UX guardrails

- `MAX_WORK_QUEUE_ITEMS_SHOWN` (5) per bucket on visit UI
- Compact layouts when item counts are high
- Empty states explain what to do when projections are missing
- No sponsor-facing labels; no fabricated metrics

## Smoke

```bash
npm run coordinator-ops:smoke
```
