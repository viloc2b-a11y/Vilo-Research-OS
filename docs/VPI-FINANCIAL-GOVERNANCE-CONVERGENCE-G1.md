# VPI Financial / Governance Convergence - G1

**Date:** 2026-06-02  
**Status:** Execution guide  
**Scope:** Read-only VPI convergence for governance, queries, and financial runtime risk  

VPI is the operational attention surface for the site. It does not capture financial data, adjudicate deviations, or perform billing. It observes derived runtime projections and routes the coordinator to the correct context.

---

## 1. Signal Families Now Feeding VPI

VPI fallback mode consumes:

- visit risk
- window closing today
- unsigned visits over 48h
- blocked procedures
- overdue workflow
- high/critical snapshot queries
- governance blockers/warnings
- financial leakage projections

---

## 2. Financial Runtime Boundary

Financial Runtime produces:

- expected
- executed
- earned
- leakage
- payment lifecycle snapshot

VPI consumes:

- leakage score
- leakage item count
- earned rate basis points

VPI does not:

- create invoices
- mark paid
- create AR records
- calculate sponsor balances
- override ClinIQ

---

## 3. Governance Boundary

Governance Runtime produces:

- runtime-derived governance signals
- readiness blockers
- candidate deviation context

VPI consumes:

- active blocker/warning signals

VPI does not:

- confirm deviations
- close deviations
- create CAPA automatically

---

## 4. Query Burden Boundary

VPI includes:

- `subject_workflow_actions`
- `visit_snapshot_queries`

This gives study health and coordinator workload a more accurate query burden picture without merging the underlying tables.

---

## 5. Product Rule

Every VPI signal must answer:

```text
What should the coordinator look at now, and why?
```

If the signal cannot route to context, it should not appear in the coordinator queue.

