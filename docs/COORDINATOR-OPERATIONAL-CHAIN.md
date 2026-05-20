# Coordinator Operational Chain

**Status:** Validation-pilot architecture map (not a generalized protocol engine).

**Purpose:** Document the end-to-end path Vilo OS already supports — and what this pilot is meant to prove — by reusing existing infrastructure only.

```
Protocol Definition
  → Visit Runtime
  → Conditional Workflow
  → Safety Escalation
  → Coordinator Execution
  → Longitudinal Subject Timeline
```

This is a **coordinator execution chain**, not a sponsor portal or adjudication pipeline. Each step reads from or writes to existing tables and loaders; nothing here requires new signal schema.

---

## Chain overview

| Step | What it means in Vilo | Primary reuse |
|------|------------------------|---------------|
| 1. Protocol Definition | Study version binds visit definitions, procedure definitions, and published **section-based** source packages | `study_versions`, `visit_definitions`, `procedure_definitions`, `published_source_sections`, publish graph (`docs/PHASE4C-*`, `docs/DYNAMIC-SOURCE-ARCHITECTURE.md`) |
| 2. Visit Runtime | A scheduled visit executes procedures under protocol + source version | `visits`, `procedure_executions`, `source_response_sets`, `lib/visit-runtime/*` |
| 3. Conditional Workflow | Open actions appear when capture, validation, or closeout state requires follow-up | `subject_workflow_actions`, `lib/subject/workflow/*`, operational events |
| 4. Safety Escalation | Safety-related operational items surface for coordinator review | `lib/subject/safety-signals/*`, validation findings, `lib/operations/*` |
| 5. Coordinator Execution | Coordinator resolves capture, signatures, queries, and workflow rows | Source capture UI, visit workspace, workflow resolve actions |
| 6. Longitudinal Subject Timeline | Subject-level chronology ties visits, health, signals, and clinical context | `buildVisitHealthTimeline`, visits grid, clinical profile / clinical intelligence |

**Pilot question:** Can a coordinator move from protocol-bound visit execution through conditional tasks and safety escalation to closure, with a coherent subject-level timeline — without duplicate signal noise?

Signal density rules (`docs/SIGNAL-DENSITY-RULES.md`) apply at steps 4–6.

---

## 1. Protocol Definition

**Not built in Subject Workspace.** Protocol structure is established upstream when a study version is published:

- Visit schedule and labels → `visit_definitions` (linked to `study_versions`)
- Procedures per visit → `procedure_definitions` + `procedure_executions` at runtime
- eSource instrument → published source definition / response-set manifest (`docs/PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md`)

**Pilot validation:** Staging subject `SUBJ-P2VAL-001` on Phase 2 validation study inherits visit day labels and procedure templates from this graph. Visit runtime never re-derives protocol; it consumes bound definitions.

**Out of scope:** Generalized protocol editing, sponsor amendments, or cross-study rule engines.

---

## 2. Visit Runtime

Visit runtime is the **execution shell** for one visit:

| Concern | Location |
|---------|----------|
| Visit grid + status derivation | `lib/subject/visits/load-subject-visits.ts`, `derive-status.ts` |
| Per-visit workspace UI | `app/(ops)/visits/[visitId]`, `components/subjects/visits/VisitRuntimeShell.tsx` |
| Procedure validation | `lib/visit-runtime/validateProcedure.ts`, `validateVisitProcedures.ts` |
| Source capture | `app/(ops)/source/capture/[procedureExecutionId]` |
| Response sets + findings | `source_response_sets`, `source_response_validation_findings` |
| Operational chronology (append-only) | `lib/operations/logOperationalEvent.ts`, `OPERATIONAL_EVENT_TYPES` |

**State that drives downstream steps:**

- `procedure_executions.validation_status` — `blocked` / `incomplete` / clean
- `visits` operational fields — status, window, source status, review status
- Findings on response sets — open / acknowledged / resolved

**Pilot validation:** Incomplete CBC validation on many visits originates here (same procedure label, many `procedure_executions` rows).

---

## 3. Conditional Workflow

Workflow is **conditional on runtime state**, not a separate protocol interpreter:

- Rows in `subject_workflow_actions` (queries, corrections, follow-ups, signature requests)
- Loaded via `loadSubjectWorkflowActions` → `lib/subject/workflow/data.ts`
- Deep links back to capture, response set, or visit (`deepLink` builder in workflow data)
- Visit/procedure context filters: `filterWorkflowActionsForContext`

**Escalation grouping (coordinator queue):**

- `buildSubjectWorkflowEscalation` — critical/overdue, due soon, pending signatures, other open
- Merges workflow actions + operational intelligence (signatures, validation issues)
- Signal density: `lib/subject/signal-density/collapse-workflow-escalation.ts`

**UI:** Subject Workspace `?tab=workflow` — `SubjectWorkflowPanel`, inline resolve where `workflowActionId` is present.

**Pilot validation:** Open workflow rows appear when validation blocks progress or signature/closeout is pending; coordinator can resolve or follow evidence links without leaving the chain.

---

## 4. Safety Escalation

Safety escalation is an **operational overlay**, not a formal AE registry:

| Input | Handler |
|-------|---------|
| Procedure validation (blocked/incomplete) | `loadSubjectSafetySignals` |
| Open safety-related validation findings | Same loader (`source_response_validation_findings`) |
| Safety-titled workflow actions | `loadSubjectWorkflowActions` + keyword filters |
| Safety-related operational events | `loadOperationalChronology` + `OPERATIONAL_EVENT_TYPES` |
| Documented allergies (clinical profile) | `subject_allergies` via clinical profile read path |

**UI:** `?tab=ae` — `SubjectSafetySurface`, snapshot chips + chronology.

**Rules:**

- Deduped by operational meaning (`collapseSafetySignals`)
- Resolved findings excluded from active list and open counts
- Chips from full deduped set; list severity-sorted and capped (`docs/SIGNAL-DENSITY-RULES.md`)

**Pilot validation:** `SUBJ-P2VAL-001` — 22 identical CBC incomplete rows collapse to 1 grouped signal; **Open** chip matches unresolved active timeline rows.

**Out of scope:** Structured AE case reporting, MedDRA coding, sponsor safety workflows.

---

## 5. Coordinator Execution

Where the coordinator **acts** on escalated state:

| Action | Surface |
|--------|---------|
| Complete / correct source | `/source/capture/[procedureExecutionId]` |
| Review response set + findings | `/source/response-set/[id]` |
| Sign visit closeout | Visit workspace — coordinator / investigator signature cards |
| Resolve workflow item | `resolveSubjectWorkflowAction` on `?tab=workflow` |
| Operational command center | `?tab=general` — `SubjectOperationalCommandCenter` (upcoming visits, pending actions, grouped signatures/validation) |

**Regulatory framing (parallel, not duplicate of safety):**

- `?tab=deviations` — `loadSubjectRegulatorySignals` (protocol execution / compliance risk signals)
- Same underlying intelligence; different coordinator question: “protocol/compliance risk” vs “safety/AE operational items”

**Pilot validation:** Grouped signals preserve a primary drilldown `href`; overflow routes to workflow tab (General) or visits grid (AE / Deviations / Workflow) per signal-density rules.

---

## 6. Longitudinal Subject Timeline

Subject-level **longitudinal** views aggregate visit runtime outcomes over time:

| Surface | Data |
|---------|------|
| Visit chronology (General + visits route) | `buildVisitHealthTimeline` — per-visit status, windows, blocked counts, capture/review hrefs |
| Visits grid | `/studies/{studyId}/subjects/{subjectId}/visits` — calendar, table, summary |
| Clinical profile | `loadSubjectClinicalProfile` — allergies, MH, conmeds, surgical history |
| Clinical intelligence (derived) | `buildLongitudinalClinicalProfile` — timeline, risk flags, medication windows (pure transform on profile) |
| Operational events | `loadOperationalChronology` — append-only study/subject/visit history |
| Safety / regulatory chronologies | Deduped signal timelines on `?tab=ae` and `?tab=deviations` |

**Design note:** Visit chronology intentionally remains **per-visit** (e.g. 22 rows for 22 visits). Signal density collapses **repeated operational issues**, not the visit index itself.

**Pilot validation:** Coordinator can scan subject health on General, drill into a visit, execute capture/workflow, and return to a timeline that reflects updated validation and signature state.

---

## Staging proof subject

| Field | Value |
|-------|--------|
| Subject | `SUBJ-P2VAL-001` (`3bae1645-b94b-441c-b081-916a03896b0e`) |
| Study | `6bae715a-8536-4000-8d24-22b6a3dbb8c9` |
| Visits | 22 |

**Counts after signal density:** see `node scripts/signal-density-staging-counts.mjs` and `docs/SIGNAL-DENSITY-RULES.md`.

---

## What this pilot does not prove

- Generalized conditional logic engine across all protocol types
- Sponsor / CRA review portals
- Formal protocol deviation or AE adjudication registries
- VPI portfolio scoring changes
- Broad framework rewrites

---

## Related docs

| Doc | Focus |
|-----|--------|
| `docs/DYNAMIC-SOURCE-ARCHITECTURE.md` | Section-based eSource requirements |
| `docs/PHASE9A-GENERIC-PHASE3-PILOT-RUNBOOK.md` | Executable generic Phase 3 validation checklist (Phase 9A) |
| `docs/SIGNAL-DENSITY-RULES.md` | Coordinator signal dedupe, caps, chip alignment |
| `docs/PHASE8-CLOSURE.md` | Subject Workspace tabs and smoke validation |
| `docs/PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md` | Protocol → source definition |
| `docs/PHASE4B-ESOURCE-RUNTIME-SCHEMA.md` | eSource runtime model |
| `docs/PHASE7E-COMMAND-CENTER-MINIMAL.md` | Portfolio command center (separate from subject chain) |
