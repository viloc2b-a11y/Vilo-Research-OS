# Vilo OS Budget Negotiation Export + Smoke Report

Date: 2026-06-03

## What Was Added

- Shareable counteroffer export endpoint:
  - `GET /api/study-workspace/[studyId]/budget-negotiation-export`
- Operational negotiation sequence derived from the existing negotiation ledger
- Budget negotiation export markdown builder
- End-to-end smoke script for the budget negotiation flow

## Operational Sequence

The negotiation state is now formalized as a derived sequence:

1. Evidence missing
2. SOA reviewed
3. Sponsor offer received
4. Counteroffer drafted
5. Counteroffer sent
6. Sponsor reply received
7. Term accepted
8. Term adjusted
9. Term rejected

## Smoke Results

Passed:

- `npx tsc --noEmit`
- `npx tsx scripts/budget-negotiation-e2e-smoke.ts`
- `npm run coordinator-ops:smoke`
- `npm run financial:smoke`
- `npm run db:validate-phase7-vpi`
- `npx eslint lib/study-workspace/load-budget-evidence-summary.ts components/study-workspace/study-command-center-view.tsx app/api/study-workspace/[studyId]/budget-negotiation-export/route.ts --no-warn-ignored`

Smoke mode:

- Offline fixture mode was used because Supabase env vars were not available in this environment.

## What Remains True

- Financial Runtime remains the source of truth for expected, executed, earned, invoiced, and paid revenue.
- Budget negotiation stays append-only and study-scoped.
- No parallel CTMS or alternate source-of-truth layer was introduced.

