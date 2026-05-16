# Phase 3A — First operational vertical slice (results)

Operational slice: authenticated **study → subject → visit → procedure execution**, with **one write**: mark execution **completed** (JWT-backed Supabase client, RLS), append **`operational_events`**, optional audit via **`logAuditEvent`** (service role, best-effort).

---

## A. Files created or changed

| Path | Change |
|------|--------|
| `lib/actions/complete-procedure-execution.types.ts` | **New** — shared `CompleteProcedureResult` type and `OPERATIONAL_EVENT_PROCEDURE_COMPLETED` constant (not in a `'use server'` file; Next.js 15 only allows async exports there). |
| `lib/actions/complete-procedure-execution.ts` | Server action `completeProcedureExecution` — fetch under RLS, conditional update, insert operational event, revalidate paths, audit. |
| `components/clinical/procedure-complete-button.tsx` | Client button invoking the action with clear success/error feedback. |
| `app/(ops)/studies/page.tsx` | Read-only studies list. |
| `app/(ops)/studies/[studyId]/page.tsx` | Study detail + subject list. |
| `app/(ops)/subjects/[subjectId]/page.tsx` | Subject detail + visit list. |
| `app/(ops)/visits/[visitId]/page.tsx` | Visit detail + procedure list + complete control. |
| `components/shell/sidebar.tsx` | **Studies** nav item → `/studies`. |
| `app/(ops)/page.tsx` | Dashboard copy + link to Studies. |

---

## B. Routes added

All live under the authenticated **(ops)** segment (URL group does not appear in the path). Effective routes:

- `/` — dashboard (existing shell)
- `/studies` — studies list
- `/studies/[studyId]` — study + subjects
- `/subjects/[subjectId]` — subject + visits
- `/visits/[visitId]` — visit + procedure executions + **Mark completed**

Middleware requires a session for every non-public path (including the above).

---

## C. Server actions added

| Action | Role |
|--------|------|
| `completeProcedureExecution({ procedureExecutionId, revalidateVisitPath, revalidateStudyPath, revalidateSubjectPath })` | Writes `procedure_executions` (status + `performed_at` + `performed_by_user_id`), inserts `operational_events` with `event_type` **`PROCEDURE_COMPLETED`**, calls `logAuditEvent` with action **`PROCEDURE_EXECUTION_COMPLETED`**, `revalidatePath` for visit/study/subject and `/studies`. |

List pages use **plain server components + `createServerClient()`** queries (no separate list “actions”; could be extracted later).

---

## D. RLS and security notes

- **Fail closed**: No reads or writes assume a client-supplied `organization_id`. IDs come from URLs; visibility and mutability are enforced by **RLS** on the user’s JWT (`createServerClient()`).
- **No service role** for the clinical mutation path; **`logAuditEvent`** uses the **service role** only for **`audit_events`**, swallowing failures so the workflow is not blocked.
- **`PROCEDURE_COMPLETED`**: Matches `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md` naming (canonical enum-style), not a dotted literal `procedure.completed`.
- **`completed_at`**: Schema uses **`performed_at`** / **`performed_by_user_id`** for completion stamping; **`completed_at`** is not written.
- **Idempotency**: If status is already `completed`, the action returns success with `idempotent: true`. If two requests race pending → completed, duplicate **`operational_events`** are theoretically possible unless a DB transaction or uniqueness guard is added later.
- **Terminal states**: `not_applicable` and `cancelled` cannot be completed.

---

## E. Validation results

| Check | Result |
|-------|--------|
| `npm run lint` | Pass (0 errors). |
| `npm run build` | Pass (Next.js 15.3.2). |
| User A (org + study access) can see hierarchy and complete a procedure | **Manual** — run against staging with Phase 2 synthetic users; not automated in this repo. |
| User B (other org) cannot see Org A rows | **Manual** — expect `notFound()` or empty lists per RLS. |
| User C (same org, not study member) cannot see study-scoped rows | **Manual** — expectation set by Phase 2 RLS; verify with roster-off user. |
| Completing inserts `operational_events` row | Verify in DB for type **`PROCEDURE_COMPLETED`**. |
| Re-complete same execution | Safe: returns **`Already completed.`** (`idempotent: true`); optional extra operational event only if concurrency races before idempotent branch (see section D). |

---

## F. Remaining blockers

- **Concurrency** addressed in Phase 3B — see **`docs/PHASE3B-RPC-RESULTS.md`** and **`0012_complete_procedure_execution_rpc.sql`** (single-transaction RPC with row lock; no duplicate event on retries).

- **Manual A/B/C pass** against the Phase 3A routes is still advisable for UX; procedural RPC isolation **is automated** via **`npm run db:validate-phase3b`** (see **`docs/PHASE3B-VALIDATION-RESULTS.md`** after a validator run).

---

## G. Exact next recommended step

Use Phase 3B on the target branch: **`npm run db:migrate`** (includes `0012`) and **`npm run db:validate-phase3b`**.
