# Phase 7 — Financial Runtime Intelligence

Runtime-derived financial intelligence for Vilo OS. **Not** accounting, invoicing, sponsor billing, or dashboards.

## Principles

| Rule | Implementation |
|------|----------------|
| Financial state derives from runtime | `computeVisitFinancialRuntime` loads visits, procedures, source, safety, workflow from execution tables |
| `operational_events` remain canonical | No financial writes to clinical tables; projections only |
| Projections are derived | `visit_financial_runtime_projections`, `subject_financial_runtime_projections` |
| Coordinator-first | Coordinator burden economics wrap operational-intelligence burden |
| Preserve runtime execution | Read-only compute; no visit/procedure mutation |

## Expected vs Executed vs Earned

```
Protocol map + conditionals          → Expected
Completed procedures + workflow/   → Executed
  source/safety counts
Completed + signed + billable +      → Earned
  graph/visit/source/findings/safety
```

- **Expected**: `visit_def_procedure_map` + instantiated conditionals; billable from `procedure_definitions.billable_default` / `procedure_executions.billable_flag`
- **Executed**: completed procedures; workflow open count; source submissions; open AE count
- **Earned**: expected-set procedures that are completed, signed, billable, and free of visit/graph/safety/source/finding blockers

`earned_rate_basis_points` = `(earned / expected) * 10000` when expected > 0.

## Revenue leakage (v1)

| Kind | Trigger |
|------|---------|
| `executed_unsigned` | Completed procedure without signature |
| `completed_missing_source` | Billable completed without submitted source |
| `completed_unresolved_findings` | Visit readiness has unresolved findings |
| `blocked_governance` | Governance blocker on readiness |
| `blocked_safety` | Open AEs on visit |
| `blocked_protocol_graph` | Graph orchestration blockers |
| `unscheduled_burden` | Scheduling/window deviation |
| `repeat_procedure` | Completed units not in earned set |

`leakage_score` caps at 100 (weighted by severity).

## Coordinator burden economics

Derived from `computeCoordinatorBurden` (operational intelligence):

- workflow density
- source burden
- query burden
- safety burden
- reschedule burden

`burdenToEarnedRatio` relates coordinator cost to billable earned units.

## Visit financial burden

`visitFinancialBurdenScore` blends leakage (50%), coordinator burden (30%), unscheduled burden (20%).

## Amendment operational impact

From active `protocol_graph_publications` vs study `active_protocol_graph_publication_id` — node/edge deltas and operational impact score (no sponsor finance).

## Integration

Visit readiness pipeline:

```
base → protocol graph → safety → governance → operational intelligence → financial runtime
```

- `lib/projections/compute/visit-readiness.ts` — `enrichVisitReadinessWithFinancialRuntime` (persists when `persistSafetyGovernance`)
- `lib/projections/compute/subject-runtime.ts` — `enrichSubjectRuntimeWithFinancialRuntime`

## Module layout

```
lib/financial-runtime/
  compute/          expected, executed, earned, leakage, attribution, coordinator, unscheduled, amendment
  load/             visit-context
  safeguards/       integrity checks
  integration/      visit + subject projection bridges
  compute-visit.ts
  compute-subject.ts
  persist.ts
```

## Migration

`supabase/migrations/0079_phase7_financial_runtime.sql`

Apply before DB-backed persist:

```bash
npm run db:migrate
```

## Validation

```bash
npx tsx scripts/phase7-financial-runtime-smoke.ts
```

## Explicit non-goals (Phase 7)

- Invoicing / AR
- Accounting UI
- Sponsor finance portals
- Enterprise billing
- Dashboards
- Rewriting visit runtime or source engine
