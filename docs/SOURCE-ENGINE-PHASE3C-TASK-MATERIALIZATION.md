# Source Engine Phase 3C — Task Materialization

## Goal

Convert Source Engine validation findings and `CREATE_TASK` rule actions into existing `subject_workflow_actions` rows — no duplicate task system, no new tables.

## Eligibility

Tasks are created only when:

1. **Validation finding:** `(severity = critical|error AND blocksSignature)` OR `taskEligible = true`
2. **Rule action:** `type = CREATE_TASK`
3. **Resolution:** `engineStatus.resolution.source` is `published` or `registry`

**Not** created for:

- Generic **fallback** templates (unless SDV `meta.source_engine_allow_tasks_on_fallback = true`)
- Passive page load
- Warnings without `taskEligible`

## Idempotency

Deterministic key:

```
source_engine:{procedureExecutionId}:{findingCode}:{fieldId}:{sectionId}
```

Stored at the start of `subject_workflow_actions.description`:

```
[source_engine_key=source_engine:...]

Human-readable message follows.
```

Before insert, open/in-progress actions for the same procedure are scanned for an existing key. If dedupe lookup fails, **no tasks are created** and the result reports an error (duplicate-safe).

There is no `external_key` column on `subject_workflow_actions`; description embedding is the supported dedupe path without a migration.

## Integration points

| Trigger | When |
|---------|------|
| Signature block | `signProcedure` after Source Engine gate returns blockers (`materializeEngineTasksAfterSignatureBlock`) |
| Submit (optional) | `submitCaptureAction` after successful submit, only when resolution is not fallback |

**Not** called from `loadCaptureShell` or advisory panel render.

## Files

- `lib/source-engine/workflow/task-materializer.ts` — extract, map, insert
- `lib/source/capture/materialize-engine-tasks.ts` — procedure-scoped wrappers
- `lib/source/capture/engine-signature-validation.ts` — returns `snapshot` on gate check
- `lib/visit-runtime/signProcedure.ts` — materialize on signature block

## Payload

Workflow rows use existing columns. Logical metadata (origin, template id, deterministic key) is embedded in `description` for dedupe and can be extended when a JSON metadata column is added later.

## Unchanged behavior

- Save draft
- Submit API contract (optional success message when tasks created)
- Signature gate rules (tasks created **after** block, not instead of block)
