# Phase 8 — Subject Workspace Closure

**Status:** Technically smoke-validated in staging (authenticated HTTP smoke, 2026-05-18).

**Scope:** Coordinator-first Subject Workspace at study-scoped routes. No VPI changes. No new DB tables for Phase 8 overlays. No `/visits/[visitId]` migration.

---

## Summary

Phase 8 consolidates the subject chart into a single study-scoped workspace with horizontal navigation, longitudinal visit chronology, dedicated clinical/operational tabs, and coordinator overlays for safety signals, regulatory risk, and workflow escalation. All surfaces reuse existing loaders and operational intelligence; they do not invent formal AE or protocol deviation adjudication records.

**Operational chain (validation pilot):** See `docs/COORDINATOR-OPERATIONAL-CHAIN.md` — Protocol Definition → Visit Runtime → Conditional Workflow → Safety Escalation → Coordinator Execution → Longitudinal Subject Timeline.

**Phase 9A executable runbook:** `docs/PHASE9A-GENERIC-PHASE3-PILOT-RUNBOOK.md` (generic Phase 3 pilot slice).

**Smoke verdict:** Phase 8 is **technically smoke-validated**. There are **no remaining P0/P1 blockers** for Subject Workspace route rendering after the Topbar fix documented below.

---

## Completed phases

| Phase | Focus | What shipped |
|-------|--------|----------------|
| **8A** | Workspace consolidation | Single subject page at `/studies/{studyId}/subjects/{subjectId}` with `?tab=*`; legacy `/subjects/{subjectId}/clinical-profile` redirects to `?tab=clinical-profile`; `SubjectChartHeader` + `SubjectChartNav`; canonical paths in `lib/ops/paths.ts` (re-exported via `lib/subject/chart-paths.ts`); visits tab redirects to dedicated visits route |
| **8B3** | Visit chronology | `/studies/{studyId}/subjects/{subjectId}/visits` — summary chips, `SubjectVisitHealthTimeline`, calendar, `VisitsTable`; enhanced `buildVisitHealthTimeline` with capture/review hrefs |
| **8B2** | ConMeds | `?tab=conmeds` — dedicated `SubjectConMedsSurface` reusing `loadSubjectClinicalProfile`; ConMeds promo on Clinical Profile tab |
| **8B1** | Safety / AE signals | `?tab=ae` — operational safety overlay (`loadSubjectSafetySignals`); labeled “Safety / AE Signals”; no structured AE registry |
| **8C1** | Regulatory / deviation signals | `?tab=deviations` — `loadSubjectRegulatorySignals` from operational intelligence; labeled “Regulatory / Deviation Signals”; `hasFormalDeviationRecords: false` |
| **8C2** | Workflow escalation | `?tab=workflow` — escalation snapshot chips + grouped list (`buildSubjectWorkflowEscalation`); “who needs to do what next” vs regulatory tab framing |

---

## Phase 8A — Workspace consolidation

**Routes**

- Canonical: `/studies/{studyId}/subjects/{subjectId}?tab={tab}`
- Study wrapper re-exports: `app/(ops)/studies/[studyId]/subjects/[subjectId]/page.tsx` → shared subject page
- Legacy: `/subjects/{subjectId}` (study from subject row when not in URL)

**Tabs (first-level, `lib/subject/chart-tabs.ts`)**

| Tab key | Behavior |
|---------|----------|
| `general` | Operational command center + general subject form |
| `visits` | Server redirect → `/studies/.../visits` |
| `clinical-profile` | Inline clinical profile (sub-tabs) |
| `conmeds` | Dedicated ConMeds surface |
| `workflow` | Workflow escalation (8C2) |
| `ae` | Safety signals (8B1) |
| `deviations` | Regulatory signals (8C1) |
| `notes` | Placeholder — intentional |
| `documents` | Placeholder — intentional |

**Paths:** `lib/ops/paths.ts` — `subjectChartTabPath`, `subjectVisitsPath`, `subjectClinicalProfilePath`, `subjectConMedsTabPath`, `subjectAeTabPath`, `subjectDeviationsTabPath`, etc.

---

## Phase 8B3 — Visit chronology

**Route:** `/studies/{studyId}/subjects/{subjectId}/visits`

**Data:** `loadSubjectVisitsPage`, `loadSubjectOperationalIntelligence`, `loadSubjectWorkflowActions` → `buildVisitHealthTimeline`

**UI:** `SubjectVisitChronologySummary`, `SubjectVisitHealthTimeline`, `SubjectVisitCalendar`, `VisitsTable` (empty state explains schedule generation)

**Shell:** Same `SubjectChartHeader` + `SubjectChartNav` (`activeTab="visits"`)

---

## Phase 8B2 — ConMeds

**Route:** `?tab=conmeds`

**Data:** `loadSubjectClinicalProfile` (tab-gated load on subject page)

**UI:** `SubjectConMedsSurface`, `SubjectConMedsSummary`; Clinical Profile tab retains `ClinicalProfileConMedsPromo` linking to ConMeds tab

---

## Phase 8B1 — Safety / AE signals

**Route:** `?tab=ae`

**Data:** `lib/subject/safety-signals/` — aggregates validation findings, safety-related workflow, operational events, allergy records (labeled honestly, not formal AE cases)

**UI:** `SubjectSafetySurface`, `SubjectSafetySignalsSummary`, `SubjectSafetyTimeline`

**Constraint:** No structured AE table in schema; UI states this explicitly in empty states.

---

## Phase 8C1 — Regulatory / deviation signals

**Route:** `?tab=deviations`

**Data:** `loadSubjectRegulatorySignals` → `loadSubjectWorkflowActions` + `loadSubjectOperationalIntelligence` → `buildRegulatorySignalsFromOperationalIntelligence`

**Signal types (operational, not adjudicated deviations):** missed visits, out-of-window visits, blocked/incomplete procedures, validation findings, pending source review, overdue workflow, pending signatures

**UI:** `SubjectRegulatorySurface`, `SubjectRegulatorySignalsSummary`, `SubjectRegulatoryTimeline`

**Separation from 8C2:** Deviations tab = *what regulatory risk exists*; Workflow tab = *who needs to do what next*.

---

## Phase 8C2 — Workflow escalation

**Route:** `?tab=workflow`

**Data:** `buildSubjectWorkflowEscalation` from `subject_workflow_actions` + operational intelligence (`pendingSignatures`, `validationIssues`, visit labels from `visitTimeline`)

**UI:** `SubjectWorkflowEscalationSummary`, `SubjectWorkflowEscalationGroupedList` (Critical/overdue → Due soon → Pending signatures → Other open), `SubjectWorkflowCreateForm`, recently resolved sidebar

**Workflow row actions:** Resolve inline where `workflowActionId` is present; evidence links use existing `deepLink` / capture hrefs

---

## Topbar smoke blocker fix

**Problem:** All authenticated ops routes returned HTTP 500. `components/shell/topbar.tsx` was a Server Component passing `onMouseOver` / `onMouseOut` to a `<button>`.

**Fix (2026-05-18):** Replaced inline handlers with Tailwind hover classes (`hover:bg-[#f0eeec]`). No client boundary added; no layout changes.

**File changed:** `components/shell/topbar.tsx` only.

---

## Validation results

### Static / build

```bash
npx tsc --noEmit   # PASS
npm run build      # PASS
```

### Authenticated smoke (staging)

**User:** `synthetic.staff.a@vilo-os.staging`  
**Fixture subject:** `SUBJ-P2VAL-001` (`study_id` `6bae715a-8536-4000-8d24-22b6a3dbb8c9`, `study_subject_id` `3bae1645-b94b-441c-b081-916a03896b0e`)  
**Method:** Production `next start` + cookie auth; expect key UI strings in HTML; no 500 / login redirect / error page

| # | Route | HTTP | Result |
|---|--------|------|--------|
| 1 | `/performance` | 200 | PASS |
| 2 | `/performance/today` | 200 | PASS |
| 3 | `/performance/risks` | 200 | PASS |
| 4 | `/studies/{studyId}/subjects/{subjectId}` | 200 | PASS |
| 5 | `?tab=visits` | 307 → 200 | PASS → `/visits` |
| 6 | `/studies/.../subjects/.../visits` | 200 | PASS |
| 7 | `?tab=clinical-profile` | 200 | PASS |
| 8 | `?tab=conmeds` | 200 | PASS |
| 9 | `?tab=ae` | 200 | PASS |
| 10 | `?tab=deviations` | 200 | PASS |
| 11 | `?tab=workflow` | 200 | PASS |
| 12 | `/subjects/{subjectId}/clinical-profile` | 307 → 200 | PASS → `?tab=clinical-profile` |

**Total: 12/12 PASS**

VPI RPC validation (unchanged by Phase 8): `npm run db:validate-phase7a-staging-snapshot` — 9/9 PASS on same staging window.

---

## Explicit non-goals (Phase 8)

| Item | Status |
|------|--------|
| VPI / performance read model changes | **Not included** |
| New DB tables for deviations, AE, or escalation | **Not included** |
| Formal protocol deviation adjudication | **Not included** (signals only) |
| Sponsor/CRA workflow | **Not included** |
| Notes / Documents tabs | **Intentionally placeholder** (“Coming soon”) |
| `/visits/[visitId]` route normalization | **Deferred — future Phase 8D** |
| Admin/staff access patterns | **Parked** |
| OpsHeader | **Not implemented** (out of scope) |

---

## Known limitations (P2+, not blocking closure)

| Item | Notes |
|------|--------|
| Visit links in grid | Still deep-link to `/visits/{visitId}` (legacy visit workspace) |
| Assigned user display | `assigned_user_id` mapped; display name join not wired |
| Overlap workflow vs deviations | Same validation rows may appear on both tabs with different framing |
| Workflow title in HTML | Rendered as `Workflow &amp; escalation` (entity encoding) |
| Click-through smoke | Visit/source/review links not exercised in automated smoke |
| Operational intelligence load | Loaded for all study-scoped subject pages (header), not tab-only |

---

## Deferred — Phase 8D (future)

| Item | Intent |
|------|--------|
| `/visits/[visitId]` normalization | Align visit workspace with study-scoped subject routes and shared shell |
| Notes / Documents | Coordinator documentation surfaces when product scope opens |
| Admin/staff access | Role-based workspace entry when parked access model is defined |

---

## Re-run smoke (optional)

```bash
npm run build
# Start production server (ensure port free)
PORT=3001 npm run start

# Authenticated checks: sign in as synthetic.staff.a@vilo-os.staging
# Walk routes in table above, or use internal smoke script pattern from Phase 8 QA session
```

Discover staging IDs:

```bash
node scripts/discover-e2e-staging-ids.mjs
```

---

## Closure statement

Phase 8 delivers a **coordinator-first Subject Workspace** with consolidated navigation, visit chronology, clinical/ConMeds surfaces, and operational overlays for safety, regulatory signals, and workflow escalation—**without** VPI changes, new adjudication schema, or visit-route migration.

**Phase 8 is technically smoke-validated.** **No P0/P1 blockers remain** for Subject Workspace route rendering. Remaining work is intentional placeholder (Notes/Documents), future normalization (8D), and non-blocking UX polish.
