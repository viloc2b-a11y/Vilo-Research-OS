# VILO OS Longitudinal Labs Runtime Report

## 1. Audit Results

The audit confirmed that Vilo OS already had the necessary source/runtime substrate for labs:

- lab fields and section definitions in source runtime
- typed source response storage
- visit-linked lab document chronology
- published source field metadata for section classification

What was missing was the subject-level longitudinal runtime, explainable trend derivation, and operational lab signals inside VPI.

## 2. Existing Components Reused

Reused without redesign:

- `lib/source-engine/definitions/field.catalog.ts`
- `lib/source-engine/definitions/section.catalog.ts`
- `lib/source-engine/canonical-clinical-library.ts`
- `supabase/migrations/0021_source_responses.sql`
- `supabase/migrations/0027_published_source_definitions.sql`
- `lib/subject/lab-timeline/load-subject-lab-timeline.ts`
- `lib/performance/read-layer/build-from-signals.ts`
- `lib/performance/scoring/*`

## 3. Runtime Capabilities Added

Added inside the existing spine:

- subject-level lab observation normalization from existing source response data
- baseline / previous / current value derivation
- delta vs previous / delta vs baseline / percent change calculation
- explainable trend states:
  - `improving`
  - `stable`
  - `worsening`
  - `fluctuating`
- operational runtime signals only, no diagnosis

## 4. Signals Added

Derived lab signals now include:

- `lab_worsening`
- `lab_consecutive_worsening`
- `lab_consecutive_abnormal`
- `lab_missing_repeat`
- `lab_follow_up_overdue`
- `lab_safety_review`

Recommended next steps are operational only, such as:

- Review with investigator
- Verify protocol-required follow-up
- Escalate for PI review

## 5. VPI Integration

VPI now consumes the longitudinal lab signal stream through the existing performance read layer.

The coordinator queue can now surface lab items with:

- title
- priority
- reason
- owner role
- linked subject / visit context
- linked lab series context

Lab signals are projected into the existing subject risk queue pattern. No new dashboard was created.

## 6. Files Changed

Implemented or updated for this block:

- `app/(ops)/subjects/[subjectId]/page.tsx`
- `components/subject/labs/SubjectLabTimelinePanel.tsx`
- `lib/subject/lab-timeline/load-subject-longitudinal-labs.ts`
- `lib/subject/lab-timeline/longitudinal-lab-runtime.ts`
- `lib/subject/lab-timeline/normalize-source-lab-observations.ts`
- `lib/subject/lab-timeline/types.ts`
- `scripts/longitudinal-labs-runtime-smoke.ts`
- `lib/performance/read-layer/query/query-limits.ts`
- `lib/performance/read-layer/signals/index.ts`
- `lib/performance/read-layer/signals/lab-signals.ts`
- `lib/performance/read-layer/build-from-signals.ts`
- `lib/performance/read-layer/fallback-signals.ts`
- `lib/performance/scoring/types.ts`
- `app/(ops)/performance/_lib/performance-types.ts`
- `lib/performance/scoring/recommended-actions.ts`
- `lib/performance/scoring/subject-scoring.ts`
- `lib/performance/scoring/risk-queue.ts`
- `app/(ops)/performance/_components/SubjectRiskQueue.tsx`

## 7. Tests Run

Passed:

- `npx tsx scripts/longitudinal-labs-runtime-smoke.ts`
- `npx tsc --noEmit`
- `npm run coordinator-ops:smoke`
- `npm run db:validate-phase7-vpi`
- `npm run financial:smoke`
- `npx eslint --no-warn-ignored ...` on the touched lab and VPI files

## 8. What Remains Partial

This block is operational intelligence, not diagnosis. Remaining partial areas:

- no clinical decision automation
- no second lab repository
- no duplicate persistence layer
- lab quality depends on the completeness of existing source responses and published source metadata
- longitudinal labs are surfaced as read-derived runtime facts, not a new stored truth

## 9. Evidence No New Source of Truth Was Introduced

The implementation reuses:

- existing source response storage
- existing source response sets / visit linkage
- existing source field metadata
- existing performance read layer
- existing subject / VPI surfaces

No new lab database table, no duplicate lab platform, and no parallel clinical repository were introduced.

