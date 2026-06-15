# Sprint H — Governance Lifecycle Closure
## Runtime Validation Report

**Validation ID:** sprint-h-governance-lifecycle-validation-001  
**Date:** 2026-06-14  
**Status:** COMPLETE

---

## DoD Assessment

| Criterion | Status | Notes |
|---|---|---|
| DoD 1 — Coordinator Visible | PASS | CAPA overdue signals in VPI risk queue; deviation panel in Subject 360° |
| DoD 2 — Subject Workspace | PASS | SubjectDeviationsPanel wired into subjectId/workspace page |
| DoD 3 — Workflow Backbone | PASS | Signals route through existing VPI pipeline; no parallel queue |
| DoD 4 — Command Center | PASS | capa_overdue kind registered in coordinator risk queue with priority 91 |
| DoD 5 — Pilot Evidence | PASS | This artifact |

---

## Tasks

### H1 — Deviation Adjudication FSM
Status enum extended from 3 legacy values to 8:
- Legacy: `open`, `under_review`, `closed`
- New FSM: `candidate`, `pi_review`, `confirmed`, `capa_linked`, `resolved`

API auto-stamps `adjudicated_by` / `adjudicated_at` on `confirmed`, `capa_linked`, `resolved` transitions. `superseded_by` accepts a UUID for deviation supersession chain.

**Migration:** `0198_deviation_adjudication_lifecycle.sql`

---

### H2 — CAPA → VPI Risk Queue Feed
`capa_overdue` signal kind added to the exhaustive `SubjectSignalKind` union. Loader queries:

```
capa_actions (status IN open/in_progress/under_review AND due_date < today)
  → protocol_deviations(subject_id)
  → study_subjects(subject_identifier)
```

Signal appears in coordinator risk queue with rose tone (`bg-rose-100`) and priority 91.

---

### H3 — Governance Signal Lifecycle
New columns on `protocol_deviations`:
- `superseded_by uuid` — FK self-reference for supersession chain
- `reopened_at timestamptz` — audit stamp for reopen events
- `adjudicated_by uuid` — FK to `auth.users`
- `adjudicated_at timestamptz` — PI adjudication timestamp

Index: `protocol_deviations_adjudication_idx ON (study_id, status, created_at DESC)`

---

### H4 — Protocol Deviation Panel in Subject 360°
`SubjectDeviationsPanel` renders:
- Open deviation count badge
- Per-deviation: status badge (8 statuses), severity badge (minor/major/critical)
- Covers both legacy and new FSM states in OPEN_STATUSES set

Integrated into subject workspace via `Promise.all` data load (8 parallel queries).
