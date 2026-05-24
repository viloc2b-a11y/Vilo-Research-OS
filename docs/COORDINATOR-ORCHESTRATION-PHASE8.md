# Phase 8 — Coordinator Orchestration Engine

Coordinator-first orchestration intelligence derived from runtime execution, projections, operational intelligence, and financial runtime. **Not** a generic task manager, dashboard, sponsor portal, or AI copilot.

## Principles

| Rule | Implementation |
|------|----------------|
| Coordinator-first | Next-actions and work queues target coordinator workflow |
| Derives from runtime | Blockers, readiness, OI, financial leakage, graph orchestration |
| `operational_events` canonical | No orchestration writes to clinical tables |
| Projections derived only | `visit_coordinator_orchestration_projections`, `subject_coordinator_orchestration_projections` |
| No fake tasks | Work queue is derived routing buckets, not persisted tasks |

## Architecture

```
Visit readiness + financial + graph + burden
        ↓
  Next-action engine
        ↓
  Priority scoring + urgency
        ↓
  Blocker resolution chains
        ↓
  Work queue derivation
        ↓
  Visit execution / subject escalation / leakage escalation
```

## Next-action kinds

| Kind | Example trigger |
|------|-----------------|
| `pi_review` | Unresolved CBC / critical safety |
| `source_correction` | Blocked signoff, missing source |
| `coordinator_workflow` | Unresolved query, overdue workflow |
| `signoff` | Unsigned procedures |
| `graph_resolution` | Protocol graph blockers |
| `governance_resolution` | Governance signals |
| `safety_follow_up` | Open AE burden |
| `leakage_escalation` | Executed but unsigned (financial) |
| `operational_escalation` | Repeated reschedule |
| `procedure_execution` | Pending procedures |
| `coordinator_follow_up` | Replay chronology review |

## Priority scoring dimensions

- patient/safety risk
- protocol risk
- visit timeline pressure
- coordinator burden
- unresolved governance
- financial leakage

Composite score uses weighted sum (`PRIORITY_WEIGHTS`).

## Work queue buckets

| Bucket | Meaning |
|--------|---------|
| `action_now` | High priority / critical urgency |
| `can_wait` | Medium priority, not blocked |
| `blocked` | Visit blocked; lower-priority items deferred |
| `escalation` | Operational or leakage escalation |
| `pi_review` | PI / investigator review required |
| `coordinator_follow_up` | Workflow or replay follow-up |

## Integration

Visit readiness pipeline:

```
base → graph → safety → governance → OI → financial → coordinator orchestration
```

- `lib/projections/compute/visit-readiness.ts`
- `lib/projections/compute/subject-runtime.ts`

## Module layout

```
lib/coordinator-orchestration/
  compute/       next-actions, priority, urgency, blocker-chains
  orchestrate/   visit-execution, subject-escalation, financial-leakage
  queue/         derive-work-queue
  context/       build-visit-context
  integration/   projection bridges
```

## Migration

`supabase/migrations/0080_phase8_coordinator_orchestration.sql`

```bash
npm run db:migrate
```

## Validation

```bash
npm run orchestration:smoke
```

## Explicit non-goals

- Generic task manager
- Dashboards
- Sponsor reporting
- AI recommendations
- Runtime execution rewrites
