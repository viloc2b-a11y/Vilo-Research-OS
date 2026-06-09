# Vilo OS Budget Negotiation Intelligence v1 Report

Date: 2026-06-03

## What Changed

- Added derived budget negotiation intelligence inside the existing study workspace spine.
- Reused:
  - Document Intelligence budget / CTA evidence
  - Protocol SOA / runtime context
  - FMV reference data from the canonical reference workbook
  - Financial Runtime signals
  - append-only negotiation ledger
- Added derived outputs only:
  - FMV gap
  - operational burden gap
  - payment term risk
  - pass-through risk
  - screen failure protection gap
  - recommended counteroffer language
  - projected revenue impact

## Files Changed

- [lib/study-workspace/load-budget-evidence-summary.ts](</C:/dev/vilo-os/lib/study-workspace/load-budget-evidence-summary.ts>)
- [components/study-workspace/study-command-center-view.tsx](</C:/dev/vilo-os/components/study-workspace/study-command-center-view.tsx>)
- [scripts/budget-negotiation-e2e-smoke.ts](</C:/dev/vilo-os/scripts/budget-negotiation-e2e-smoke.ts>)

## Tests Passed

- `npx tsc --noEmit`
- `npx tsx scripts/budget-negotiation-e2e-smoke.ts`
- `npm run financial:smoke`
- `npm run coordinator-ops:smoke`
- `npm run db:validate-phase7-vpi`
- `npx eslint lib/study-workspace/load-budget-evidence-summary.ts components/study-workspace/study-command-center-view.tsx scripts/budget-negotiation-e2e-smoke.ts --no-warn-ignored`

## What Remains Partial

- This is not a full contract negotiation system.
- No new financial truth layer was added.
- Financial Runtime remains the source of truth for revenue lifecycle.
- No legal contract workflow was introduced.
- No sponsor-facing automation was added.
- Live Supabase-backed budget validation still depends on runtime credentials and pilot scope availability in the environment.

## Notes

- The budget intelligence is derived only.
- Budget negotiation remains append-only and study-scoped.
- The export and UI now expose the intelligence as readable coordinator-facing guidance, not as a new source of truth.

