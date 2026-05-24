# Phase 11 — Runtime E2E Pilot Hardening

Status: Active  
Purpose: Validate the existing Vilo OS runtime chain end to end before a real pilot. This phase adds validation, fixtures, reports, and hardening checks only.

## Scope

Phase 11 validates that a pilot study, subject, and visit can move through the already-built runtime chain:

1. Runtime actions emit `operational_events`
2. Events refresh runtime projections
3. Protocol graph blockers appear
4. Safety and governance blockers carry forward
5. Replay explains blocked readiness
6. Financial leakage derives from runtime state
7. Coordinator next action appears
8. Supervised automation can be proposed and applied
9. Runtime UI model exposes the same intelligence
10. Static and live integrity checks catch silent mutation risk

## Artifacts

| Artifact | Location |
|----------|----------|
| E2E validator | `scripts/phase11-runtime-e2e-validation.ts` |
| Pilot fixture resolver | `scripts/phase11-runtime-pilot-fixture.ts` |
| Validation library | `lib/runtime-validation/` |
| JSON report | `.runtime-validation/phase11-report.json` |
| Failure report | `.runtime-validation/phase11-report.md` |
| Fixture output | `.runtime-validation/pilot-fixture.json` |

## Commands

```bash
# Offline synthetic chain + static integrity audit
npm run runtime:e2e

# Resolve a live pilot fixture from staging/service-role access
npm run runtime:pilot-fixture

# Hybrid live validation against PHASE11_* fixture IDs
npm run runtime:e2e:live -- --fail-on-fail

# Optional staging-only supervised apply check
npm run runtime:e2e:live -- --apply-automation --actor-user-id <coordinator-user-uuid>

# Deliberately allow the built-in staging fixture for apply checks
npm run runtime:e2e:live -- --apply-automation --actor-user-id <coordinator-user-uuid> --use-default-fixture

# Strict mutation audit before pilot sign-off
npm run integrity:audit:strict
```

## Pilot Fixture

The fixture resolver accepts explicit IDs or discovers a recent enrolled/randomized/screening subject and checked-in/in-progress/scheduled visit for the target study.

Required live env:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PHASE11_STUDY_ID=...
PHASE11_SUBJECT_ID=...
PHASE11_VISIT_ID=...
PHASE11_ORG_ID=...
```

`PHASE11_STUDY_ID` may fall back to `PHASE9_STUDY_ID`, then staging defaults in `lib/runtime-validation/pilot-fixture-defaults.ts` (phase2-validation-study). Subject and visit IDs can be discovered when the study has suitable pilot data.

`PHASE11_ORG_ID` is validated against `studies.organization_id`; mismatch fails the run before live validation.

`--apply-automation` requires a valid UUID in `--actor-user-id` and explicit `PHASE11_STUDY_ID`, `PHASE11_SUBJECT_ID`, `PHASE11_VISIT_ID`, and `PHASE11_ORG_ID`, unless `--use-default-fixture` is supplied deliberately.

Before live pilot on staging:

```bash
npm run runtime:pilot-staging-prep   # procedure_source_bindings + pilot subject hygiene
npm run runtime:pilot-fixture
```

Live validation persists projections via `refreshVisitReadinessProjection` (not compute-only). See Phase 14 readiness doc.

## Failure Report Format

The validator writes a Markdown report with:

- Pilot scope
- Runtime chain check statuses
- Failures with severity and remediation
- Remaining blockers
- Recommended fixes before a real pilot

Use blocker failures to stop pilot sign-off. Warning status means the runtime is degraded and can be inspected, but should not be treated as production-ready until the warning is explained.

## Validation Outputs

| Output | Source |
|--------|--------|
| Integrity audit output | Static direct-mutation scan plus live `buildRuntimeIntegrityReport` |
| Replay validation output | `rebuildVisitReplay` summary with readiness-blocked causes |
| Projection validation output | Readiness, financial, orchestration, and automation projection rows |
| UI model validation output | `loadVisitRuntimeUiModel` next action, blocked state, leakage, and automation proposal count |

## Remaining Blockers

Current offline validation reports static direct-mutation blockers from the integrity audit. These are not new Phase 11 features; they are pilot-readiness risks that must be resolved or explicitly accepted before a real coordinator pilot.

## Recommended Fixes Before Real Pilot

- Clear `npm run integrity:audit:strict` blockers or document approved RPC exceptions.
- Apply all runtime migrations required by Phases 7–10 in staging.
- Run the live validator against a blocked pilot visit with source, finding/query, AE, graph, and governance state.
- Confirm automation application is coordinator-supervised and emits `runtime_automation.applied` by using the explicit `--apply-automation` staging option.
- Attach `.runtime-validation/phase11-report.md` to pilot go/no-go review.

## Non-Goals

- No new dashboards
- No sponsor views
- No AI behavior
- No new runtime features beyond validation compatibility
