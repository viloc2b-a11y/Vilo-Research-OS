# Phase 16A-2 — OBS-1 Runtime Observability Schema Foundation

**Phase:** 16A-2 (OBS-1)  
**Status:** Schema + TypeScript helpers only (no runtime hooks, no UI, no AI)  
**Migration:** `supabase/migrations/0085_phase16a2_runtime_observability_schema.sql`  
**TypeScript:** `lib/observability/`

## Purpose

Provide append-oriented storage for **runtime traces**, **execution spans**, and **workflow telemetry events** so future runtime instrumentation (OBS-2) can record governed workflow execution without changing clinical behavior in this phase.

## Non-goals

- No UI or dashboards  
- No AI calls  
- No runtime spine hooks yet  
- No workflow behavior changes  
- No PHI in `metadata` or ref arrays  

## Schema summary

### `runtime_traces`

Top-level trace per workflow/runtime action. Includes OBS-2 authority columns:

| Column | Notes |
|--------|--------|
| `workflow_key` | Nullable; GOV-1 enum CHECK when set |
| `base_authority_level` | Nullable; `assistive` \| `human_required` \| `system_enforced` |
| `effective_authority_level` | Nullable; requires `base_authority_level` when set |
| `trace_type` | Closed enum (`workflow_execution`, `coordinator_action`, …) |
| `status` | `started` \| `in_progress` \| `completed` \| `failed` \| `cancelled` \| `degraded` |
| `source_operational_event_id` | Optional FK → `operational_events` |
| `metadata` | JSON **object**, non-PHI only |

### `execution_spans`

Nested spans under a trace (or standalone when `runtime_trace_id` is null).

| Column | Notes |
|--------|--------|
| `dependency_refs` / `blocker_refs` / `warning_refs` | JSON **arrays** |
| `ai_participation` | Boolean flag (no AI execution in this phase) |
| `metadata` | JSON object, non-PHI |

### `workflow_telemetry_events`

Point-in-time telemetry rows (`trace_opened`, `authority_resolved`, …).

## Constraints

- `jsonb_typeof(metadata) = 'object'` on all three tables  
- Ref columns on spans must be JSON arrays  
- `effective_authority_level` NOT NULL ⇒ `base_authority_level` NOT NULL  
- `workflow_key` CHECK aligns with GOV-1 seeded keys (no FK to `workflow_decision_authorities`)  
- Authority levels CHECK matches `WORKFLOW_AUTHORITY_LEVEL`  

## OBS-2 / GOV-1 contract

Traces that record governance context MUST use:

- `workflow_key` — `WORKFLOW_KEY` enum  
- `base_authority_level` — `WORKFLOW_AUTHORITY_LEVEL` enum  
- `effective_authority_level` — same enum  

**Never** store free-text authority labels in `metadata` (`authorityName`, `authorityLabel`, …). Use `buildRuntimeTraceInsertPayload()` and `redactTelemetryMetadata()` before insert.

## RLS summary

| Operation | Who |
|-----------|-----|
| **SELECT** | Org members; if `study_id` set, org admin or `user_has_study_access(study_id)` |
| **INSERT/UPDATE** (`runtime_traces`, `execution_spans`) | Same as SELECT |
| **INSERT** (`workflow_telemetry_events`) | Same as SELECT (append-only grant; no UPDATE) |

No `anon` / `public` access.

## TypeScript helpers

| Module | Role |
|--------|------|
| `constants.ts` | `RUNTIME_TRACE_*`, `EXECUTION_SPAN_*`, `WORKFLOW_TELEMETRY_*` enums |
| `types.ts` | Record/insert types with `RuntimeTraceAuthorityFields` |
| `redact-telemetry-metadata.ts` | Strip PHI-like and forbidden authority keys |
| `build-trace-payload.ts` | Validate authority pair + redact metadata |
| `index.ts` | Public exports |

## Smoke

```bash
npm run observability:smoke
# or
npx tsx scripts/phase16a2-runtime-observability-smoke.ts
```

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/phase16a2-runtime-observability-smoke.ts
git diff --check
```

Apply migration `0085` before any DB writes.

## Future (OBS-2)

- Runtime emitters write traces/spans at mutation gateway, orchestration, replay boundaries  
- `effective_authority_level` computed from GOV-1 escalation rules  
- Link `source_operational_event_id` for chronology alignment  
