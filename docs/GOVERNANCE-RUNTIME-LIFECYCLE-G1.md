# Governance Runtime Lifecycle - G1

**Date:** 2026-06-02  
**Status:** Execution guide  
**Scope:** Governance Fabric lifecycle and VPI/workspace integration  

This document positions Governance Runtime as an extension of the existing Vilo OS runtime. It does not create a QMS, a second compliance system, or a new source of clinical truth.

---

## 1. Product Positioning

Governance in Vilo OS must emerge from runtime evidence.

It observes:

- visits
- source state
- procedure execution
- workflow/query state
- AE/safety continuity
- protocol graph blockers
- operational events

It produces:

- runtime governance signals
- blockers/warnings
- coordinator action routing
- audit evidence
- candidate deviation context

It does not independently adjudicate formal protocol deviations or CAPA.

---

## 2. Existing Runtime Chain

```text
Runtime Event / Projection
  -> detectVisitGovernanceSignals()
  -> governance_signals
  -> governanceSignalsToBlockers()
  -> visit_readiness_projections.blockers
  -> Visit / Subject / VPI UX
```

Existing anchors:

- `lib/governance-fabric/types.ts`
- `lib/governance-fabric/detect-deviations.ts`
- `lib/governance-fabric/signals.ts`
- `lib/governance-fabric/integration/projection-bridge.ts`
- `components/runtime-ui/SafetyGovernanceBlockerPanel.tsx`
- `public.governance_signals`
- `public.governance_capa_placeholders`
- `public.subject_protocol_deviations`

---

## 3. Lifecycle Model

### Governance Signal

```text
Detected
  -> Open
  -> Acknowledged
  -> Resolved
  -> Superseded
```

Meaning:

- `open`: active runtime-derived signal.
- `acknowledged`: reviewed by site, still unresolved.
- `resolved`: runtime or human action addressed it.
- `superseded`: signal no longer detected after projection refresh.

### Deviation Candidate

```text
Governance Signal
  -> Candidate Deviation Context
  -> Human Review
  -> Confirmed Deviation or No Deviation
```

Important:

The candidate is not a new table in G1. It is an interpretation of `governance_signals` routed into the existing subject regulatory/deviation UX.

### Confirmed Deviation

Formal confirmed deviations remain in:

- `public.subject_protocol_deviations`

Only a human-confirmed action should create or update these records.

### CAPA

Current CAPA capability is placeholder only:

- `public.governance_capa_placeholders`

G1 does not implement full CAPA workflow. It preserves the path:

```text
Confirmed Deviation
  -> CAPA Placeholder
  -> Future CAPA Runtime
```

---

## 4. UX Rules

Governance must appear where the coordinator is already working:

| Surface | Governance Presence |
| --- | --- |
| Visit Workspace | Safety/governance blockers before signoff/closeout |
| Subject Workspace | Regulatory signal chronology and formal deviations tab |
| VPI Today | Governance blockers/warnings in top action queue |
| Study Workspace | Governance & Queries card in Study Command Center |

Do not create a separate governance dashboard.

The Study Command Center summary is read-only and includes:

- open governance signals
- blocker signals
- warning signals
- open snapshot queries
- high/critical snapshot queries
- active formal deviation workload

---

## 5. VPI Integration

VPI should consume active `governance_signals` as operational risks.

Mapping:

| Governance severity | VPI state |
| --- | --- |
| `blocker` | `critical` |
| `warning` | `risk` |
| `info` | hidden from VPI action queue unless explicitly needed |

VPI action:

```text
Open subject regulatory/deviation context
```

VPI must not:

- confirm deviation
- close deviation
- create CAPA automatically
- bypass workflow authority

---

## 6. Next Implementation Boundary

G1 implementation should:

- read open/acknowledged governance signals
- expose them in VPI fallback risk queue
- route to the subject deviations/regulatory tab
- preserve signal derivation and explainability

G1 should not:

- create migrations
- add CAPA workflow
- add sponsor reporting
- add automated deviation adjudication
- create a separate compliance module
