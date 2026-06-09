# Vilo OS Revenue Protection Expansion Report

Date: 2026-06-03

## Scope

Expanded the existing Vilo OS runtime spine so Financial Runtime signals can surface as explicit revenue-protection actions in VPI and the coordinator queue.

No new financial truth layer was introduced. No accounting subsystem was created.

## What Was Added

- Derived revenue-protection signal kinds for:
  - earned but not invoiced
  - invoiceable missing
  - screen-failure billable
  - pass-through unreimbursed
  - stipend unreconciled
  - overdue invoice/payment
  - disputed payment
  - reverted payment
  - write-off visibility
- Recommended actions for the new signal kinds
- Operational-state classification for the new signal kinds
- Queue labels and UI tone mapping for the new reason kinds
- Fallback derivation from `visit_financial_runtime_projections.snapshot` and `leakage`
- A more explicit revenue-risk recommendation at study level when financial leakage is present

## Validation

Passed:
- `npx tsc --noEmit`
- `npm run financial:smoke`
- `npm run coordinator-ops:smoke`
- `npm run db:validate-phase7-vpi`
- `npx eslint lib\\performance\\read-layer\\fallback-signals.ts lib\\performance\\scoring\\types.ts lib\\performance\\scoring\\recommended-actions.ts lib\\performance\\scoring\\subject-scoring.ts lib\\performance\\scoring\\risk-queue.ts lib\\performance\\risk.ts`
- `npx eslint \"app\\(ops)\\performance\\_lib\\performance-types.ts\" \"app\\(ops)\\performance\\_components\\SubjectRiskQueue.tsx\"`

## Files Changed

- `lib/performance/scoring/types.ts`
- `app/(ops)/performance/_lib/performance-types.ts`
- `lib/performance/scoring/recommended-actions.ts`
- `lib/performance/scoring/subject-scoring.ts`
- `lib/performance/risk.ts`
- `lib/performance/scoring/risk-queue.ts`
- `lib/performance/read-layer/fallback-signals.ts`
- `app/(ops)/performance/_components/SubjectRiskQueue.tsx`

## What Remains Partial

- `Financial Runtime` remains the source of truth for revenue; this expansion only derives coordinator-facing risk signals.
- Invoicing/payment/dispute/write-off statuses are still inferred from runtime snapshots and leakage text where available.
- No sponsor-facing automation or accounting workflow was added.

## Result

VPI and the coordinator queue now answer the practical question:

> What money is at risk today?

while staying inside the existing runtime spine.
