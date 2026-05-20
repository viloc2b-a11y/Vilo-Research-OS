# Source Engine Phase 3E — Operational Event Logging

## Goal

Trace Source Engine behavior in the existing `operational_events` append-only stream (audit/VPI/debugging). No new tables or parallel audit system.

## Event types

| `event_type` | When logged |
|--------------|-------------|
| `engine_snapshot_generated` | Snapshot built on capture load — **debug env only** or **first time per procedure** |
| `engine_snapshot_failed` | Snapshot build throws on capture load |
| `engine_fallback_template_used` | Resolved config uses dev fallback template |
| `engine_runtime_state_applied` | Runtime field state applied to capture fields — debug or first time per procedure |
| `engine_signature_blocked` | Signature gate returns `blocksSignature` blockers |
| `engine_signature_gate_failed_closed` | Snapshot unavailable or gate throws (fail-open path; logged for traceability) |
| `engine_tasks_materialized` | One or more workflow tasks inserted |
| `engine_task_materialization_skipped` | Task materialization skipped (fallback, no candidates, deduped, unsafe dedupe) |

## Payload (JSON)

All events include:

- `origin`: `source_engine`
- `timestamp`: ISO-8601
- `studyId`, `subjectId`, `visitId`, `procedureExecutionId`
- `sourceResponseSetId` (when known)
- `templateId`, `resolutionSource` (`published` \| `registry` \| `fallback`)
- `degraded`, `fallback`
- `blockerCount`, `taskCount`, `dedupedTaskCount` (when relevant)
- `userId` (when available)
- `errorMessage`, `skipReason`, `fieldsAppliedCount` (when relevant)

## Noise control

- **No logging on passive re-render** beyond first-per-procedure dedupe for snapshot/runtime-applied.
- Enable verbose snapshot logging: `SOURCE_ENGINE_DEBUG_EVENTS=true` or `SOURCE_ENGINE_LOG_SNAPSHOT_GENERATED=true`.
- Dedupe: query `operational_events` for same `procedure_execution_id` + `event_type` before logging snapshot/runtime-applied.

## Integration points

| File | Events |
|------|--------|
| `lib/source/capture/load-capture-shell.ts` | snapshot generated/failed, fallback, runtime applied |
| `lib/source/capture/engine-signature-validation.ts` | signature blocked, gate failed closed |
| `lib/source-engine/workflow/task-materializer.ts` | tasks materialized, skipped |

## Safety

`logSourceEngineOperationalEvent` never throws — failures are `console.warn` only. Capture, submit, and sign behavior unchanged.

## Module

- `lib/source-engine/telemetry/log-source-engine-event.ts`
- `lib/source-engine/telemetry/source-engine-event-types.ts`

Uses `logOperationalEvent` from `lib/operations/logOperationalEvent.ts`.
