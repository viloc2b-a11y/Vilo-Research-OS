# Phase 16A-3 — OBS-2 Minimal Runtime Observability Hooks

**Phase:** 16A-3 (OBS-2)  
**Status:** Best-effort hooks at key runtime boundaries (no UI, no AI, no behavior changes)  
**Depends on:** OBS-1 migration `0085`, GOV-1 authority matrix, compliance migration `0086`  

## Principles

> **Site-first framing:** Observability exists primarily to help the site identify and resolve operational risk **before external escalation** — operational explainability, site self-defense telemetry, runtime self-correction, and operational continuity signals. **Not** sponsor transparency, monitor visibility, or oversight telemetry as product goals.

- **Best-effort:** `safeObserve()` wraps all writes; failures never propagate to clinical runtime.
- **Non-blocking:** Hooks use fire-and-forget async; callers do not await observability.
- **Production silence:** Failures log `console.warn` only in `development` / `test`.
- **No PHI:** All metadata passes through `redactTelemetryMetadata()`.
- **Authority contract:** Traces use `workflow_key` + `base_authority_level` + `effective_authority_level` enums via `buildRuntimeTraceInsertPayload()` — never free-text authority labels in metadata.

## Helpers

| Module | Role |
|--------|------|
| `safe-observe.ts` | `safeObserve()` / `safeObserveAwait()` |
| `record-runtime-trace.ts` | Insert `runtime_traces` |
| `record-workflow-telemetry.ts` | Insert `workflow_telemetry_events` with `metadata.signal` |
| `hook-signals.ts` | Semantic signal constants (`OBS_HOOK_SIGNAL`) |
| `hooks/*` | Boundary-specific observers |

Telemetry uses coarse `telemetry_type` (`governance_signal`, `automation_signal`, …) plus `metadata.signal` for the semantic hook name (DB CHECK on `telemetry_type` unchanged).

## Hook points

### 1. ClinicalMutationGateway

`lib/operations/clinical-mutation-gateway.ts` — after `logOperationalEvent` (now returns event id):

- `runtime_traces` with `trace_type = mutation_gateway`
- `event_type`, `mutation`, `source_operational_event_id`
- GOV-1 authority when `workflow_key` resolved from mutation/event type
- `status`: `completed` or `failed`

### 2. Source capture lifecycle

`app/api/source/response-set/{open,save-draft,submit}/route.ts`:

| Signal | When |
|--------|------|
| `source_response_set_opened` | Open RPC success |
| `source_draft_saved` | Save draft success |
| `source_response_set_submitted` | Submit success |
| `source_validation_failed` | Save/submit envelope has validation-related errors/warnings |

`workflow_key = source_signing` on telemetry.

### 3. Runtime automation

`lib/runtime-automation/emit/automation-events.ts`:

- `automation_proposed` / `applied` / `reversed` / `overridden`
- `telemetry_type = automation_signal`

### 4. Projection refresh

`lib/projections/refresh.ts`:

- `visit_readiness_projection_refreshed`
- `subject_runtime_projection_refreshed`
- `study_execution_projection_refreshed`
- Metadata: `projection_version`, `refresh_mode`, `ok`, `rows_affected`, `error` only

### 5. Runtime UI model load

`lib/runtime-ui/load.ts`:

- `visit_runtime_ui_model_loaded` / `subject_runtime_ui_model_loaded`
- Metadata: `blocked`, `next_action_count`, `automation_proposal_count`, `leakage_visible` (visit only), readiness/health enums — no PHI

### 6. Compliance guardrails (Phase 16A-2.5)

`lib/observability/hooks/observe-compliance-guardrails.ts` — telemetry only when record helpers succeed:

| Signal | Wired from | Notes |
|--------|------------|-------|
| `temporal_consistency_evaluated` | `recordTemporalConsistencyEvaluation()` | No auto temporal checks on source capture |
| `delegation_runtime_checked` | `recordDelegationRuntimeCheck()` | Does not globally block runtime |
| `break_glass_access_requested` | `requestBreakGlassAccess()` | No permission expansion |

Authority enums (`base_authority_level`, `effective_authority_level`) appear in telemetry metadata when `workflow_key` is known — never free-text labels.

**Explicit non-goals for this phase:**

- No new blocking enforcement
- No break-glass permission expansion
- No mandatory delegation blocks globally
- No temporal evaluation on all source paths unless caller supplies values and invokes record helper

## Smoke

```bash
npm run observability:hooks-smoke
```

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/phase16a3-runtime-observability-hooks-smoke.ts
git diff --check
```

Apply migration `0085` before hooks persist to the database in live environments.

## Out of scope

- Dashboards / UI
- AI calls
- `execution_spans` population (schema ready; hooks deferred)
- Dynamic GOV-1 escalation evaluation (static authority defaults for traces)
- Per-click instrumentation
