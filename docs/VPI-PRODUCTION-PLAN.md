# VPI — Vilo Performance Index
## Master Execution Plan (LEAN · Production-Oriented)

**Producto:** Vilo OS
**Capa:** VPI — Vilo Performance Index
**Propósito:** Clinical Operations Control System
**Estado:** Approved for execution
**Baseline:** Phase 1B → 6C1 GREEN

---

# 0. Product Philosophy (Non-Negotiable)

VPI is NOT:

* a BI dashboard
* a reporting suite
* a KPI vanity layer
* a charting system

VPI IS:

# An Operational Management System

The system exists to answer one question only:

> What requires attention RIGHT NOW?

If a feature does not improve:

* prioritization
* operational awareness
* coordinator execution
* study risk visibility
* workflow resolution

…it does not belong in the current scope.

---

# 1. Execution Scope (Approved)

| Phase    | Status    | Scope                    |
| -------- | --------- | ------------------------ |
| Phase 7A | EXECUTE   | Read Layer               |
| Phase 7B | EXECUTE   | SQL Aggregation Engine   |
| Phase 7C | EXECUTE   | Scoring Lite             |
| Phase 7E | EXECUTE   | Minimal Command Center   |
| Phase 7D | POSTPONED | Trends & Snapshots       |
| Phase 7F | POSTPONED | Persistent Alerts        |
| Phase 7G | POSTPONED | Sponsor Layer            |
| Phase 7H | POSTPONED | Benchmarking + Ecosystem |

Execution order is STRICT:

# 7A → 7B → 7C → 7E

No parallelization.
No scope expansion.
No enterprise polish.

---

# 2. Core Product Language

These terms become canonical across VPI.

## Operational States

```ts
healthy
watch
risk
critical
```

## Operational Vocabulary

```txt
blocked
overdue
needs attention
window closing
unsigned
stale
assigned
unassigned
```

This vocabulary must remain consistent across:

* UI
* scoring
* queues
* alerts
* future sponsor exports
* future ClinIQ integrations

---

# 3. Phase 7A — Read Layer

## Objective

Centralize all operational reads into a single performance read layer.

This is a pure refactor.

NO:

* UI changes
* scoring
* business logic changes
* schema changes

Goal:

```txt
existing behavior
+ centralized architecture
+ scalable read foundation
```

---

## Architecture

```txt
lib/performance/
  types.ts
  read-layer/
    index.ts
    scope.ts
    aggregator.ts
    query/
      supabase-client.ts
      query-limits.ts
    signals/
      study-signals.ts
      visit-signals.ts
      procedure-signals.ts
      workflow-signals.ts
      subject-signals.ts
      data-capture-signals.ts
      event-signals.ts
```

---

## Rules

* Existing page behavior must remain byte-equal.
* Existing `loadPerformanceReadModel()` signature must not change.
* Existing UI must not know the refactor happened.
* All queries move OUT of UI helpers.

---

## Validator

```txt
scripts/validate-phase7a-read-layer.mjs
```

Checks:

* snapshot parity
* no regressions
* multi-tenant isolation
* fallback compatibility

---

## Acceptance Criteria

* `_lib/performance-read-model.ts` becomes thin facade
* all operational queries live under `lib/performance/read-layer`
* snapshot parity passes
* no UI regressions

---

# 4. Phase 7B — SQL Aggregation Engine

# THIS IS THE CORE OF VPI

Without this phase:

* VPI does not scale
* queues become slow
* scoring becomes expensive
* command center becomes unstable

---

## Objective

Move operational aggregation into SQL.

Replace:

```txt
multiple count fan-outs
```

with:

```txt
single operational RPC
```

---

# 4.1 SQL Objects

## View

```sql
vpi_study_health_v1
```

Columns:

| Column                      | Meaning                        |
| --------------------------- | ------------------------------ |
| study_name                  | study label                    |
| study_status                | active / paused / closed       |
| subject_count               | subject count                  |
| enrolled_count              | enrolled subjects              |
| active_visit_count          | active visits                  |
| missed_visit_count          | missed/out_of_window           |
| open_query_count            | unresolved queries             |
| open_findings_count         | unresolved findings            |
| blocked_procedure_count     | blocked validations            |
| unsigned_over_48h_count     | unsigned procedures            |
| visits_closing_window_today | urgent windows                 |
| stale_study_flag            | no activity threshold exceeded |
| last_activity_at            | latest operational activity    |

---

## View

```sql
vpi_subject_risk_signals_v1
```

One row per:

```txt
subject + active risk signal
```

Risk kinds:

```txt
missed_visit
out_of_window
overdue_action
blocked_procedure
window_warning
unsigned_procedure_48h
window_closing_today
stale_subject
```

---

## View

```sql
vpi_coordinator_load_v1
```

Columns:

| Column           | Meaning             |
| ---------------- | ------------------- |
| user_id          | coordinator         |
| assigned_items   | workload            |
| overdue_items    | urgent work         |
| blocked_items    | blocked validations |
| due_today        | today workload      |
| unassigned_queue | queue overflow      |
| last_active_at   | activity freshness  |

---

# 4.2 Ownership Correction

## IMPORTANT

`created_by` is NOT ownership.

Add immediately:

```sql
assigned_user_id uuid null
```

to:

```sql
subject_workflow_actions
```

This is REQUIRED for:

* inboxes
* workload
* accountability
* queue routing
* coordinator visibility

---

# 4.3 RPC

```sql
public.vpi_load_dashboard()
```

Single operational payload.

Returns:

```json
{
  "study_health": [],
  "subject_risk_signals": [],
  "coordinator_load": [],
  "generated_at": "..."
}
```

---

# 4.4 Aggregator Strategy

Read layer supports:

```ts
mode: 'rpc'
mode: 'fallback'
```

Fallback remains operational if RPC fails.

---

# 4.5 Performance Targets

| Surface            | Target      |
| ------------------ | ----------- |
| vpi_load_dashboard | < 500ms P95 |
| /performance       | < 800ms     |
| /performance/today | < 600ms     |
| /performance/risks | < 800ms     |

---

# 4.6 Validator

```txt
scripts/validate-phase7b-vpi-views.mjs
```

Checks:

* RLS isolation
* RPC shape
* performance under synthetic load
* fallback integrity
* 100-study simulation

---

# 5. Phase 7C — Scoring Lite

## Objective

Convert operational signals into operational states.

NOT configurable.
NOT dynamic.
NOT enterprise.

Simple.
Reliable.
Operational.

---

# 5.1 States

```ts
SubjectState =
  | 'healthy'
  | 'watch'
  | 'risk'
  | 'critical'
```

```ts
StudyState =
  | 'healthy'
  | 'watch'
  | 'risk'
  | 'critical'
```

---

# 5.2 Hardcoded Rules

## Subject

```txt
critical
  blocked procedure
  missed visit
  out_of_window
risk
  overdue action
  closing today
watch
  unsigned >48h
  warning window
```

---

## Study

```txt
critical
  blocked procedures > 0
  missed visits > 2
risk
  open queries > 5
  findings > 3
watch
  unsigned >48h
  closing today
healthy
  everything else
```

---

# 5.3 Recommended Actions

Recommended actions are NOT free strings.

Controlled vocabulary only:

```ts
contact_subject_today
resolve_blocked_validation
obtain_pi_signature
reschedule_visit
review_open_query
triage_assignment
review_stale_study
```

UI resolves labels.

This protects:

* future automation
* alerts
* AI copilots
* analytics
* consistency

---

# 5.4 Risk Queue

Queue behavior:

* grouped by operational severity
* deduplicated by subject
* ordered internally by `priorityRank`
* `priorityRank` NEVER shown in UI

UI only sees:

```txt
critical
risk
watch
healthy
```

---

# 5.5 Validator

```txt
scripts/validate-phase7c-scoring.mjs
```

Checks:

* scoring combinations
* ordering
* deduplication
* action generation

---

# 6. Phase 7E — Minimal Command Center

# TEXT-FIRST
# ACTION-FIRST
# NO DASHBOARD THINKING

---

# 6.1 Routes

```txt
/performance
/performance/today
/performance/risks
```

Nothing else.

---

# 6.2 /performance

Audience:

* COO
* site lead
* operations leadership

Question:

```txt
Which studies are in trouble?
```

---

## Table

| Study | State | Critical Issues | Needs Attention Today |
| ----- | ----- | --------------- | --------------------- |

No operational metric overload.

Expanded rows contain:

* subject count
* query count
* findings
* last activity
* execution snapshot

Expand-only.

---

# 6.3 /performance/today

Audience:

* coordinator
* operational staff

Question:

```txt
What do I need to resolve RIGHT NOW?
```

---

## Layout

```txt
CRITICAL
  blocked procedures
  missed visits
  overdue workflows
RISK
  windows closing today
  pending signatures
WATCH
  unsigned >48h
```

No charts.
No BI.
No graphs.

Only actionable operational items.

---

# 6.4 /performance/risks

# OWNER-CENTRIC WORKFLOW QUEUE

NOT subject-centric.

Question:

```txt
Who owns unresolved operational work?
```

---

## Columns

| Owner | Due Today | Blocked By | Recommended Next Step |
| ----- | --------- | ---------- | --------------------- |

Defaults:

```txt
owner = me
due = overdue + today
```

This becomes:

# coordinator operational inbox

---

# 6.5 Anti-Patterns (Hard Blocked)

The following are prohibited:

* Recharts
* D3
* Chart.js
* vanity metrics
* KPI walls
* heatmaps
* analytics dashboards
* trend charts

Custom lint rule fails build if introduced.

---

# 7. Postponed Phases

## Phase 7D — Trends

Blocked until:

```txt
3+ months real production usage
```

---

## Phase 7F — Persistent Alerts

Blocked until:

```txt
real delivery channel exists
(Slack/email/MCP)
```

---

## Phase 7G — Sponsor Layer

Blocked until:

```txt
real sponsor demand exists
```

---

## Phase 7H — Benchmarking

Blocked until:

```txt
ClinIQ + VITALIS integration exists
```

---

# 8. Cross-Cutting Rules

## RLS Mandatory

All VPI entities:

```sql
ENABLE ROW LEVEL SECURITY
```

Policies inherit:

```sql
user_can_access_organization()
```

---

## Telemetry

When load budgets fail:

```txt
VPI_LOAD_TELEMETRY
```

written into:

```txt
operational_events
```

---

## Feature Flags

```env
VPI_USE_RPC=true
VPI_SCORING_ENABLED=true
```

Only these.

---

# 9. Execution Discipline

During implementation:

DO NOT:

* redesign architecture
* add enterprise features
* add trends
* add configurability
* add role engines
* add charts
* polish UI excessively

The objective is:

# operational usefulness

NOT:

# visual impressiveness

---

# 10. Immediate Execution Plan

## Step 1

Execute Phase 7A.

Goal:

```txt
centralized read architecture
without behavioral changes
```

---

## Step 2

Write:

```txt
docs/PHASE7B-SQL-AGGREGATION.md
```

before implementation.

---

## Step 3

Implement:

```txt
vpi_study_health_v1
vpi_subject_risk_signals_v1
vpi_coordinator_load_v1
vpi_load_dashboard()
```

---

## Step 4

Layer Scoring Lite.

---

## Step 5

Ship minimal command center.

---

# Final Product Outcome

After Phases:

```txt
7A + 7B + 7C + 7E
```

VPI becomes:

# a production-grade clinical operations control system

with:

* operational prioritization
* coordinator workflow visibility
* study risk visibility
* scalable aggregation
* real command-center behavior
* future compatibility with ClinIQ and VITALIS

WITHOUT:

* enterprise overengineering
* dashboard clutter
* premature complexity
