# Safety Continuity & Governance Fabric — Phase 4

Status: Active  
Purpose: First runtime-emergent safety continuity and governance layer for coordinator execution.

## Principles

1. **Governance emerges from runtime** — signals are derived from visits, AE registry, source, workflow, graph.
2. **Safety continuity carries across visits** — open subject AEs apply to future visits.
3. **operational_events** remain canonical chronology; safety/governance tables are rebuildable caches.
4. **No independent clinical truth** — `subject_adverse_events` and execution tables are authoritative.
5. **No dashboards, sponsor portals, or full CAPA** in this phase.

## Architecture

```
subject_adverse_events ──┐
source findings ─────────┼──► computeSubjectSafetyContinuity()
workflow (safety) ───────┘           │
                                     ▼
                         visit_safety_carryforward_projections
                                     │
visit + window + readiness ──────────┼──► detectVisitGovernanceSignals()
protocol graph blockers ─────────────┘           │
                                                 ▼
                                    governance_signals (derived)
                                                 │
                                                 ▼
                              visit_readiness_projections.blockers
```

## Tables (migration `0077_phase4_safety_governance.sql`)

| Table | Grain | Role |
|-------|-------|------|
| `subject_safety_continuity_projections` | subject | Longitudinal unresolved safety |
| `visit_safety_carryforward_projections` | visit | Carry-forward overlay |
| `governance_signals` | signal | Runtime deviation / closeout gaps |
| `governance_capa_placeholders` | placeholder | Future CAPA linkage only |

## Modules

| Path | Responsibility |
|------|----------------|
| `lib/safety-continuity/` | Unresolved safety model, carry-forward, visit blockers |
| `lib/governance-fabric/` | Deviation v1, query/finding bridge, signal sync, CAPA placeholder |
| `lib/governance-fabric/inspection-replay.ts` | Replay readiness notes |

## Visit readiness pipeline

1. Base execution readiness (procedures, source, AE visit count)
2. Protocol graph orchestration
3. Safety continuity (carry-forward + signoff blocks + graph strengthening)
4. Governance fabric (deviation signals → blockers)

Explicit refresh (`refreshVisitReadinessProjection`) persists safety + governance signal caches.

## Deviation detection v1

See `lib/governance-fabric/deviation-rules.ts`:

- Visit window deviation
- Missing source at signoff
- Unresolved findings at closeout
- Unresolved AE at signoff
- Protocol graph blocker unresolved
- Open query unresolved
- Safety continuity elevated

## CAPA

`governance_capa_placeholders` stores **placeholder** rows only. Use `createCapaPlaceholderForSignal()` when a future module promotes to CAPA — no workflow in Phase 4.

## Configuration

No new study-level config required. Safety continuity reads AE registry directly. Graph rules remain in `study_versions.metadata.protocol_graph`.
