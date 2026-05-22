# Operational Spine — Phase 8 (Subject Closeout)

**Status:** PASS (re-audit after checklist + server gates)  
**Gate question:** Can a subject reach a terminal status without silently leaving execution incomplete?

## Delivered

| Requirement | Implementation |
|-------------|----------------|
| Subject closeout checklist | `SubjectCloseoutChecklist` on Subject → General |
| Pending source | Blocker: draft / in-progress `source_response_sets` |
| Open visits | Blocker: non-terminal visit statuses |
| Signatures | Blocker: missing investigator visit sign-off; warning: coordinator pending |
| Unresolved workflow | Warning: open workflow tasks (non-signature) |
| Open AEs | Warning: registry rows in `open` / `follow_up` |
| Procedure validation | Blocker: blocked / incomplete procedures |
| EOS / withdrawal reason | Required min 10 chars on withdraw, screen fail (non-screening), LTFU |
| Server enforcement | `assertSubjectCloseoutAllowed` on complete, withdraw, LTFU |
| Audit trail | `SUBJECT_COMPLETED`, `SUBJECT_WITHDRAWN`, `SUBJECT_SCREEN_FAILED`, `SUBJECT_LOST_TO_FOLLOW_UP` operational events |

## Files

- `lib/subject/closeout/*`
- `components/subject/SubjectCloseoutChecklist.tsx`
- `components/subject/subject-closeout-forms.tsx`
- `lib/subject/subject-chart/actions.ts`
- `app/(ops)/subjects/[subjectId]/page.tsx`

## Intentional rules

- **Screen fail during `screening`:** does not require full execution checklist (enrollment never started).
- **Screen fail after enrollment:** requires blocker clearance (same as withdraw).
- **Warnings** do not disable buttons; coordinators must document in reason text when proceeding with review items only after blockers clear.

## Not in scope

- Formal PV case closure
- eTMF document completeness
- Protocol deviation adjudication records

## Re-audit checklist

- [ ] Subject with open visit cannot Mark Completed
- [ ] Subject with blocked procedure cannot withdraw without resolving blockers
- [ ] Checklist shows deep links to visit, capture, workflow, AE tab
- [ ] Terminal subjects show closed state card only
