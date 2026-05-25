# Site-First Runtime Principles

**Status:** Active — architectural north star  
**Scope:** Terminology, roadmap, documentation, guardrails, and future implementation constraints. **Not** a runtime rewrite.

---

## 1. Vilo OS definition

**Vilo OS** is a **Site Execution Operating System** — operational infrastructure for research sites to execute protocol, source, visits, and governance **on the ground**.

It is also **Coordinator Survival OS**: runtime intelligence exists so coordinators can see what matters next, avoid overload, and resolve risk **before** findings, deviations, or external escalation.

---

## 2. Primary beneficiary

The primary beneficiary is always, in order of operational truth:

1. **Coordinator** — day-to-day execution, triage, and site-owned next actions  
2. **Site** — operational continuity, revenue protection, inspection readiness  
3. **PI / Sub-I** — clinical accountability, signature, and protocol adherence on site  

**Not** primary beneficiaries:

- Sponsor  
- CRO (as surveillance consumer)  
- CRA / monitor (as default dashboard audience)  
- External operational scoring or ranking consumers  

External parties may receive **controlled, site-authorized** views derived from site-protection runtime — never raw runtime exposure by default.

---

## 3. Runtime purpose

Runtime intelligence exists to:

| Purpose | Meaning |
|--------|---------|
| **Finding prevention** | Surface blockers and risk while the site can still correct |
| **Deviation prevention** | Protocol graph, readiness, and governance signals before protocol breach |
| **Operational continuity** | Visits, source, signatures, and workflows stay executable |
| **Coordinator simplification** | Reduce cognitive load; one clear next action beats ten dashboards |
| **Revenue protection** | Financial runtime and leakage signals protect site economics |
| **Pre-escalation resolution** | Fix on site before monitor query, sponsor escalation, or audit surprise |

---

## 4. Explicit anti-goals

Vilo OS must **never** become or prioritize:

- A **sponsor surveillance** platform  
- **CRA-first** workflow tooling (inspection readiness is site-owned; external review is derived and gated)  
- **Sponsor productivity** ranking or site scorecards for external audiences  
- **External operational scoring** of site staff  
- **Unrestricted runtime transparency** to sponsors, CROs, or monitors  

If a capability increases external visibility **without** clear site operational benefit, it is out of scope or **low priority** until justified.

---

## 5. External visibility principles

All external visibility must be:

| Principle | Requirement |
|-----------|-------------|
| **Site-controlled** | Export, share, and packet release are explicit site actions |
| **Derived** | Built from projections and governed events — not ad-hoc DB dumps |
| **Scoped** | Study / subject / visit boundaries; minimum necessary fields |
| **Delayed when appropriate** | Operational truth may lag external packets by design |
| **Operationally justified** | Tied to inspection readiness, query response, or regulatory obligation — not “always on” surveillance |
| **Never raw runtime** | No default sponsor/monitor access to orchestration tables, traces, or internal queues |

**Controlled External Visibility** and **Inspection Readiness** surfaces may exist **only** as emergent, gated outputs of site-protection runtime.

---

## 6. Architectural rules

1. **No feature may prioritize external visibility over coordinator protection.**  
2. **Runtime intelligence is for site self-defense first** — explainability for the site, not surveillance of the site.  
3. **Monitoring-facing capabilities emerge from site-protection runtime** — finding prevention, readiness, orchestration, observability — not parallel “oversight products.”  
4. **Work queues are coordinator operational survival prioritization**, not generic task management.  
5. **Observability is site self-defense telemetry** — operational explainability, continuity signals, and runtime self-correction; not sponsor transparency.  
6. **Terminology in specs and roadmaps must use site-first vocabulary** (see `docs/PRODUCT_GUARDRAILS.md`, `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`).

---

## Related documents

- `docs/PRODUCT_GUARDRAILS.md`  
- `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`  
- `docs/RUNTIME_SOVEREIGNTY_PRINCIPLES.md` — structural protection  
- `docs/EXTERNAL_VISIBILITY_POLICY.md`  
- `docs/COORDINATOR_PROTECTION_RULES.md`  
- `docs/ARCHITECTURE_NON_GOALS.md`  
- `lib/runtime-protection/` — visibility + exposure policy types  
- `RUNTIME_PHILOSOPHY.md`  
- `constitution.md`  
- `ARCHITECTURE_INDEX.md`  

Implementation repo mirror: `vilo-os/docs/SITE_FIRST_RUNTIME_PRINCIPLES.md` (same content).
