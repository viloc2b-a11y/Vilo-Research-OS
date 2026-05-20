# Phase 7E — Command Center (Minimal)

**Status:** Complete  
**Depends on:** [PHASE7C-SCORING-LITE.md](./PHASE7C-SCORING-LITE.md)

## Routes

| Route | Audience | Purpose |
|-------|----------|---------|
| `/performance` | COO / site lead | Portfolio — study health table + risk queue |
| `/performance/today` | Coordinator | Inbox grouped by operational state |
| `/performance/risks` | Coordinator / PI | Owner-centric workflow queue + subject risks |

## UI surfaces

- **Portfolio banner** — `critical · risk · watch · healthy` study counts  
- **Study health table** — Study, State, Critical issues, Needs attention today (+ expand details)  
- **Subject risk queue** — operational state badge + recommended next step  
- **Visit snapshot** — collapsed under `<details>` on portfolio (not default-visible)  
- **Sidebar** — Command sub-nav: Portfolio / Today / Risks when under `/performance/*`

## Read model additions

```ts
portfolioSummary: { critical, risk, watch, healthy }
coordinatorLoad: CoordinatorLoadItem[]  // from RPC; [] in fallback
```

## Coordinator load (`/performance/risks`)

Sourced from `vpi_coordinator_load_v1` via `vpi_load_dashboard`. Columns: Owner, Due today, Blocked by, Recommended next step. Synthetic `unassigned` row when `unassigned_queue > 0`.

## Telemetry

When `buildPerformanceReadModel` exceeds **800 ms**, a best-effort `VPI_LOAD_TELEMETRY` event is appended to `operational_events` (requires resolvable `study_id`).

## Feature flags (`.env`)

```
VPI_USE_RPC=true
VPI_SCORING_ENABLED=true   # set false to disable scoring (reserved)
```

## Validation

```bash
npm run db:validate-phase7e-command-minimal
npm run db:validate-phase7c-scoring
npx tsc --noEmit
npm run build
```

## Out of scope

- PI / Lab / Investigator views  
- `/performance/studies/[id]` drill-down  
- Sponsor view, role switcher, personalization  
- Charts (Recharts, D3, Chart.js)
