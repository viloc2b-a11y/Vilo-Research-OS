# Signal Density Rules

**Status:** Product rule (implemented in Subject Workspace overlays, 2026-05).

**Scope:** Coordinator-facing operational signals on the Subject Workspace — General command center, AE / Safety, Deviations, and Workflow tabs. Not VPI, not sponsor portal, not a generalized protocol engine.

---

## Core principle

**Vilo OS must not show repetitive operational signals as separate rows when they represent the same underlying issue across multiple visits or procedures.**

Signal density exists to reduce coordinator scan fatigue and improve operational readability. It must **support scanability**, not **hide true risk**.

Implementation lives in `lib/subject/signal-density/` and is applied by existing loaders/builders — no new schema, no duplicate signal stores.

---

## Rules

### 1. Deduplicate by operational meaning

Group rows by **what the coordinator must do**, not by raw database row identity.

| Signal family | Group key (conceptual) | Example |
|---------------|------------------------|---------|
| Procedure validation (AE) | procedure label + blocked/incomplete status | All `CBC — incomplete validation` across visits → one row |
| Validation issues (General / Workflow) | `kind` + label | `incomplete` + `CBC — incomplete` → one row |
| Pending signatures | `kind` + label | All `Coordinator progress note signature pending` → one row |
| Regulatory incomplete / blocked / findings / signatures | `signalType` + title | Same title across visits → one row |
| Workflow escalation | `kind` + title | Same signature or validation title → one row |

**Do not** dedupe unrelated issues that merely share a visit or procedure type but require different actions.

**Preserve drilldown:** grouped rows keep a primary `href` (first matching capture, visit, or workflow link). Overflow links route to the correct workspace (see §4).

---

### 2. Summary chips reflect the full deduped set (before UI caps)

Snapshot chips (`Open`, `High severity`, regulatory counts, workflow escalation summary) are computed from the **complete deduped list**, then the UI renders a **capped subset** of rows.

| Layer | Source |
|-------|--------|
| Chips / summary | Full deduped set |
| Timeline / cards / escalation sections | Severity-sorted, then capped |

Caps are defined in `lib/subject/signal-density/limits.ts`:

| Surface | Constant | Max visible |
|---------|----------|-------------|
| General — validation issues | `COMMAND_CENTER_VALIDATION_VISIBLE` | 8 |
| General — pending signatures | `COMMAND_CENTER_SIGNATURES_VISIBLE` | 5 |
| AE / Deviations chronology | `OVERLAY_SIGNAL_LIST_VISIBLE` | 12 |
| Workflow — per group | `WORKFLOW_GROUP_VISIBLE` | 10 |

When `hiddenCount > 0`, show `+N more` with a deep link (see §4).

---

### 3. Lists are severity-sorted before capping

After deduplication, sort by operational urgency (severity rank, then recency / unresolved-first where applicable), then apply `applyVisibleCap`.

Highest-severity unresolved items must appear in the visible window; lower-priority rows move to overflow.

---

### 4. Overflow routes to the correct workspace

`+N more` must not dead-end. Routing by surface:

| Surface | Overflow destination | Rationale |
|---------|----------------------|-----------|
| General — validation / signatures | `?tab=workflow` (`subjectChartTabPath`) | Escalation queue for coordinator actions |
| AE / Deviations chronology | Visits grid (`subjectVisitsPath`) | Visit-level context for repeated procedure/signature issues |
| Workflow escalation groups | Visits grid (`subjectVisitsPath`) | Per-visit evidence and capture entry points |

Paths are canonical via `lib/subject/chart-paths.ts` / `lib/ops/paths.ts`.

---

### 5. Resolved findings do not inflate active / open counts

**Safety / AE tab**

- Resolved source validation findings are **excluded** from the active safety signal list (`collapseSafetySignals`).
- `openUnresolved` counts only items with `isUnresolved: true` on that deduped set.
- `seriousHigh` counts only **unresolved** items with `error` or `high` severity.

Do not show resolved findings in the timeline while reporting **Open: 0** — that contradicts coordinator trust in the snapshot.

---

### 6. Visit-level rollups prevent duplicate blocked rows

On the Deviations tab, when a visit already has a **blocked procedure rollup** (`blocked-{visitId}` from `blockedProcedureCount > 0`), **skip** per-procedure `blocked` validation issues for that visit.

The visit-level row describes the same underlying issue; per-procedure blocked rows would duplicate it.

Incomplete procedures are still grouped across visits by title (§1); incomplete rows are not suppressed by visit rollups in the same way.

---

### 7. Signal density must not hide true risk

Acceptable:

- Collapsing 22 identical CBC incomplete rows into 1 grouped signal with visit count.
- Capping visible lists with `+N more` when the deduped set is still large.
- Visit chronology on General still listing all visits (visit grid is the longitudinal index).

Not acceptable:

- Dropping unresolved issues silently (no chip count, no overflow).
- Merging different actionable issues into one row (e.g. blocked vs incomplete, coordinator vs investigator signature).
- Using caps to make a subject look healthy when summary chips show open risk.

**Test:** If summary chips show open or high-severity counts, the coordinator must be able to reach those issues via visible rows or explicit overflow.

---

## Staging reference: `SUBJ-P2VAL-001`

**IDs (Synthetic Site Alpha, Phase 2 validation study)**

| Field | Value |
|-------|--------|
| Study | `6bae715a-8536-4000-8d24-22b6a3dbb8c9` |
| Subject | `3bae1645-b94b-441c-b081-916a03896b0e` |
| Visits on subject | 22 |

Recount helper: `node scripts/signal-density-staging-counts.mjs`

### Example 1 — CBC incomplete (22 → 1)

**Before:** 22 separate procedure validation rows (one per visit with `validation_status = incomplete` for the same procedure label).

**After:** 1 grouped signal, e.g.:

- Title: `CBC — incomplete validation`
- Context: `22 visits` in description / visit name field
- Drilldown: primary capture / visit href from the lead row

### Example 2 — Coordinator signatures (19 → 1)

**Before:** 19 rows of `Coordinator progress note signature pending` (one per in-flight visit in `draft` / `reopened` review).

**After:** 1 grouped signature row:

- Label unchanged: `Coordinator progress note signature pending`
- Subtitle: `19 visits` (or current count)
- General tab shows 1 row; overflow only if multiple *distinct* signature kinds remain after dedupe

### Example 3 — AE open chip aligns with active timeline

**Before (bug):** Timeline showed many rows (including resolved safety-related findings or duplicate procedure rows) while **Open: 0** because `isUnresolved` was false on resolved findings.

**After (rule):**

- Timeline lists **unresolved** active signals on the deduped set (plus capped display).
- **Open** chip = count of `isUnresolved` on the same deduped set used for chips.
- **High severity** chip = unresolved items with `error` or `high` severity only.

If the deduped unresolved set has 1 open CBC group, both the chip and the timeline agree.

---

## Code map

| Concern | Module |
|---------|--------|
| Caps | `lib/subject/signal-density/limits.ts`, `cap.ts` |
| Safety / AE dedupe + sort | `collapse-safety-signals.ts` → `load-subject-safety-signals.ts` |
| Safety summary | `lib/subject/safety-signals/summarize.ts` |
| Validation / signatures (operations) | `collapse-validation-issues.ts`, `collapse-signatures.ts` → `loadSubjectOperationalIntelligence.ts` |
| Regulatory build + rollup skip | `build-from-operational-intelligence.ts`, `collapse-regulatory-signals.ts` |
| Workflow escalation | `collapse-workflow-escalation.ts` → `build.ts` |
| Overflow UI | `components/subject/signal-density/SignalListOverflow.tsx` |

---

## Non-goals

- No new signal tables or adjudication registries.
- No VPI / portfolio scoring changes.
- No sponsor-facing summaries.
- No generalized protocol rule engine — density rules are operational UX on top of existing visit runtime, procedure execution, source response, workflow, and operational event infrastructure.

---

## Related docs

- `docs/PHASE9A-GENERIC-PHASE3-PILOT-RUNBOOK.md` — Phase 9A executable pilot checklist (generic Phase 3)
- `docs/COORDINATOR-OPERATIONAL-CHAIN.md` — Protocol → visit runtime → workflow → safety → execution → timeline
- `docs/PHASE8-CLOSURE.md` — Subject Workspace tabs and overlay scope
- `docs/PHASE7E-COMMAND-CENTER-MINIMAL.md` — Portfolio command center (out of scope for signal density)
