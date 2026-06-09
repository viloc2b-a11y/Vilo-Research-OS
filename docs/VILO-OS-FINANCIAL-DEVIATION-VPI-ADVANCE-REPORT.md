# Vilo OS Financial / Deviation / VPI Advance Report

Date: 2026-06-03

## Scope

This pass stayed strictly on the existing runtime spine:
`Document Center -> Protocol Intake -> Reconciliation -> Runtime Generation -> Source Runtime -> Visit Runtime -> Governance Runtime -> Financial Runtime -> VPI`

No new CTMS layer was added. No parallel source of truth was introduced. No external VIP calls were forced.

## What was tested

- `npx tsx scripts/phase12c-intake-smoke.ts`
- `npm run coordinator-ops:smoke`
- `npm run financial:smoke`
- `npm run db:validate-phase7-vpi`
- `npx tsc --noEmit`

## What passed

- `phase12c-intake-smoke`
  - PARA path passed with 11 visits, 7 procedures, 7 source-composition recommendations.
  - MV path passed after fixture alignment.
- `coordinator-ops:smoke`
  - Study workspace now wires the existing `StudyOperationsPanel`.
  - Study workspace now wires the existing `StudyVisitSourceContinuityPanel`.
- `financial:smoke`
  - Financial runtime validation passed.
- `db:validate-phase7-vpi`
  - VPI consolidated validator passed all phases.
- `npx tsc --noEmit`
  - Typecheck passed after the signal mappings were updated.

## What failed before patching

- `phase12c-intake-smoke`
  - MV branch expected `STUDY-INF-001` while the fixture text clearly states `Protocol Number: MV40618`.
  - This was a fixture identity mismatch, not an architecture problem.
- `coordinator-ops:smoke`
  - The study workspace page did not include `StudyOperationsPanel`, even though the panel already existed.
- `npx tsc --noEmit`
  - Adding `needs_resign` required exhaustiveness updates in the existing performance scoring and UI mapping code.

## What was patched

- Fixed the MV smoke fixture identity in `scripts/phase12c-intake-smoke.ts`.
- Wired the existing operational panels into `app/(ops)/studies/[studyId]/workspace/page.tsx` and `components/study-workspace/study-workspace-shell.tsx`.
- Added runtime-derived `needs_resign` as a first-class signal in the existing performance spine:
  - `lib/performance/scoring/types.ts`
  - `lib/performance/scoring/subject-scoring.ts`
  - `lib/performance/scoring/recommended-actions.ts`
  - `lib/performance/scoring/risk-queue.ts`
  - `lib/performance/read-layer/fallback-signals.ts`
  - `lib/performance/read-layer/signals/visit-signals.ts`
  - `app/(ops)/performance/_lib/performance-types.ts`
  - `app/(ops)/performance/_components/SubjectRiskQueue.tsx`
  - `lib/performance/risk.ts`

## Deviation runtime

Deviation stays signal-only and derived from existing runtime events:
- reopened visit review status now maps to `needs_resign`
- governance rules remain the source of deviation semantics
- no deviation repository clone was created

## Financial runtime

Financial runtime remained on the existing spine and passed smoke validation.
This pass did not introduce a separate financial subsystem.

## VPI

VPI now consumes the reopened / needs-resign signal path without becoming a new source of truth.
The consolidated VPI validator still passes.

## Remaining blocked items

- Live external VIP calls remain intentionally blocked for environment safety.
- Live E2E access to remote services is still environment-dependent and should be treated as degraded when fetch access is unavailable.

## Evidence against parallel architecture

- Reused existing panels, loaders, and signal mappers.
- Did not add a new CTMS.
- Did not add a new deviation store.
- Did not add a new source-of-truth layer.
- Did not force external VIP destinations.

## Module status

- Document Center: healthy
- Protocol Intake: healthy
- Reconciliation: healthy
- Runtime Generation: healthy
- Source Runtime: healthy
- Visit Runtime: healthy
- Governance Runtime: healthy
- Financial Runtime: healthy
- Deviation Runtime: signal-only, partial but aligned
- VPI: healthy
- VIP Bridge: intentionally blocked from external calls

