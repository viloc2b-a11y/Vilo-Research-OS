# Source Engine Phase 3B — Signature Readiness Gate

## Goal

Enforce Source Engine validation **only at signature time**. Draft save and submit remain unchanged.

## Flow

1. User clicks **Sign Procedure** in `VisitActionToolbar` → `signProcedureAction`.
2. `signProcedure` runs **existing** `validateProcedure` (required fields, findings, etc.).
3. If legacy validation passes, `checkEngineSignatureReadiness` runs:
   - Loads persisted response set fields (same path as capture shell normalization).
   - Calls `validateProcedureSourceForSignature()` from `@/lib/source-engine/adapters/index`.
   - Filters findings where `blocksSignature === true`.
4. If any blockers exist, sign is rejected with:

```
Signature blocked by Source Engine validation:
- [field_or_section] message
```

5. If no blockers, existing sign + lock behavior proceeds unchanged.

## Files

| File | Role |
|------|------|
| `lib/visit-runtime/signProcedure.ts` | Orchestrates legacy validation then engine gate |
| `lib/source/capture/engine-signature-validation.ts` | Loads fields + runs engine signature validation |
| `lib/source-engine/adapters/signature-gate.ts` | Blocker filter + user-facing message format |
| `components/subjects/visits/VisitActionToolbar.tsx` | Shows multiline block message (`whitespace-pre-wrap`) |
| `components/source/SourceEngineAdvisoryPanel.tsx` | Shows signature blockers before sign attempt |

## Safety

- Engine gate wrapped in `try/catch` — failures do **not** block sign (legacy behavior preserved).
- No DB migrations or API contract changes.
- Submit/draft actions unchanged (`actions.ts` still advisory-only on submit).
- `engineSnapshot` null on page load does not affect server-side gate (gate re-loads fields at sign time).

## Advisory vs blocking

| Action | Engine behavior |
|--------|-----------------|
| Save draft | Unchanged |
| Submit | Advisory warnings only (Phase 2) |
| Sign | **Blocks** when `blocksSignature === true` |

Non-blocking engine findings (warnings/info without `blocksSignature`) remain advisory in the panel only.

## Next steps (Phase 3C+)

- Optional client-side pre-check before sign (using `engineSnapshot` without extra round-trip).
- Enforce `blocksSubmission` on submit behind a feature flag.
- Dynamic field visibility from `runtime.fields` in capture form.
