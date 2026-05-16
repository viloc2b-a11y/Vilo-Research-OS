# Phase 3C — Visit completion and locking (results)

Adds transactional **`complete_visit`** and **`lock_visit`** RPCs (`SECURITY INVOKER`), extends **`complete_procedure_execution`** for terminal visits, plus **`completeVisit`** / **`lockVisit`** Next.js actions (JWT only).

Canonical app root: **`VILO CTMS/vilo-os`**. Workspace overlay **`Clinical Research Operations OS eClinPro/vilo-os`** may mirror Phase 3C files alongside this doc path.

---

## A. Files changed

| Area | Paths |
|------|--------|
| Migration **`0013`** | `supabase/migrations/0013_visit_completion_and_locking_rpc.sql` |
| Migrations runner | `scripts/apply-migrations.mjs` |
| Validator | `scripts/validate-phase3c.mjs` |
| Actions | `lib/actions/visit-lifecycle.types.ts`, `complete-visit.ts`, `lock-visit.ts`, updated `complete-procedure-execution.types.ts` |
| UI | `components/clinical/visit-lifecycle-actions.tsx`, `app/(ops)/visits/[visitId]/page.tsx` |
| Tooling | `package.json`, `README.md` |
| Validation output | **`docs/PHASE3C-VALIDATION-RESULTS.md`** (generator) |

---

## B. RPC behavior

**Schema:** **`visits`**: **`actual_date`**, **`locked_at`**, **`locked_by_user_id`**, **`visit_status` includes `locked`**; **`procedure_executions.execution_status`** includes **`verified`**.

### `complete_visit(p_visit_id uuid)`

Locks visit row (**`FOR UPDATE`**). Checks org + **`user_can_manage_subject_enrollment`** + **`user_can_append_operational_events`**. Validates every **required** entry in **`visit_def_procedure_map`** has an execution in **`completed` | `verified`**. Sets **`visit_status = completed`**, fills **`actual_date` / completed_at / occurred_at** via **`COALESCE`**, inserts **`VISIT_COMPLETED`** (**no duplicates** via idempotent **`completed` | `locked`** branches).

### `lock_visit(p_visit_id uuid)`

Requires current **`completed`**. Runs **`completed → verified`** on procedure executions, inserts **`VISIT_LOCKED`**, then sets **`locked`** + attribution columns (coalescing). Idempotent while **`locked`**.

### Patched **`complete_procedure_execution`**

Locks procedure + visit; **`verified`** executions idempotent-return **`PROCEDURE_COMPLETED`** event; **`pending/in_progress`** completion blocked when visit is **`locked` | `completed` | `cancelled` | `no_show`**.

---

## C. Security and RLS notes

Invoker semantics only; EXECUTE revoked from **`public`**, granted to **`authenticated`** for **`complete_visit`**, **`lock_visit`**, **`complete_procedure_execution`**.

---

## D. Lifecycle validation

Automated **`npm run db:validate-phase3c`**: rejects early **`complete_visit`**, happy path emits single **`VISIT_COMPLETED`**, idempotent redo, **`lock_visit`** + **`verified`**, **`VISIT_LOCKED`** idempotency, procedure guard on locked visits.

---

## E. Unauthorized user validation

Harness asserts User B (**cross-org**) and User C (**org-only, no study roster**) RPC denials.

---

## F. Event and idempotency validation

Operational counts for the Phase 2 fixture scoped to seeded visit/exec must stay **proc=1**, **visit-complete=1**, **visit-lock=1** post-sequence before isolation probes mutate nothing.

---

## G. Build and lint result

From **`VILO CTMS/vilo-os`** (2026-05-15):

| Command          | Exit code |
|------------------|-----------|
| `npm run lint`   | **0**     |
| `npm run build`  | **0**     |

---

## H. Whether Phase 3C is green

Phase 3C is **GREEN** when migration **`0013`** is applied to the Supabase Postgres instance wired in **`.env.local`**, **`npm run lint`** and **`npm run build`** pass, **`npm run db:validate-phase3c`** exits **0**, and **`docs/PHASE3C-VALIDATION-RESULTS.md`** has no FAIL/BLOCKED rows.

**Current state:** app **lint/build green** after wiring **`VisitLifecycleActions`** on the visit detail page. **`db:validate-phase3c` was RED** on the latest run (**Supabase client error:** “Could not find the function **`public.complete_visit(p_visit_id)`** in the schema cache”) until **`npm run db:migrate`** succeeds — use a valid **`DATABASE_URL_DIRECT`** (session/direct host) when the pooled URL returns “Tenant or user not found”; then re-run **`npm run db:validate-phase3c`** so **`PHASE3C-VALIDATION-RESULTS.md`** regenerates as GREEN.
