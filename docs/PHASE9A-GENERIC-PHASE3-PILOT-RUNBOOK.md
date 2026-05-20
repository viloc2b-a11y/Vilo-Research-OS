# Phase 9A — Generic Phase 3 Validation Pilot Runbook

**Protocol:** `GENERIC_PHASE3_OA` (pilot slice only)  
**Status:** Executable validation checklist  
**Type:** Validation pilot — **not** a generalized protocol engine

**Related architecture:**

- `docs/DYNAMIC-SOURCE-ARCHITECTURE.md` — **hard requirement:** section-based source (not static forms)
- `docs/COORDINATOR-OPERATIONAL-CHAIN.md` — mapped operational chain
- `docs/SIGNAL-DENSITY-RULES.md` — coordinator signal dedupe and caps
- `docs/PHASE8-CLOSURE.md` — Subject Workspace surfaces

---

## 1. Objective

Validate the **Coordinator Operational Chain** end-to-end on a minimal GENERIC_PHASE3_OA template.

### 1.1 Operational chain

```
Protocol Definition
  → Visit Runtime
  → Conditional Workflow
  → Safety Escalation
  → Coordinator Execution
  → Longitudinal Subject Timeline
```

### 1.2 Dynamic source chain (hard requirement)

Phase 9A **must** respect section-based eSource architecture. Source is **not** a static form.

```
Source Package
  → Dynamic Sections
  → Configurable Fields
  → Runtime Capture
  → Validation
  → Signatures
  → Audit Trail
```

Full rules: **`docs/DYNAMIC-SOURCE-ARCHITECTURE.md`**.  
Rule engine (Phase 1): **`lib/source-engine/`** — see `docs/SOURCE-ENGINE-PHASE1.md`.

| Rule | Pilot expectation |
|------|-------------------|
| Structured procedures | Vital Signs and labs use **typed fields**, not a single note field |
| Sections at publish | Pilot package published with `source_sections[]` + fields (CPST/compiler path acceptable) |
| Runtime provenance | Capture shows who/when; submit runs validation; corrections path exists |
| Signatures | Coordinator + PI visit closeout on at least one pilot visit |
| No universal builder | Section add/remove/reorder UI in Source Builder is **not** required for 9A pass |

**Anti-pattern (fail):** Vital Signs implemented as one free-text note on the pilot package.

**Pilot passes when** a synthetic coordinator can:

1. Load the pilot study version and four visit templates.
2. Load a **published GENERIC_PHASE3_9A source package** with section-backed structured fields (see §4, §7).
3. Execute procedures in Visit Workspace with working **structured** source capture (not note-only forms).
4. Trigger conditional workflow from abnormal cortisol and platelet/HIT scenarios.
5. See safety and operational signals on Subject Workspace (with signal density applied).
6. Act on escalations (capture, workflow resolve, signatures).
7. Observe longitudinal timeline updates and audit-relevant capture metadata after each action.

**Pilot fails if** any acceptance criterion in §7 is unmet or build/typecheck fails.

---

## 2. Reused infrastructure

No new adjudication schema. Each chain step uses existing tables, loaders, and UI.

### Step 1 — Protocol Definition

| Asset | Table / artifact | Loader / module | UI (if any) |
|-------|------------------|-----------------|-------------|
| Study version | `study_versions` | Study / version publish flow | Source builder, study admin |
| Visit templates | `visit_definitions` | Bound to `study_version_id` | — |
| Procedure templates | `procedure_definitions` | `visit_def_procedure_map` (or equivalent binding) | Procedure profile library (`fixtures/source-builder/procedure-profile-library.v1.json`) |
| Published eSource | `source_definitions`, `source_definition_versions` | Phase 4C publish graph | Source builder |
| Published sections | `published_source_sections` | `publish_source_package` ← `source_sections[]` | — |
| Published fields + rules | `published_source_fields`, `published_source_validation_rules` | Compiler output | — |
| Signature requirements (manifest) | `signature_requirements` in compiler output | Publish RPC | Visit closeout (runtime) |

**Docs:** `docs/DYNAMIC-SOURCE-ARCHITECTURE.md`, `docs/PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md`, `docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md`

### Step 2 — Visit Runtime

| Asset | Table / artifact | Loader / module | UI |
|-------|------------------|-----------------|-----|
| Subject visits | `visits` | `loadSubjectVisitsPage` | Visits grid, visit calendar |
| Procedure instances | `procedure_executions` | Visit load + scheduling | Visit Workspace |
| Capture sessions | `source_response_sets` | `load-capture-shell.ts` | `/source/capture/[procedureExecutionId]` |
| Field values + provenance | `source_responses` | Save/submit RPCs | `CaptureForm`, `CaptureField` |
| Corrections / addenda | `source_response_corrections`, addendum RPC | Read-contract | Response-set review panel |
| Validation state | `procedure_executions.validation_status`, `source_response_validation_findings` | `validateProcedure.ts` | Capture + visit runtime |
| Visit workspace shell | — | `lib/subject/visit-runtime/data.ts` | `app/(ops)/visits/[visitId]`, `VisitRuntimeShell.tsx` |

### Step 3 — Conditional Workflow

| Asset | Table / artifact | Loader / module | UI |
|-------|------------------|-----------------|-----|
| Workflow actions | `subject_workflow_actions` | `loadSubjectWorkflowActions` | `?tab=workflow` |
| Escalation model | — | `buildSubjectWorkflowEscalation` | `SubjectWorkflowPanel`, `SubjectWorkflowEscalationList` |
| Operational triggers | `operational_events` | `logOperationalEvent`, `loadOperationalChronology` | Visit closeout timeline, safety chronology |

**Conditional triggers for this pilot** are implemented as **workflow rows + validation/findings**, not a standalone rules engine. Cortisol and platelet paths must create identifiable `subject_workflow_actions` (or equivalent open actions) when pilot capture data is entered.

### Step 4 — Safety Escalation

| Asset | Table / artifact | Loader / module | UI |
|-------|------------------|-----------------|-----|
| Safety signals | Findings, procedure validation, workflow, events, allergies | `loadSubjectSafetySignals` | `?tab=ae` — `SubjectSafetySurface` |
| Keywords / filters | — | `lib/subject/safety-signals/keywords.ts` | — |
| Summary chips | — | `summarizeSafetySignals` | `SubjectSafetySignalsSummary` |

### Step 5 — Coordinator Execution

| Asset | Table / artifact | Loader / module | UI |
|-------|------------------|-----------------|-----|
| Command center | Aggregated intelligence | `loadSubjectOperationalIntelligence` | `?tab=general` — `SubjectOperationalCommandCenter` |
| Regulatory signals | — | `loadSubjectRegulatorySignals`, `buildRegulatorySignalsFromOperationalIntelligence` | `?tab=deviations` |
| Workflow resolve | — | `resolveSubjectWorkflowAction` | Inline on workflow tab |
| Signatures | Visit review status | `getPendingSignatures` | Visit workspace, command center |
| Source capture | — | `lib/source/capture/*` | Capture routes |

### Step 6 — Longitudinal Subject Timeline

| Asset | Table / artifact | Loader / module | UI |
|-------|------------------|-----------------|-----|
| Visit health timeline | — | `buildVisitHealthTimeline` | General tab, `/studies/.../visits` |
| Clinical profile | Profile tables | `loadSubjectClinicalProfile` | `?tab=clinical-profile` |
| Clinical intelligence | In-memory transform | `buildLongitudinalClinicalProfile` | Clinical intelligence panels |
| Chronology | `operational_events` | `loadOperationalChronology` | Safety / closeout surfaces |

### Signal density layer (cross-cutting)

| Concern | Module |
|---------|--------|
| Dedupe / collapse | `lib/subject/signal-density/collapse-*.ts` |
| Visible caps | `lib/subject/signal-density/limits.ts`, `cap.ts` |
| Overflow UI | `components/subject/signal-density/SignalListOverflow.tsx` |

Applied in: `loadSubjectOperationalIntelligence`, `loadSubjectSafetySignals`, regulatory build, workflow escalation build, command center cards.

**Staging recount:** `node scripts/signal-density-staging-counts.mjs`

---

## 3. Pilot template scope

Include **only** these visits (all others out of scope for 9A):

| Visit | Schedule window (protocol intent) | Pilot role |
|-------|-----------------------------------|------------|
| **Screening Visit** | Day -45 to -1 | Consent, baseline history, eligibility-oriented capture |
| **Day 1 Visit** | Day 1 | Baseline execution, IP, initial safety/labs |
| **Day 39 Visit** | Day 39 | On-treatment labs, cortisol/ACTH trigger window |
| **Day 56 Follow-up Visit** | Day 56 | Follow-up labs, platelet/HIT monitoring window |

**Checklist — template load**

- [ ] Study version for GENERIC_PHASE3_OA pilot exists and is `published` (or staging equivalent).
- [ ] Exactly **four** `visit_definitions` match the table above (labels/codes documented in pilot seed).
- [ ] Each visit has procedure bindings for §4 minimal set (subset per visit is acceptable if documented).
- [ ] Instantiating a pilot subject creates **four** `visits` rows (one per template).

---

## 4. Minimal procedure set

Procedures required in the pilot template (bind to visits per GENERIC_PHASE3_OA pilot seed; not every procedure on every visit).

| Procedure | Profile / intent (reference) | Typical visits |
|-----------|------------------------------|----------------|
| Informed Consent | `PROC_INFORMED_CONSENT` or equivalent | Screening |
| Medical History | `PROC_MEDICAL_HISTORY` | Screening, Day 1 |
| ConMeds Review | ConMeds / `PROC_CONMEDS` | Screening, Day 1, follow-up |
| Vital Signs | Vitals profiles | All |
| Hematology | Lab sample / result capture | Day 1, Day 39, Day 56 |
| Clinical Chemistry | Lab sample / result capture | Day 1, Day 39, Day 56 |
| Morning Cortisol / ACTH labs | Cortisol-related lab capture | Day 39 (trigger visit) |
| ACTH Stimulation Test | `PROC_ACTH_STIM_TEST` — symptom/safety triggered | After abnormal cortisol |
| Platelet / HIT Monitoring | `PROC_ANTI_PF4`, platelet count — safety triggered | Day 56 (HIT window) |
| IP Administration | IP / dosing capture | Day 1 |
| AE Assessment | AE / safety assessment capture | Day 1, Day 39, Day 56 |
| eSource Completion / Signature | Closeout / review | Per visit as configured |

### Vital Signs — structured section (required)

Pilot Vital Signs **must** use multiple typed fields (see `docs/DYNAMIC-SOURCE-ARCHITECTURE.md` §2). Minimum for 9A pass:

- `systolic_bp`, `diastolic_bp`, `heart_rate`, `performed_datetime`, `clinically_significant`
- Plus at least **three** of: `temperature`, `respiratory_rate`, `position`, height/weight or unit fields, `comments`

**Fail** if the pilot SDV exposes only a single narrative/note widget for Vital Signs.

**Checklist — procedures in Visit Workspace**

- [ ] Each instantiated visit shows expected procedure rows in Visit Workspace.
- [ ] Each procedure links to source capture when a published source version is bound.
- [ ] `procedure_executions.validation_status` updates after capture/validation run.

---

## 5. Synthetic subject scenarios

Use **dedicated pilot subjects** (do not mix with unrelated staging bulk subjects unless documented). Suggested identifiers:

| Scenario ID | Subject label | Intent |
|-------------|---------------|--------|
| **9A-NORMAL** | `SUBJ-PARA9A-NORMAL-001` | Happy path — clean labs, complete capture, signatures closed |
| **9A-CORTISOL** | `SUBJ-PARA9A-CORTISOL-001` | Abnormal morning cortisol → ACTH stimulation workflow |
| **9A-PLATELET** | `SUBJ-PARA9A-PLATELET-001` | Platelet drop / HIT concern → platelet & anti-PF4 workflow |

### 9A-NORMAL — normal execution path

| Step | Action | Expected state |
|------|--------|----------------|
| 1 | Complete Screening + Day 1 capture for core procedures | `validation_status` clean or acceptable; no blocking findings |
| 2 | Complete Day 39 + Day 56 per schedule | Visits move to completed/in-progress appropriately |
| 3 | Coordinator + investigator signatures where configured | `visit_review_status` advances; no pending signature groups |
| 4 | Open Subject Workspace General | Health `healthy` or `attention` only for scheduling, not 22× duplicate validation |
| 5 | AE / Workflow tabs | Zero or low open escalation; no false **Open: 0** vs populated timeline mismatch |

### 9A-CORTISOL — abnormal cortisol trigger path

| Step | Action | Expected state |
|------|--------|----------------|
| 1 | Enter **abnormal morning cortisol** on Day 39 (pilot-defined threshold in capture or finding) | Validation finding and/or `validation_status` reflects abnormality |
| 2 | Confirm conditional workflow | Open `subject_workflow_actions` row for **ACTH Stimulation Test** (or pilot-labeled equivalent) |
| 3 | Subject Workspace `?tab=workflow` | Escalation in **Critical / overdue** or **Other open** with evidence link to capture |
| 4 | Subject Workspace `?tab=ae` | Safety signal present (finding or safety-titled workflow); **Open** chip matches unresolved rows |
| 5 | Complete ACTH procedure capture | Workflow resolvable; signal clears or moves to resolved when appropriate |
| 6 | Signal density | Multiple visits with same incomplete label still **one grouped row** if duplicated |

### 9A-PLATELET — platelet / HIT risk trigger path

| Step | Action | Expected state |
|------|--------|----------------|
| 1 | Enter **platelet below pilot threshold** on Day 56 (or configured monitoring visit) | Finding or validation flags safety path |
| 2 | Confirm conditional workflow | Open action for **Platelet / HIT Monitoring** (anti-PF4 / serotonin release / platelet monitoring per seed) |
| 3 | Subject Workspace `?tab=ae` and `?tab=deviations` | Safety + regulatory/operational framing both reachable; same underlying issue not duplicated excessively on Deviations (blocked rollup rule) |
| 4 | Coordinator executes monitoring capture | Source capture opens from workflow deep link |
| 5 | Resolve or complete follow-up | Workflow row resolvable; timeline reflects completion |

**Reference procedure profiles (library, not pilot-specific code):** `docs/PHASE6A.3-PROCEDURE-PROFILE-LIBRARY.md` — `PROC_ACTH_STIM_TEST`, `PROC_ANTI_PF4`, `PROC_SEROTONIN_RELEASE_ASSAY`.

---

## 6. Expected coordinator-visible outputs

For each scenario, verify outputs on **Subject Workspace** and **Visit Workspace**.

| Output | Where to verify | Pass indicator |
|--------|-----------------|----------------|
| **Visit timeline** | General → `SubjectVisitHealthTimeline`; `/studies/.../visits` | Four visits listed with correct labels, window/status badges |
| **Procedure status** | Visit Workspace procedure list; grid columns | Status matches capture/validation (not started / draft / blocked / incomplete) |
| **Conditional workflow action** | `?tab=workflow` | Scenario-specific open row with deep link |
| **Safety signal** | `?tab=ae` | Unresolved item for cortisol or platelet path; chips align with timeline |
| **Regulatory / operational signal** | `?tab=deviations` | Visit/procedure compliance signal when source or window at risk (optional on NORMAL) |
| **Source capture requirement** | Capture route from visit or workflow | Structured field list loads; save/submit updates response set |
| **Structured vitals** | Day 1 (or screening) Vital Signs capture | Multiple numeric/coded fields visible — not one note |
| **Validation finding** | Capture or response-set review | Finding appears when pilot rule violated (cortisol/platelet scenarios) |
| **Audit metadata** | Response-set review / history | Actor + timestamp on captured values; correction path demonstrable |
| **Signature / review requirement** | Visit Workspace closeout; General signatures card | Pending signature grouped by label when multiple visits share same pending action |
| **Signal density grouping** | General, AE, Deviations, Workflow | Repeated CBC/signature rows collapse (see `SUBJ-P2VAL-001`: 22→1, 19→1); `+N more` when over cap |

### Coordinator routes (canonical)

| Surface | Path |
|---------|------|
| Subject Workspace | `/studies/{studyId}/subjects/{subjectId}?tab={general\|ae\|deviations\|workflow\|...}` |
| Visits grid | `/studies/{studyId}/subjects/{subjectId}/visits` |
| Visit Workspace | `/visits/{visitId}` |
| Source capture | `/source/capture/{procedureExecutionId}?organization_id=...` |

Paths: `lib/ops/paths.ts`, `lib/subject/chart-paths.ts`.

---

## 7. Acceptance criteria

The pilot **passes only if all** are true:

### Template & runtime

- [ ] **Template loads** — GENERIC_PHASE3_OA pilot study version and source packages available in target environment.
- [ ] **Published source package** — `published_source_sections` + `published_source_fields` exist for pilot procedures (count documented).
- [ ] **Four visits instantiate** — pilot subject has exactly four visits matching §3.
- [ ] **Procedures appear in Visit Workspace** — §4 minimal set visible per visit binding.
- [ ] **Structured source capture works** — open, save draft, submit for at least one procedure per visit type; **Vital Signs uses structured fields** (§4).
- [ ] **Validation runs on submit** — `validation_status` and/or findings update after pilot abnormal entry.
- [ ] **Audit trail demonstrable** — at least one field shows capture provenance; one correction or operational event traceable.
- [ ] **Visit signatures** — coordinator and PI closeout completed on ≥1 pilot visit.

### Conditional workflow

- [ ] **Abnormal cortisol creates ACTH workflow** — scenario **9A-CORTISOL** produces open ACTH-related `subject_workflow_actions` (or documented equivalent).
- [ ] **Platelet risk creates HIT workflow** — scenario **9A-PLATELET** produces open platelet/HIT monitoring workflow.

### Subject Workspace surfaces

- [ ] **Safety signal appears** — `?tab=ae` shows unresolved safety item for trigger scenarios.
- [ ] **Workflow escalation appears** — `?tab=workflow` shows grouped escalation with evidence link.
- [ ] **Timeline updates longitudinally** — after capture/workflow/signature, `buildVisitHealthTimeline` and visits grid reflect new status on refresh.

### Signal density

- [ ] **Signal density prevents duplicate noise** — per `docs/SIGNAL-DENSITY-RULES.md`: grouped rows, chips from full deduped set, severity sort before cap, resolved findings excluded from open count, visit blocked rollup suppresses duplicate per-procedure blocked rows.

### Engineering gates

- [ ] **`npx tsc --noEmit` passes**
- [ ] **`npm run build` passes**

### Sign-off block

| Role | Name | Date | Pass/Fail |
|------|------|------|-----------|
| Coordinator tester | | | |
| Engineering | | | |

---

## 8. Non-goals

Explicitly **out of scope** for Phase 9A:

| Non-goal | Notes |
|----------|--------|
| Full **GENERIC_PHASE3_OA** protocol | Only four visits and §4 procedure slice |
| Full **eDiary** | No ePRO diary validation in 9A |
| Full **PK substudy** | PK sparse sampling, sparse visits excluded |
| **Sponsor portal** | Ops/coordinator surfaces only |
| **CRA portal** | No monitor review workflow |
| **Generalized protocol parser** | No SOA import engine proof |
| **New adjudication system** | No formal AE or protocol deviation registry |
| **Broad schema rewrite** | No new signal tables; reuse existing model |
| **Universal Source Builder** | No full section editor, all modalities, or drag-and-drop package designer |
| **Capture section accordion UI** | Flat field list acceptable for 9A if fields are structured |
| **Per-field e-sign in capture** | Visit-level coordinator/PI closeout sufficient for 9A |
| **VPI / portfolio command center** | Subject-level pilot only |
| **Visit route migration** | `/visits/[visitId]` remains; not migrating to study-scoped visit URL in 9A |

---

## Execution order (recommended)

1. Run engineering gates (`tsc`, `build`).
2. Publish or verify GENERIC_PHASE3_9A source package (`source_sections[]` + structured fields per `docs/DYNAMIC-SOURCE-ARCHITECTURE.md` §5).
3. Seed or verify GENERIC_PHASE3_OA pilot template in staging (four visits, procedure bindings).
4. Create three synthetic subjects (§5).
5. Execute **9A-NORMAL** completely; record outputs (§6).
6. Execute **9A-CORTISOL** through ACTH workflow closure.
7. Execute **9A-PLATELET** through HIT monitoring closure.
8. Re-run `node scripts/signal-density-staging-counts.mjs` on any subject with multi-visit duplicate validation.
9. Complete sign-off block (§7).

---

## Appendix — Staging reference (Phase 8 density proof)

Subject **`SUBJ-P2VAL-001`** on Phase 2 validation study is **not** the GENERIC_PHASE3_OA pilot subject but demonstrates signal density on a 22-visit matrix:

| Metric | Before | After dedupe |
|--------|--------|----------------|
| CBC incomplete rows | 22 | 1 grouped |
| Coordinator signature rows | 19 | 1 grouped |

Use for regression of signal density only; GENERIC_PHASE3_OA acceptance uses §5 scenario subjects.

---

## Related docs

| Document | Purpose |
|----------|---------|
| `docs/DYNAMIC-SOURCE-ARCHITECTURE.md` | Section-based source requirements + gaps |
| `docs/COORDINATOR-OPERATIONAL-CHAIN.md` | Chain map |
| `docs/SIGNAL-DENSITY-RULES.md` | Dedupe product rules |
| `docs/PHASE8-CLOSURE.md` | Subject Workspace closure |
| `docs/PHASE6A.3-PROCEDURE-PROFILE-LIBRARY.md` | ACTH / HIT procedure profiles |
| `docs/PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md` | Protocol → source |
