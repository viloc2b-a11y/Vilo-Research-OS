# Runtime Integrity — Phase 6

Status: Active  
Purpose: Harden spine enforcement and runtime integrity before finance, AI, dashboards, or enterprise features.

## Enforcement model

| Layer | Tool | Action |
|-------|------|--------|
| Static audit | `scripts/runtime-integrity-audit.ts` | Scan `lib/**` for clinical `.from().update/insert/delete` without emission hints |
| Event registry | `lib/runtime-integrity/event-registry/normalize.ts` | Normalize legacy event_type drift |
| Gateway | `ClinicalMutationGateway` | Preferred TS emission with payload envelope |
| RPC plan | `RPC_EMISSION_HARDENING_PLAN` | Co-locate DB mutations + spine inserts |
| Runtime report | `buildRuntimeIntegrityReport` | Projection freshness + replay gaps per scope |

See `lib/runtime-integrity/enforcement-strategy.ts` for full strategy contract.

## Silent mutation detection

**Clinical tables** (`CLINICAL_EXECUTION_TABLES`): visits, procedure_executions, source_*, subject_adverse_events, workflow, etc.

**Derived tables** (no spine required): projections, governance_signals cache, protocol_graph_publications, replay artifacts.

**Heuristic:** Within ±2500 chars of mutation, expect:
`ClinicalMutationGateway`, `logOperationalEvent`, `.rpc(`

**Catalog:** `SILENT_MUTATION_PATCH_PLAN` — remaining patch priorities.

## Commands

```bash
# Static audit (lib/)
npm run integrity:audit

# Fail CI on blockers
npm run integrity:audit -- --fail-on-blocker

# Smoke (no DB)
npx tsx scripts/phase6-runtime-integrity-smoke.ts

# Runtime report (requires Supabase)
# buildRuntimeIntegrityReport({ supabase, scope: 'visit', scopeId, organizationId, studyId })
```

## Projection freshness

`checkVisitProjectionFreshness` / `checkSubjectProjectionFreshness`:
- missing cache row
- stale `computed_at` (>5 min default)
- `projection_version` mismatch vs `RUNTIME_PROJECTION_VERSION`

## Replay gaps

`detectVisitReplayGaps` compares:
- Visit execution state vs `operational_events` on visit
- Catalogued silent/partial mutations
- Unregistered / drift event types

## ESLint

Phase 6 uses **static audit script** instead of a fragile ESLint selector rule. Optional future: custom ESLint plugin referencing `direct-mutation-scanner`.

## Not in scope

- Dashboards, financial runtime, AI copilots
- DB-level triggers blocking all clinical writes (audit-first)
