# Vilo OS Master Execution Map

**Date:** 2026-06-02  
**Status:** Structural execution guide  
**Scope:** Product architecture, module positioning, implementation order  

This document consolidates the current Vilo OS structural direction into one execution map. It is not a redesign, not a new layer, and not a replacement for phase-specific documents. It is the operating compass for extending Vilo OS without turning it into a traditional CTMS, BI dashboard, recruitment platform, QMS, or AI knowledge system.

---

## 0. Non-Negotiable Product Frame

Vilo OS is a site-first clinical execution operating system.

The primary user is the site coordinator. Every feature must answer:

1. Does it save coordinator time?
2. Does it preserve context?
3. Does it reduce duplicate entry?
4. Does it convert runtime events into useful action?
5. Does it protect enrollment, compliance, revenue, and sponsor trust without adding manual reconciliation?

If a feature increases complexity without reducing coordinator burden, it should not be implemented in the current scope.

---

## 1. Core Architecture

Current architecture:

```text
Protocol
  -> Canonical Reader
  -> Parser Extraction Result
  -> Reconciliation
  -> Runtime Objects
  -> Source Generation
  -> Visit Runtime
  -> Operational Events
  -> Governance / Financial / VPI Intelligence
```

Do not create:

- Parallel CTMS
- Secondary runtime
- Knowledge Layer
- Candidate Store
- Separate recruitment platform
- Separate task system
- Additional governance layer
- AI truth engine

Everything must extend existing runtime architecture.

---

## 2. Structural Pillars

### 2.1 Protocol To Runtime

Purpose:

Convert protocol documents into executable runtime objects.

Existing anchors:

- Protocol intake runtime
- Protocol graph
- Source package generation
- Source blueprint evidence
- Runtime source publication
- Visit/procedure runtime objects

Primary next concern:

Keep protocol-derived truth deterministic and reconciled. Do not let AI/VIP outputs publish runtime truth without controlled review.

### 2.2 Execution Runtime

Purpose:

Execute study, subject, visit, procedure, and source workflows inside one coordinator-centered workspace model.

Existing anchors:

- Study Runtime
- Subject Runtime
- Visit Runtime
- Procedure Executions
- Source capture/review/signing
- Subject workflow actions
- Visit readiness projections

Primary next concern:

Reduce navigation and converge execution inside workspaces. Every operational signal should route back to the relevant subject, visit, source, or workflow action.

### 2.3 Governance Runtime

Purpose:

Let compliance emerge from runtime evidence instead of asking coordinators to maintain a separate compliance system.

Existing anchors:

- `lib/governance-fabric`
- `lib/governance/workflow-authority`
- `lib/runtime-integrity`
- `components/runtime-ui/SafetyGovernanceBlockerPanel.tsx`
- Visit readiness governance bridge

Current capability:

- Detect visit window deviation signals
- Detect missing source at signoff
- Detect unresolved findings
- Detect unresolved AE/safety continuity
- Detect protocol graph blockers
- Detect open query signals
- Convert governance signals into readiness blockers
- Persist/supersede `governance_signals`

Gaps:

- Full governance signal lifecycle
- Candidate deviation lifecycle
- Confirmed deviation runtime
- CAPA lifecycle beyond placeholders
- Stronger UX presence in Visit, Subject, Study, and VPI surfaces

Correct positioning:

```text
Runtime Event
  -> Governance Signal
  -> Authority Evaluation
  -> Runtime Blocker / Warning
  -> Coordinator Action
  -> Audit Evidence
```

Governance must not become a separate QMS inside Vilo OS.

### 2.4 Financial Runtime

Purpose:

Make financial intelligence native to clinical execution.

Existing anchors:

- Financial Runtime
- Expected / Earned / Invoiced / Paid model direction
- Visit/procedure execution linkage
- ClinIQ reusable patterns for ledger, AR, leakage, and negotiation

Required principle:

Visit payment is not visit revenue.

Revenue must support:

- Visit payment
- Procedure payment
- Pass-through costs
- Patient stipend
- Screen failure visits with zero visit payment
- Invoiceable procedures independent from visit payment

Gaps:

- Complete payment lifecycle statuses
- Reversal/dispute/write-off history
- Procedure-level earned revenue events
- Budget negotiation engine data inputs
- ClinIQ-derived AR and leakage integration

### 2.5 VPI - Vilo Performance Index

Purpose:

VPI is not a dashboard. VPI is the site operational visibility and execution control system.

Primary question:

What requires attention right now to protect enrollment, compliance, revenue, and sponsor satisfaction?

Existing anchors:

- `app/(ops)/performance`
- `lib/performance`
- VPI read layer
- VPI RPC/fallback strategy
- Study health table
- Subject risk queue
- Coordinator today inbox
- Owner workflow queue
- Visit execution snapshot

Current state:

- Phase 7A largely present
- Phase 7B partially prepared
- Phase 7C mostly present
- Phase 7E partially present

Gaps:

- `/performance/today` must become the main coordinator action screen
- Fallback coordinator load is empty
- Subject/data-capture/event signals are placeholders
- SQL aggregation must be verified/completed
- Sponsor layer remains postponed

Correct positioning:

```text
Study Runtime
  -> Subject Runtime
  -> Visit Runtime
  -> Execution Events
  -> VPI
  -> Top Coordinator Actions
```

VPI observes everything and captures nothing.

### 2.6 Patient Acquisition Runtime

Purpose:

Unify recruitment handoff into enrollment without creating a separate recruitment platform inside Vilo OS.

Correct positioning:

- Vitalis owns external recruitment capture and lead pipeline.
- Vilo OS receives qualified/consented/screened/randomized handoff into Subject Runtime.
- Vilo OS may expose enrollment readiness and recruitment risk through VPI.

Sources:

- Meta Ads
- Google Ads
- Website Forms
- SubjectWell
- Clariness
- TrialFacts
- ReferWell
- Internal CRM
- Manual Entry

Gaps:

- Handoff contract from Vitalis/CRM to Vilo OS
- Attribution model
- Cost per randomized integration
- Study/Subject Runtime linkage

### 2.7 Task / Query / Workflow Runtime

Purpose:

Use one runtime task/workflow backbone for operational work.

Existing anchor:

- `subject_workflow_actions`

Direction:

Any runtime object should be able to generate linked work:

- Study
- Subject
- Visit
- Procedure
- Deviation
- Query
- AE
- Document
- Study Log
- Monitoring Visit
- CAPA

Gaps:

- Universal object linking model
- Multiple queries per field
- Query burden analytics
- Owner assignment
- Escalations and SLA rules
- Strong integration into VPI coordinator load

Do not create a separate task system.

### 2.8 Reporting / Export Privacy

Purpose:

Allow reporting and exports without leaking more data than needed.

Required export modes:

- Identified
- De-identified
- Limited dataset

Config by:

- Role
- Study
- Report type

Gaps:

- Report privacy policy engine
- Field masking rules
- Export audit trail
- Integration with Reporting Runtime

### 2.9 VIP

Purpose:

VIP is an intelligence adapter and policy-support layer, not a runtime truth source.

Existing anchors:

- `lib/vip-adapter`
- `lib/vip-policy`
- `app/api/internal/vip-adapter/screening-visit-draft/route.ts`
- Workflow Authority governance

Allowed:

- Generate controlled drafts
- Suggest policy evaluation
- Explain blockers
- Classify authority boundaries
- Capture feedback

Not allowed:

- Mutate clinical truth
- Sign source
- Lock visits
- Confirm eligibility
- Randomize
- Adjudicate deviations
- Override governance
- Become Knowledge Layer

Correct positioning:

```text
VIP Output
  -> Governance / Workflow Authority
  -> Human Review or Runtime Blocker
  -> Controlled Runtime Action
```

---

## 3. Current Implementation Status

| Area | Status | Interpretation |
| --- | --- | --- |
| Protocol to Runtime | Active | Core pipeline exists; continue controlled extension. |
| Execution Runtime | Active | Main runtime foundation exists; UX consolidation remains. |
| Governance Fabric | Active partial | Detection/blocking exists; lifecycle incomplete. |
| Workflow Authority | Active | Strong structural base for human/system authority. |
| Runtime Integrity | Active | Integrity audits and replay checks exist. |
| Financial Runtime | Active partial | Needs lifecycle/ClinIQ integration and procedure-level revenue depth. |
| VPI | Active partial | Correct foundation; needs action-first completion. |
| Patient Acquisition | External/partial | Vitalis/VILO CRM patterns should feed Vilo OS, not duplicate it. |
| Universal Tasks/Queries | Partial | `subject_workflow_actions` is anchor, needs universalization. |
| Export Privacy | Planned | Must be reporting runtime policy, not manual masking. |
| VIP | Adapter/prototype | Keep bounded and routed through governance authority. |

---

## 4. Execution Order

The implementation order should favor maximum coordinator impact with minimum architectural change.

### Phase 1 - Action Runtime Completion

Objective:

Make existing runtime signals actionable in the places coordinators already work.

Focus:

- VPI Today Engine
- Governance blockers in Visit/Subject workspaces
- Coordinator load from existing workflow actions
- Query burden signals
- Visit readiness/signoff risk surfaced in VPI

Expected impact:

High coordinator value, low architecture risk.

### Phase 2 - Governance And Financial Lifecycles

Objective:

Close the lifecycle gaps that protect compliance and revenue.

Focus:

- Governance signal lifecycle
- Candidate deviation -> confirmed deviation
- CAPA placeholder promotion path
- Payment lifecycle statuses
- Screen failure financial logic
- Procedure-level earned revenue
- Revenue leakage into VPI

Expected impact:

High operational and business value, moderate implementation risk.

### Phase 3 - Integration Bridges

Objective:

Bring old/adjacent Vilo assets into Vilo OS only where they support the runtime.

Focus:

- ClinIQ financial and budget negotiation patterns
- Vitalis recruitment handoff
- VILO CRM source attribution/lead patterns
- VPI legacy scoring ideas, not old app UI
- Vilo Academy training/readiness signals
- VIP adapter hardening

Expected impact:

Strategic expansion, higher integration risk.

### Phase 4 - External Visibility

Objective:

Expose derived, scoped, site-controlled external views.

Focus:

- Sponsor visibility
- Export privacy engine
- Limited datasets
- Sponsor score only after real operational data exists
- Benchmarking only after ecosystem integrations exist

Expected impact:

Strategic, but must remain postponed until internal runtime is stable.

---

## 5. Immediate Next Build Sequence

### Step 1 - VPI 1.1 Coordinator Today Engine

Goal:

Make VPI answer:

What are the top three things I must resolve today?

Files:

- `lib/performance/read-layer/build-from-signals.ts`
- `lib/performance/read-layer/fallback-signals.ts`
- `lib/performance/read-layer/signals/subject-signals.ts`
- `lib/performance/read-layer/signals/data-capture-signals.ts`
- `lib/performance/read-layer/signals/event-signals.ts`
- `lib/performance/portfolio/map-coordinator-load.ts`
- `app/(ops)/performance/_components/CoordinatorTodayInbox.tsx`
- `app/(ops)/performance/_components/SubjectRiskQueue.tsx`
- `app/(ops)/performance/_components/OwnerWorkflowQueue.tsx`

Rules:

- No charts
- No trends
- No sponsor layer
- No migrations unless strictly required
- No Lovable VPI copy

### Step 2 - Governance Runtime Lifecycle Map

Goal:

Turn governance from detection-only into an explainable lifecycle.

Files:

- `lib/governance-fabric/types.ts`
- `lib/governance-fabric/detect-deviations.ts`
- `lib/governance-fabric/signals.ts`
- `lib/governance-fabric/integration/projection-bridge.ts`
- `components/runtime-ui/SafetyGovernanceBlockerPanel.tsx`

Output:

- signal lifecycle
- candidate deviation design
- confirmed deviation integration
- CAPA placeholder path
- VPI governance risk feed

### Step 3 - Financial Runtime Lifecycle

Goal:

Implement payment lifecycle and screen failure financial logic without assuming visit payment equals visit revenue.

Focus:

- Expected
- Earned
- Invoiced
- Paid
- Reverted
- Disputed
- Written Off

Connect:

- Visit signed
- Procedure performed
- Screen fail visit
- Pass-through cost
- Patient stipend
- Revenue leakage

### Step 4 - Universal Workflow Backbone

Goal:

Extend `subject_workflow_actions` or its runtime pattern into a universal linked task/query/workflow engine.

Focus:

- owner
- due date
- priority
- escalation
- linked object
- multiple queries per field
- query burden analytics
- VPI coordinator load

### Step 5 - Integration Adapters

Goal:

Integrate existing old repos only where they serve Vilo OS runtime.

Use:

- ClinIQ: financial runtime, AR, leakage, budget negotiation
- Vitalis: acquisition handoff and attribution
- VILO CRM: organization/contact/lead ingestion patterns
- VPI old repos: scoring concepts only
- Academy: training/delegation readiness signals
- VIP: adapter/policy support only

Reject:

- duplicate UI shells
- standalone apps
- separate truth layers
- generic BI dashboards
- autonomous AI decision engines

---

## 6. UX Presence Requirements

Every structural pillar must have presence in UX, but not as separate clutter.

| Pillar | Primary UX Surface |
| --- | --- |
| Protocol to Runtime | Study Workspace / Protocol Engineering |
| Execution Runtime | Subject Workspace / Visit Workspace |
| Governance | Visit blockers / Subject regulatory signals / VPI risks |
| Financial Runtime | Financial Workspace / Visit revenue status / VPI revenue risk |
| VPI | `/performance/today` as coordinator command surface |
| Patient Acquisition | Vitalis handoff + Subject enrollment state |
| Tasks/Queries | Subject/Visit workflow panels + VPI owner queue |
| Export Privacy | Reporting Runtime export controls |
| VIP | Draft/explanation panels with governance boundary |

The user should not have to navigate to a separate module to understand what action is needed.

---

## 7. Anti-Patterns

Block these patterns:

- Dashboard-first VPI
- Sponsor-first design
- Separate recruitment platform inside Vilo OS
- Separate task system
- AI-generated clinical mutations
- Manual reconciliation screens
- Duplicate source/CTMS/budget entry
- Raw external visibility into site runtime
- More navigation when an inline workspace action is possible
- Premature benchmarking
- Premature sponsor score
- Premature persistent alerting without a delivery channel

---

## 8. Success Definition

Vilo OS succeeds when a coordinator can begin the day from one operational surface and know:

1. Which subject needs attention now.
2. Which visit is at risk.
3. Which blocker prevents signoff or closeout.
4. Which query/deviation/workflow item is owned by whom.
5. Which action protects revenue.
6. Why the system is showing the warning.
7. Where to click once to resolve it in context.

The system should generate evidence while the coordinator works, not after the coordinator performs extra documentation.

