# Phase 3B — Transactional procedure completion RPC (results)

Phase 3A separated `procedure_executions` updates and `operational_events` inserts, which allowed duplicate **`PROCEDURE_COMPLETED`** rows under tight races. Phase 3B moves both steps into **`public.complete_procedure_execution(uuid)`**, executed atomically inside one Postgres RPC call (single transaction boundary per invocation).

---

## A. Files changed

| Path | Change |
|------|--------|
| `supabase/migrations/0012_complete_procedure_execution_rpc.sql` | **New** — RPC `complete_procedure_execution(p_procedure_execution_id uuid)` + `authenticated` EXECUTE grant. |
| `scripts/apply-migrations.mjs` | Registers **`0012_complete_procedure_execution_rpc.sql`** after `0011_attachments.sql`. |
| `lib/actions/complete-procedure-execution.ts` | Calls **`supabase.rpc('complete_procedure_execution', …)`**; audit only on fresh completion (`idempotent` not true). |
| `lib/actions/complete-procedure-execution.types.ts` | Adds **`CompleteProcedureRpcPayload`** (RPC JSON typing). |
| `scripts/validate-phase3b.mjs` | **New** — resets Phase 2 fixture procedure to `pending`, runs RPC twice under User A, probes User B / User C. |
| `package.json` | **`npm run db:validate-phase3b`** |
| `README.md` | Documents Phase 3B validator command. |

**Generated:** `docs/PHASE3B-VALIDATION-RESULTS.md` — written each time **`npm run db:validate-phase3b`** succeeds or fails checks.

---

## B. RPC behavior

1. **`auth.uid()`** must be present; otherwise returns **`{ ok: false, error: "authentication required", … }`**.

2. **`SELECT … FROM procedure_executions … FOR UPDATE`** under caller identity (RLS). If zero rows (**hidden or missing**): **`procedure execution not found or access denied`**.

3. **Explicit capability gate** (aligned with migrations **0009** UPDATE + **0010** INSERT policies):
   - `organization_id in user_organization_ids()`
   - **`user_can_manage_subject_enrollment(study_id)`**
   - **`user_can_append_operational_events(study_id)`**

   Coordinators/admins/org-admins satisfying those helpers proceed; roster-only principals without enrollment/append privilege do not.

4. **Already `completed`:** returns **`ok: true`**, **`idempotent: true`**, first matching **`PROCEDURE_COMPLETED`** **`operational_event_id`** if any (**no INSERT**).

5. **`not_applicable` / `cancelled`:** **`ok: false`** with explanatory error.

6. **`pending` / `in_progress`:** **`UPDATE`** sets **`execution_status = 'completed'`**, **`performed_at = clock_timestamp()`**, **`performed_by_user_id = auth.uid()`**. Then **`INSERT`** one **`operational_events`** row with **`event_type = 'PROCEDURE_COMPLETED'`**, payload  
   `{"source":"complete_procedure_execution_rpc","procedure_definition_id":"<uuid>"}`.

7. **`UPDATE`** that touches **zero** rows (**defensive concurrent path**) re-reads status; if now **`completed`**, returns **`idempotent: true`**; else errors.

8. **Success payloads** include **`organization_id`, `study_id`, `visit_id`** for server-side **`logAuditEvent`** without an extra SELECT.

---

## C. Security and RLS notes

- **`SECURITY INVOKER`** (explicit): no bypass of JWT RLS. All reads/writes use the caller row policies on **`procedure_executions`** and **`operational_events`**.

- **`SECURITY DEFINER` not used** for the RPC itself — helpers (`user_organization_ids`, enrollment/append) remain the existing SECURITY DEFINER definitions from Phase 2.

- **Grant:** **`authenticated`** EXECUTE only; revoked from **`public`** to avoid **`anon`** calls.

---

## D. Idempotency validation

| Expectation | How verified |
|-------------|--------------|
| First invocation creates **exactly one** **`PROCEDURE_COMPLETED`** row | Check **`rpc_first_call_exactly_one_procedure_completed_row`** |
| Second call does **not** add rows; **`idempotent: true`**; same **`operational_event_id`** | Checks **`rpc_user_a_second_idempotent`**, **`rpc_second_call_no_extra_procedure_completed`** |

---

## E. Unauthorized user validation

| Expectation | How verified |
|-------------|--------------|
| **User B** (Org Beta) cannot complete Org Alpha procedure (`ok: false`, row invisible) | **`rpc_user_b_cannot_complete_org_a_procedure`** |
| **User C** (Org Alpha only, **no** `study_members`) cannot complete (RLS denies `SELECT`; not-found envelope) | **`rpc_user_c_org_only_cannot_complete_no_study_membership`** |

---

## F. Build and lint result

Run locally:

```bash
npm run lint
npm run build
```

Record the latest outcome in **`docs/PHASE3B-VALIDATION-RESULTS.md`** or CI logs alongside **`npm run db:validate-phase3b`**.

---

## G. Whether Phase 3B is GREEN

Phase 3B is **GREEN** when all of the following hold:

1. Migration **`0012_complete_procedure_execution_rpc.sql`** applied to the target database.
2. **`npm run lint`** and **`npm run build`** succeed.
3. **`npm run db:validate-phase3b`** exits **0** (see **`docs/PHASE3B-VALIDATION-RESULTS.md`** — **PASS** on all Phase 3B checks, **FAIL**/`BLOCKED` count zero).

Until (1)-(3) are run against your Supabase branch, treat Phase 3B as **implementable / pending rollout** rather than GREEN in that environment.

