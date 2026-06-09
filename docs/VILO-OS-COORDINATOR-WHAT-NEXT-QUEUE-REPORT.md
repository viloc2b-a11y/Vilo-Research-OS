# Vilo OS Coordinator "What Next" Queue Report

Date: 2026-06-03

## Goal

Turn the existing financial, deviation, governance, and performance signals into one explicit coordinator queue without adding architecture, modules, dashboards, or a parallel source of truth.

## What changed

The existing VPI / performance risk queue now carries explicit coordinator action metadata:

- title
- priority
- reason
- recommended next step
- owner role
- linked object label / href when available

The queue remains a projection over existing runtime signals. It does not create a new CTMS, a new financial subsystem, or a new deviation repository.

## Signals used

- `needs_resign`
- pending PI signoff
- blocked procedures
- source generation gaps
- financial leakage
- deviation risk
- visit window risk
- unresolved runtime failures

## What was tested

- `npm run coordinator-ops:smoke`
- `npm run financial:smoke`
- `npm run db:validate-phase7-vpi`
- `npx tsc --noEmit`

## What passed

- `coordinator-ops:smoke`
  - Study workspace wiring remained intact.
  - Existing operational panels stayed connected.
  - Coordinator surface validation passed after the queue contract update.
- `financial:smoke`
  - Financial runtime validation passed.
- `db:validate-phase7-vpi`
  - VPI consolidated validator passed all steps.
- `npx tsc --noEmit`
  - TypeScript typecheck passed after the new queue fields were threaded through existing UI and scoring code.

## What was patched

- Extended the existing performance queue item contract in:
  - `app/(ops)/performance/_lib/performance-types.ts`
  - `lib/performance/scoring/risk-queue.ts`
- Added explicit coordinator metadata for the queue:
  - title
  - priority
  - owner role
  - reason
  - recommended next step
  - linked object label / href
- Wired the new queue metadata into:
  - `app/(ops)/performance/_components/SubjectRiskQueue.tsx`
  - `app/(ops)/performance/_components/CoordinatorTodayInbox.tsx`
- Kept `needs_resign` flowing from existing runtime signals:
  - `lib/performance/read-layer/fallback-signals.ts`
  - `lib/performance/read-layer/signals/visit-signals.ts`
  - `lib/performance/scoring/types.ts`
  - `lib/performance/scoring/subject-scoring.ts`
  - `lib/performance/scoring/recommended-actions.ts`
  - `lib/performance/risk.ts`

## What remains partial

- Owner roles are derived from signal type and remain heuristic, not a persisted staffing model.
- Linked object labels are derived from existing context links and remain projections, not a new object registry.
- VIP external destinations remain intentionally blocked for environment safety.
- The queue is coordinator-facing and signal-derived; it is not a replacement for runtime execution or financial truth.

## Evidence against parallel architecture

- No new CTMS layer was introduced.
- No new source-of-truth layer was introduced.
- No new dashboard was created.
- No new financial subsystem was created.
- No new deviation repository clone was created.
- VIP external calls were not forced.

## Exact files changed

- [app/(ops)/performance/_components/CoordinatorTodayInbox.tsx](<C:\dev\vilo-os\app\(ops)\performance\_components\CoordinatorTodayInbox.tsx>)
- [app/(ops)/performance/_components/SubjectRiskQueue.tsx](<C:\dev\vilo-os\app\(ops)\performance\_components\SubjectRiskQueue.tsx>)
- [app/(ops)/performance/_lib/performance-types.ts](<C:\dev\vilo-os\app\(ops)\performance\_lib\performance-types.ts>)
- [docs/VILO-OS-COORDINATOR-WHAT-NEXT-QUEUE-REPORT.md](<C:\dev\vilo-os\docs\VILO-OS-COORDINATOR-WHAT-NEXT-QUEUE-REPORT.md>)
- [lib/performance/read-layer/fallback-signals.ts](<C:\dev\vilo-os\lib\performance\read-layer\fallback-signals.ts>)
- [lib/performance/read-layer/signals/visit-signals.ts](<C:\dev\vilo-os\lib\performance\read-layer\signals\visit-signals.ts>)
- [lib/performance/risk.ts](<C:\dev\vilo-os\lib\performance\risk.ts>)
- [lib/performance/scoring/recommended-actions.ts](<C:\dev\vilo-os\lib\performance\scoring\recommended-actions.ts>)
- [lib/performance/scoring/risk-queue.ts](<C:\dev\vilo-os\lib\performance\scoring\risk-queue.ts>)
- [lib/performance/scoring/subject-scoring.ts](<C:\dev\vilo-os\lib\performance\scoring\subject-scoring.ts>)
- [lib/performance/scoring/types.ts](<C:\dev\vilo-os\lib\performance\scoring\types.ts>)

## Final module status

- Document Center: healthy
- Protocol Intake: healthy
- Reconciliation: healthy
- Runtime Generation: healthy
- Source Runtime: healthy
- Visit Runtime: healthy
- Governance Runtime: healthy
- Financial Runtime: healthy
- Deviation Runtime: signal-only and aligned
- VPI: healthy and now more explicit for coordinator action
- VIP Bridge: intentionally blocked from external calls

