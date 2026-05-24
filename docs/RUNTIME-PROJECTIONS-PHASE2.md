# Runtime Projections — Phase 2

Status: Active  
Purpose: Derived operational read models for coordinator execution — **not** source of truth.

## Architecture

```
operational_events (canonical chronology)
        +
execution tables (visits, procedures, source, workflow, AE)
        │
        ▼
  compute*Projection()     ← pure derivation (lib/projections/compute)
        │
        ▼
  *_projections tables     ← derived cache (rebuildable)
        │
        ▼
  load*Projection()        ← read cache or recompute if stale
```

**Rules**

1. Projections never authorize irreversible clinical actions alone.
2. Mutable business truth stays on execution tables + immutable events.
3. Projections may be deleted and rebuilt without data loss.
4. No dashboards or analytics UI in Phase 2 — API/loaders only.

## Tables

| Table | Grain | Purpose |
|-------|-------|---------|
| `visit_readiness_projections` | visit | Procedure/source/safety/completion readiness |
| `subject_runtime_projections` | subject | Longitudinal burden, safety, workflow |
| `study_execution_projections` | study | Enrollment burden, risk, protocol load |
| `runtime_projection_refresh_log` | audit | Refresh/rebuild traceability |

Migration: `0075_phase2_runtime_projections.sql`

## Refresh strategy

| Mode | Function | When |
|------|----------|------|
| **Targeted** | `refreshVisitReadinessProjection`, etc. | After a scoped mutation (optional hook) |
| **Cascade** | `refreshProjectionsCascadeForVisit` | Visit change → subject → study |
| **Lazy load** | `load*Projection({ refreshIfStale: true })` | On read if cache stale (>5 min default) |
| **Rebuild** | `rebuildStudyProjections` | Version bump, drift recovery, admin |

Phase 2 does **not** wire automatic refresh into existing actions (no runtime rewrite). Call refresh explicitly from new code paths.

## Event → projection mapping

See `lib/projections/event-projection-map.ts`. Events do not replay into projections; they **invalidate** scope for recompute.

## Blocker derivation

| Projection | Blocker sources |
|------------|-----------------|
| Visit | `assessProcedureReadiness`, source metrics, unsigned/pending procedures, visit-linked AE |
| Subject | `loadSubjectOperationalIntelligence`, incomplete source, open AE |
| Study | Aggregates + open queries, missed visits, safety counts |

## Rebuild / replay

- **Rebuild** = re-read execution tables for all entities in scope.
- **Replay** (future) = fold `operational_events` in order — not implemented in Phase 2.

## Integrity safeguards

- `RUNTIME_PROJECTION_VERSION` — bump when compute semantics change.
- `isProjectionStale` / `projectionVersionMismatchWarning` on load.
- `assertProjectionDerivedOnly` — dev guard against treating cache as truth.
- `runtime_projection_refresh_log` — operational trace of refresh runs.

## API entry points

```typescript
import {
  refreshProjectionsCascadeForVisit,
  rebuildStudyProjections,
  loadVisitReadinessProjection,
} from '@/lib/projections'
```

## Remaining gaps (Phase 3+)

- Automatic post-mutation refresh hooks (gateway integration).
- Event-driven incremental projection (replay).
- `open_source_response_set` / `save_source_draft` not in event map refresh until spine complete.
- Study compute N+1 per subject — optimize with SQL aggregates.
- No org-wide rebuild scheduler.
- Command center / visit workspace not yet consuming projections.
