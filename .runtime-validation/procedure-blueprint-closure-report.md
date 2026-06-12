# Procedure Blueprint Library Closure Report

## Summary
- Protocol: VALIDATION_PROTOCOL_001
- Date: 2026-06-09
- Change: Seeded 7 missing procedure blueprints; added observability to silent-drop filter

## Before
- Runtime manifest procedures: 14
- Procedures with active blueprint version (generated): 7
- Dropped by silent-drop filter (`no active blueprint version`): 7

## After
- Runtime manifest procedures: 14
- Procedures with active blueprint version (expected): 14
- Dropped by filter (expected): 0

## Seeded Blueprints

| procedure_code | procedure_name | category | tier |
|---|---|---|---|
| `ELIGIBILITY_REVIEW` | Eligibility Review | regulatory | universal |
| `MEDICAL_HISTORY` | Medical History | clinical_review | universal |
| `CONMED_REVIEW` | Concomitant Medication Review | medication | universal |
| `PHONE_CONTACT` | Remote / Phone Contact | follow_up | common |
| `EOS_CLOSEOUT` | EOS Visit Closeout | follow_up | common |
| `ACTH_STIM_TEST` | ACTH Stimulation Test | laboratory | study_specific |
| `HIT_PLATELET_PANEL` | HIT / Platelet Panel | laboratory | study_specific |

Notes:
- `CONMED_REVIEW` and `ACTH_STIM` were present in migration `0110` but only seeded when the
  `procedure_library` table was empty (via an `IF NOT EXISTS ... LIMIT 1` guard). Migration 0179
  uses `WHERE NOT EXISTS (SELECT 1 ... WHERE procedure_code = ...)` to make each row individually
  idempotent, so they are guaranteed to exist even in environments where 0110's guard fired.
- `ACTH_STIM_TEST` is a distinct code from the legacy `ACTH_STIM` code in 0110; the new code
  aligns with the runtime manifest label `PROC_PARA_ACTH_STIM`.

## Observability Added

`lib/protocol-reconciliation/suggest-procedure-matches.ts` — `suggestProcedureMatches` function.

**What changed**: before the existing drop filter
(`.filter((item) => item.confidence > 0 && item.blueprintVersionId)`), the function now collects
any items that have `confidence > 0` but `blueprintVersionId` is null/undefined. Those items are
reported via `console.warn` with:

- `totalDropped` count
- Per-dropped item: `procedureCode`, `procedureName`, `confidence`, `reason: 'NO_ACTIVE_BLUEPRINT_VERSION'`
- Protocol context if available: `protocolVersionId`, `studyId`

The filter logic and return type (`ProcedureMatchSuggestion[]`) are unchanged. The
`DroppedProcedureCandidate` type is exported for callers that wish to inspect dropped items
directly.

The `runSuggestProcedureMatches` async function passes `protocolVersionId` as context to every
`suggestProcedureMatches` call, so dropped procedures are traceable to the triggering protocol run.

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/0179_procedure_blueprint_library_closure.sql` | New migration — seeds 7 blueprints |
| `lib/protocol-reconciliation/suggest-procedure-matches.ts` | Added drop observability + `DroppedProcedureCandidate` type |
| `.runtime-validation/procedure-blueprint-closure-report.md` | This report |

## Root Cause

The silent-drop filter in `suggest-procedure-matches.ts` (line ~87 before this change, now line ~110)
filters out any matched procedure where `blueprintVersionId` is falsy. This is correct behaviour —
you cannot generate a procedure source document without a published blueprint version.

The root cause of the 7/14 generation gap was that the `procedure_library` table had no rows with
`active_version_id` set for the 7 procedures above. All 7 had matching profiles in
`fixtures/source-builder/procedure-profile-library.v1.json` and were present in the runtime manifest,
but were never seeded as global blueprint rows in any migration.

Additionally, `CONMED_REVIEW` and `ACTH_STIM` from migration `0110` used a table-level emptiness
guard (`IF NOT EXISTS (SELECT 1 FROM procedure_library WHERE library_scope = 'global' LIMIT 1)`)
that silently skipped the entire seed block in environments that had any other global row already
present. Migration 0179 switches to row-level `WHERE NOT EXISTS` guards, making each blueprint
independently idempotent.

## Procedure-to-Blueprint Mapping (VALIDATION_PROTOCOL_001)

| Runtime manifest code | Label | Blueprint code | Status after 0179 |
|---|---|---|---|
| `PROC_PARA_CONSENT` | Informed Consent | `INFORMED_CONSENT` (0110) | pre-existing |
| `PROC_PARA_ELIGIBILITY` | Eligibility Review | `ELIGIBILITY_REVIEW` | seeded by 0179 |
| `PROC_PARA_MED_HIST` | Medical History | `MEDICAL_HISTORY` | seeded by 0179 |
| `PROC_PARA_CONMEDS` | ConMeds Review | `CONMED_REVIEW` | idempotent via 0179 |
| `PROC_PARA_VITALS` | Vital Signs | `VITAL_SIGNS` (0110) | pre-existing |
| `PROC_PARA_HEMATOLOGY` | Hematology / CBC | `CBC` (0110) | pre-existing |
| `PROC_PARA_CHEMISTRY` | Clinical Chemistry | `CLINICAL_CHEMISTRY` (0110) | pre-existing |
| `PROC_PARA_MORNING_CORTISOL` | Morning Cortisol | `MORNING_CORTISOL` (0110) | pre-existing |
| `PROC_PARA_IP` | IP Administration | `IP_ADMINISTRATION` (0110) | pre-existing |
| `PROC_PARA_AE` | AE Assessment | `AE_REVIEW` (0110) | pre-existing |
| `PROC_PARA_REMOTE_CONTACT` | Remote / Phone Contact | `PHONE_CONTACT` | seeded by 0179 |
| `PROC_PARA_ACTH_STIM` | ACTH Stimulation Test | `ACTH_STIM_TEST` | seeded by 0179 |
| `PROC_PARA_HIT_PANEL` | Platelet / HIT Panel | `HIT_PLATELET_PANEL` | seeded by 0179 |
| `PROC_PARA_EOS_CLOSEOUT` | EOS Visit Closeout | `EOS_CLOSEOUT` | seeded by 0179 |

## Remaining Gaps for Other Protocols

`VALIDATION_PROTOCOL_002` should be evaluated separately. Run
`scripts/reader-closure-live.ts` or `scripts/protocol-to-source-closure-live.ts` against that
protocol's manifest to identify any procedures lacking active blueprint versions.
