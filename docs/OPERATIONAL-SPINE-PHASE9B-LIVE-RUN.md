# PHASE 9B — Human Coordinator Live Run

**Date:** 2026-05-19  
**Environment:** Local dev (`localhost:3000`) + Supabase staging  
**Session type:** Structured operational walkthrough via browser automation (proxy coordinator). **Not** a silent blind human observation session.

---

## 1. Coordinator profile

| Field | Value |
|-------|--------|
| Role | Clinical Research Coordinator (CRC) |
| Account | `synthetic.staff.a@vilo-os.staging` |
| Site | Synthetic Site Alpha (Staging) |
| Observer | Engineering agent (documented proxy run) |

---

## 2. Study / subject / visit

| Asset | Identifier |
|-------|------------|
| Study | Phase 2 Validation Study (`phase2-validation-study` / `6bae715a-8536-4000-8d24-22b6a3dbb8c9`) |
| Subject | `PHASE9A-PILOT-001` (`4384b789-4e16-4512-b3f3-50642b3b9735`) |
| Visit | Screening Day 1 (`6690da63-4bf1-4681-815a-3e39b7b014bc`) |
| Procedure | CBC (`c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc`) |
| Response set | `59f7a569-1150-4187-85d3-51f4abc2c059` |

---

## 3. Step-by-step observation log

| Step | Requirement | Result | Notes |
|------|-------------|--------|-------|
| 1 | Open study | **PASS** | Study workspace reachable; execution readiness visible |
| 2 | Open subject | **PASS** | Subject chart shows randomized state, visit chronology |
| 3 | Lifecycle state | **PASS** | Status/randomization visible; extra VPI seed visits add noise |
| 4 | Identify visit | **PASS** | Screening Day 1 identifiable in calendar |
| 5 | Check in subject | **SKIP** | Visit workspace shows "Check in subject"; click blocked by narrow viewport in automation (P1 layout) |
| 6 | Open procedure/source | **PASS** | Direct navigation to `/source/capture/{procedureExecutionId}` |
| 7 | Complete source fields | **PARTIAL** | Filled `heart_rate`, `ae_term`, `external_epro_id`, submit reason; many fields are dev-fallback with readonly required booleans |
| 8 | Validation feedback | **PASS** | Errors surfaced after submit attempt (required field list) |
| 9 | Submit/sign source | **FAIL** | First attempts: **500** server crash (P0). After fix: action returns but **Submitted: no**; errors: `ae_present`, `completion_status`, `epro_completed`, `ip_administered` required |
| 10 | Coordinator signature | **NOT REACHED** | Blocked on unsubmitted source |
| 11 | Investigator signature | **NOT REACHED** | Blocked on unsubmitted source |
| 12 | Blockers/warnings | **PARTIAL** | Fallback template banner + engine advisory visible; not coordinator-grade language |
| 13 | Closeout checklist | **NOT REACHED** (prior session) | Subject General tab checklist correctly blocks complete with open visits |
| 14 | Completion/withdrawal | **NOT REACHED** | — |
| 15 | Next action | **UNCLEAR** | After failed submit, no single "do this next" affordance beyond field-level errors |

---

## 4. Hesitation / friction points

- **>5s:** Choosing correct visit among Screening + two "VPI seed" visits
- **Wrong-path risk:** Source capture shows generic dev fallback fields unrelated to CBC
- **Dead ends:** `completion_status` select has only "—"; required booleans show "Yes" but are readonly
- **Tribal knowledge:** Must know to fill `ae_term` / `external_epro_id` when booleans are stuck "Yes"; must ignore engineer banners
- **Crash:** Save and submit caused full-page 500 until server-action export fix
- **Trust:** `Responses (current): 0` while form shows values — duplicate mental model
- **Dev noise:** Hydration overlay on most pages; sidebar "soon" links

---

## 5. Findings

### P0 (fixed during session)

1. **Source submit 500** — `'use server'` file exported `INITIAL_CAPTURE_ACTION_STATE` object from `lib/source/capture/actions.ts`. Next.js rejects non-function exports → entire capture POST failed.
2. **Same pattern on capture page bundle** — `INITIAL_WORKFLOW_ACTION_STATE` exported from `lib/subject/workflow/actions.ts` caused second 500 on submit.

**Fix applied:** Move initial state constants to `types.ts` modules; client imports initial state from types, actions export async functions only.

### P0 (open)

None additional after fix — submit action executes (HTTP 200) but **business validation still fails** (see P1).

### P1

1. **Fallback capture template** — Screening CBC uses generic dev fallback; required fields (`completion_status`, readonly booleans) cannot be completed by a coordinator without engineering knowledge.
2. **Submit vs manifest mismatch** — UI shows validation errors but `Submitted: no` / `Responses (current): 0` — unclear whether data persisted.
3. **Check-in control** — Present on visit page but easy to miss; automation scroll issues suggest mobile/narrow layout friction.
4. **Chronology noise** — VPI seed visits labeled in calendar alongside protocol Screening visit.
5. **Hydration errors** — Recurring Next.js sidebar hydration overlay in dev (erodes confidence).
6. **Engineering copy on capture** — "CRC capture shell", "Source Engine Advisory", package IDs — not coordinator language.

### P2

1. Sidebar placeholder links (`Tasks soon`, etc.)
2. Study page publish JSON fields (prior session)
3. Dev hydration badge

---

## 6. Minimal fixes applied

| File | Change |
|------|--------|
| `lib/source/capture/actions.ts` | Remove `export { INITIAL_CAPTURE_ACTION_STATE }` |
| `components/source/capture-form.tsx` | Import initial state from `types.ts` |
| `lib/source/capture/index.ts` | Re-export initial state from `types.ts` |
| `lib/subject/workflow/types.ts` | Add `WorkflowActionState` + `INITIAL_WORKFLOW_ACTION_STATE` |
| `lib/subject/workflow/actions.ts` | Remove const export from `'use server'` file |
| `components/subjects/workflow/*` | Import initial state from `types.ts` |

---

## 7. Re-run result (post-fix)

| Action | Before fix | After fix |
|--------|------------|-----------|
| Load capture page | OK | OK |
| Save and submit | **500 crash** | **200** — `submitCaptureAction` ~3s |
| Coordinator outcome | Cannot continue | **Still blocked** — API/UI validation: required fields not satisfiable on fallback form |
| Signatures / closeout | Not reached | Not reached |

---

## 8. FINAL VERDICT

### Can a coordinator execute the Vilo OS Operational Spine end-to-end without engineering intervention?

## **NO**

**Operational Spine is NOT CLOSED.**

### Rationale

1. **P0 server-action exports** prevented any submit on the capture path; fixed in code, but that alone does not validate coordinator success.
2. **Post-fix submit** does not complete the source workflow: required fields on the bound fallback template are not coordinator-completable (`completion_status` empty options; readonly required booleans).
3. **Steps 10–15** (signatures, closeout, next action) were not completed in this run due to source gate failure.
4. This session was an **engineering proxy walkthrough**, not a certified blind coordinator observation. A real CRC session is still required after staging binds a **published** source template (not generic dev fallback) for Screening CBC.

### Condition to re-attempt 9B

- Published source-engine template bound to Screening CBC (not `fallback (dev)`)
- Re-run with human CRC (observer silent) on `PHASE9A-PILOT-001` / Screening visit only
- Confirm: check-in → capture → submit → coordinator sign → PI sign → closeout checklist attempt

---

**STOP** — No roadmap expansion per phase charter.
