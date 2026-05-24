# Runtime Replay & Operational Intelligence — Phase 5

Status: Active  
Purpose: Inspection-grade replay and runtime-emergent operational intelligence — **no dashboards, BI, or AI**.

## Architecture

```
operational_events (canonical chronology)
        +
execution tables (visits, procedures, source, AE, workflow)
        +
derived layers (graph, safety, governance, projections)
        │
        ├─► rebuildVisitReplay / rebuildSubjectReplay
        │         timeline segments + causality + explanations
        │
        └─► computeVisitOperationalIntelligence
                  burden · complexity · friction · risk
```

**Rules**

1. Replay **explains** runtime; it does not replace execution tables.
2. Intelligence metrics are **derived** from live runtime state, not static analytics.
3. `runtime_replay_artifacts` and `*_operational_intelligence_projections` are rebuildable caches.
4. Full replay is available on-demand; visit readiness refresh stores intelligence snapshots only.

## Replay deliverables

| Capability | API |
|------------|-----|
| Visit execution timeline | `rebuildVisitReplay` → `visit_execution` segment |
| Source/signature chronology | `source_signature` segment |
| Safety escalation chain | `safety_escalation` segment |
| Workflow/query chain | `workflow_query` segment |
| Governance emergence | `governance_emergence` segment |
| Readiness blocked explanation | `explainVisitReadinessBlocked` |
| Graph trigger explanation | `explainGraphTriggersForVisit` |
| Causality chain | `buildCausalityChainFromTimeline` |
| Subject-level replay | `rebuildSubjectReplay` |

## Operational intelligence

| Metric | Module |
|--------|--------|
| Coordinator burden | `metrics/coordinator-burden.ts` |
| Visit complexity | `metrics/visit-complexity.ts` |
| Protocol friction | `metrics/protocol-friction.ts` |
| Runtime risk | `metrics/runtime-risk.ts` |
| Signals | `signals/engine.ts` |

## Visit readiness pipeline (Phase 5 extension)

```
base → graph → safety → governance → operational intelligence
```

Snapshot fields: `operationalIntelligence`, `replayBlockedSummary`.

## Usage

```typescript
import { rebuildVisitReplay, persistRuntimeReplayArtifact } from '@/lib/runtime-replay'
import { computeVisitOperationalIntelligence } from '@/lib/operational-intelligence'

const artifact = await rebuildVisitReplay({ supabase, organizationId, studyId, visitId })
await persistRuntimeReplayArtifact(supabase, artifact)

const intel = await computeVisitOperationalIntelligence({
  supabase, organizationId, studyId, studySubjectId, visitId,
})
```

Migration: `0078_phase5_runtime_replay.sql`

## Deferred

- Dashboards and sponsor reporting
- AI copilots and narrative summaries
- Enterprise BI warehouses
- Full automated replay on every mutation (use targeted refresh / on-demand)
