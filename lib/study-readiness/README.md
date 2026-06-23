# Study Readiness Engine

## Purpose

Study Readiness provides a coordinator-first operational assessment of whether a study is ready to start execution.

The engine aggregates readiness across multiple operational domains and surfaces a simple readiness score and blocker list inside the Study Workspace.

This is not an activation gate.

It is an operational intelligence layer designed to identify startup risks before study activation.

---

## Current Domains

### Real Runtime Domains

- Regulatory
- Source
- Pharmacy
- Budget / Financial

### Placeholder Domains

- Lab
- Systems
- Training
- Contract

---

## Readiness Status

### Ready

All critical startup requirements satisfied.

### Warning

Non-critical gaps exist that should be addressed before activation.

### Blocked

One or more critical startup blockers exist.

---

## Regulatory Readiness

Evaluates:

- IRB approval status
- 1572 availability
- Delegation log availability
- Regulatory packet completeness
- Expired documents
- Expiring documents
- Regulatory review signals

Source:

- Regulatory Center
- Regulatory Signals
- Regulatory Packet Runtime

---

## Source Readiness

Evaluates:

- Protocol runtime generation
- Source publication status
- Visit definitions
- Procedure source bindings
- Runtime execution capability
- Source package consistency
- Amendment freshness

Source:

- Document Center
- Runtime Generation
- Source Generation

---

## Pharmacy Readiness

Evaluates:

- IP requirements
- Pharmacy blueprint configuration
- Receipt workflows
- Dispensing rules
- Accountability configuration
- Storage requirements
- Blinding configuration

Source:

- Pharmacy Runtime

---

## Budget Readiness

Evaluates:

- Accepted financial terms
- Unpriced line items
- Negotiation completion
- Invoiceable pricing readiness
- Expected billables generation
- Revenue protection dependencies

Source:

- ClinIQ Financial
- Budget Negotiation Runtime
- Revenue Protection Runtime

---

## Current Coverage

Study Readiness Tests: 62

Domains Connected:

- Regulatory ✅
- Source ✅
- Pharmacy ✅
- Budget ✅

Pending:

- Lab
- Systems
- Training
- Contract
- Activation Gate

---

## Coordinator Experience

The Study Readiness card appears directly inside the Study Workspace Command Center and provides:

- Overall readiness score
- Ready / Warning / Blocked status
- Domain health indicators
- Top blockers

Goal:

Answer a single question:

**"Can this study safely start execution?"**
