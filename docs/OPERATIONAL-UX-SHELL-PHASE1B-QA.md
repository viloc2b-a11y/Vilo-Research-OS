# Operational UX Shell Phase 1B QA

## Scope

Phase 1B hardens the coordinator-first operational shell without adding new product surface area, Source Engine features, protocol ingestion, charts, or migrations.

Reviewed surfaces:

- `/command-center`
- `/studies/[studyId]/workspace`
- `/subjects/[subjectId]/workspace`
- `/visits/[visitId]`

## Real Data Sources

The shell reads only existing runtime data:

- `visits`
- `procedure_executions`
- `source_response_sets`
- `source_response_validation_findings`
- `subject_workflow_actions`
- `operational_events`
- `study_subjects`
- `studies`
- Existing VPI read model when available

No fake rows, synthetic counts, sponsor-specific names, or protocol-specific labels are introduced.

## Hardening Completed

- Command Center Source Engine blockers are scoped through organization-owned `source_response_sets` before reading `source_response_validation_findings`.
- Study workspace blockers are scoped through study-owned `source_response_sets`.
- Subject workspace visit, procedure, and source-set reads include organization scoping after the subject record is resolved.
- Command Center tolerates VPI partial/unavailable data and reports that state in `unavailable`.
- Study and subject workspaces use `notFound()` for missing or invalid records instead of unsafe null access.
- Every operational list card includes an explicit action link in the card header.
- Loading states were added for the three new shell routes.
- Recent events are scoped by organization/study/visit through existing operational chronology helpers.

## Remaining Unavailable Data

- High-risk subjects depend on the existing VPI read model. If VPI returns errors or an empty queue, the Command Center shows empty/unavailable state rather than fabricating risk data.
- Clinical profile and ConMed cards link to existing subject tabs. If the clinical profile read fails, the link remains available and the status is reported as unavailable.
- Source Engine blockers are limited to recent response sets visible to the current organization/study scope. This is intentional for Phase 1B to keep reads bounded.

## Validation Commands

Run before release:

```bash
npx tsc --noEmit
npm run lint
npm run build
node scripts/validate-operational-ux-shell.mjs
```

## QA Result

The Phase 1B shell is a read-only operational layer. It does not alter capture, sign, submit, correction, addendum, or Source Engine execution flows.
