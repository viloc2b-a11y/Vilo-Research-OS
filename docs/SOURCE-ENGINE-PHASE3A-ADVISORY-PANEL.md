# Source Engine Phase 3A — Advisory Panel

## Where it renders

- **Component:** `components/source/SourceEngineAdvisoryPanel.tsx`
- **Shell:** `components/subjects/visits/VisitRuntimeShell.tsx` (above `CaptureForm`)
- **Page:** `app/(ops)/source/capture/[procedureExecutionId]/page.tsx` via `VisitRuntimeShell`

The panel appears only when `CaptureShellViewModel.engineSnapshot` is non-null and includes a `runtime` object. It is **collapsed by default** (`<details>` without `open`).

## What it reads from `engineSnapshot`

`engineSnapshot` is built in `lib/source/capture/load-capture-shell.ts` via `resolveCaptureShellEngineRuntime()` (Phase 2 adapter). The panel displays:

| Section | Source |
|--------|--------|
| Runtime status | `snapshot.context` (visit type, signature state, flags) |
| Field counts | `snapshot.runtime.fields` (visible / required / disabled / total) |
| Derived values | `snapshot.derivedValues` |
| Validation | `snapshot.validationErrors` or `snapshot.runtime.validationResults` |
| Signature readiness | Context + validation items with `blocksSignature` |
| Active rules | `snapshot.runtime.firedRuleIds` |
| Section status | `snapshot.runtime.sections`, `repeatableSections` |

No additional API or database calls are made in the UI.

## Advisory only

- Does **not** block save, submit, or signature.
- Does **not** replace existing capture validation or server actions.
- Uses muted/dashed styling so it reads as secondary debug/coordinator tooling.
- Generic labels only (no sponsor/protocol-specific names in the panel).

Submit actions may still attach engine warnings server-side (`validateProcedureSourceForSubmit` in `actions.ts`); that path is unchanged and remains non-blocking for the API response.

## Next steps

- Phase 3B enforces `blocksSignature` at sign time — see `SOURCE-ENGINE-PHASE3B-SIGNATURE-GATE.md`.
- Phase 3C+: dynamic field visibility, optional submit blocking, client pre-check before sign.
