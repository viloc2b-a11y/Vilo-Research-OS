# Universal Workflow / Query Backbone - G1

**Date:** 2026-06-02  
**Status:** Execution guide  
**Scope:** Linked operational work and query burden without a parallel task system  

Vilo OS already has the correct backbone primitives. G1 formalizes how they should be used together without creating a separate task platform.

---

## 1. Product Positioning

The backbone is not a new module.

It is the common runtime pattern for:

- actions
- queries
- signature requests
- corrections
- follow-ups
- escalations
- owner workload
- VPI coordinator load

The coordinator should not manage multiple task systems.

---

## 2. Existing Anchors

### Subject Workflow Actions

Table:

- `subject_workflow_actions`

Role:

- longitudinal operational work linked to subject, visit, procedure, source response set, or source section.

Supports:

- action type
- status
- priority
- due date
- assigned role
- assigned user
- deep link

### Visit Snapshot Queries

Tables:

- `visit_snapshot_queries`
- `visit_snapshot_query_events`
- `visit_snapshot_reviews`

Role:

- formal operational review queries on locked visit snapshots.
- supports unlimited queries per field because every query is its own row.
- events are append-only.

---

## 3. Backbone Rule

Do not merge all work into one table prematurely.

Use a common read model:

```text
subject_workflow_actions
visit_snapshot_queries
governance_signals
financial_runtime_leakage
  -> Operational Work Item Read Model
  -> VPI Today / Risks
  -> Subject / Visit Workspace links
```

Clinical truth remains in its native runtime table.

---

## 4. Query Burden Model

Query burden should count:

- open workflow queries
- in-progress workflow queries
- open snapshot queries
- answered snapshot queries awaiting resolution
- overdue workflow queries
- high/critical snapshot queries
- queries per subject
- queries per visit/snapshot
- queries per coordinator
- queries per study

VPI should consume query burden as:

- study health metric
- subject risk signal
- coordinator load input
- deviation prediction input later

---

## 5. G1 Implementation Boundary

G1 may:

- include `visit_snapshot_queries` in VPI open query counts.
- include high/critical unresolved snapshot queries in VPI risk queue.
- include snapshot query assignment in coordinator load.

G1 must not:

- create a new task table.
- migrate workflow schemas.
- replace `subject_workflow_actions`.
- replace operational review query tables.
- add enterprise workflow routing.

---

## 6. Study Workspace Presence

Study Workspace now surfaces a read-only `Work Queue` summary in the Study Command Center.

It reads the existing `subject_workflow_actions` backbone and shows:

- open work
- overdue work
- due today
- high priority work
- unassigned work
- query workflow actions

This keeps work inside the Study Workspace and avoids a separate task module.
