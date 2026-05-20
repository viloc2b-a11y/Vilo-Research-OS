# Source Engine Phase 2 — Runtime Adapter Integration

## Purpose

Thin, near-pure adapters connect **Phase 1** (`resolveSourceRuntime`, validators, calculators, signature policy) to the existing **Phase 5 capture runtime** without changing UI layout or replacing server actions.

## Module layout

| File | Role |
|------|------|
| `lib/source-engine/adapters/source-response-adapter.ts` | `CaptureFieldViewModel` ↔ `SourceResponses`; validation → capture errors |
| `lib/source-engine/adapters/procedure-runtime-adapter.ts` | Procedure/visit context ↔ `RuntimeContext` |
| `lib/source-engine/adapters/capture-runtime-adapter.ts` | Orchestration: resolve, validate, derived values, policy |
| `lib/source-engine/adapters/index.ts` | Public exports |

> **Import path:** use `@/lib/source-engine/adapters/index` — `@/lib/source-engine/adapters` still resolves to legacy field-spec `adapters.ts`.

## Connection points

### 1. Capture shell load (`lib/source/capture/load-capture-shell.ts`)

After fields are normalized, calls `resolveCaptureShellEngineRuntime()` and attaches optional `engineSnapshot` on `CaptureShellViewModel`. Phase 3A renders it in `SourceEngineAdvisoryPanel` (advisory only).

### 2. Submit action (`lib/source/capture/actions.ts`)

After draft save, calls `validateProcedureSourceForSubmit()` and appends **advisory** warnings to the success envelope. Does **not** block API submit.

## API surface

```ts
import {
  resolveProcedureSourceRuntime,
  validateProcedureSourceForSubmit,
  validateProcedureSourceForSignature,
  getProcedureDerivedValues,
  getSignaturePolicyForProcedure,
} from '@/lib/source-engine/adapters/index'
```

Default template/rules: `GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE` + `CLINICAL_RULES_EXAMPLES` (override via `ProcedureEngineRuntimeOptions`).
