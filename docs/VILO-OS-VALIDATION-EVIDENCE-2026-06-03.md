# Vilo OS Validation Evidence

Date: 2026-06-03

## Passed smoke tests

- `protocol-intake-runtime:smoke`
- `protocol-reconciliation:smoke`
- `protocol-runtime-generation:smoke`
- `visit-runtime:smoke`
- `visit-runtime:smoke:lock`
- `financial:smoke`
- `operational-signature:smoke`
- `db:validate-phase7-vpi`

## Issue found and patched

- SoA classification bug: `Schedule of Activities` was being classified as a generic visit schedule before the dedicated SoA rule.
- Patched in `lib/protocol-intake-runtime/extract-protocol-sections.ts`.

## Governance state verification

- `draft` -> `review`
- `coordinator_signed` -> `signoff`
- `investigator_signed` -> `lock`
- reopened closeout after prior signature -> `needs_resign`
- `draft` protocol lifecycle -> `review`
- `runtime_mapping` -> `signoff`
- `published` -> `lock`
- `archived` -> `supersede`

Verified in:
- `lib/subject/visits/progress-note/governance-state.ts`
- `lib/protocol-intake-runtime/governance-state.ts`

## Live E2E limitation

- `runtime:e2e:live` could not resolve a live pilot scope in this environment.
- The run fell back to offline validation, so no live pilot assertions were exercised here.

## VIP bridge safety block

- `protocol-to-vip-smoke` was not forced.
- The external VIP call was intentionally blocked because it would require exporting protocol/runtime context to an unverified external destination in this environment.

## Notes

- No new modules were added.
- No architecture changes were introduced.
- The smallest broken link was patched only where needed.

