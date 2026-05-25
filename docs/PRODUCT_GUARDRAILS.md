# Product Guardrails — Site-First

**Status:** Active  
**Enforcement:** Architecture review, spec acceptance, and agent prompts — not runtime code paths.

---

## Hard guardrails

Vilo OS must **never** evolve into:

| Anti-pattern | Why forbidden |
|--------------|----------------|
| **Sponsor surveillance software** | Sites are operators, not subjects of continuous external monitoring |
| **Monitor productivity tooling** | CRAs/monitors are not the primary UX beneficiary |
| **Coordinator scoring / exposure engine** | Coordinators must not be ranked or surveilled by sponsors |
| **Site ranking platform** | No competitive site scorecards for CRO/sponsor audiences |
| **Unrestricted sponsor visibility runtime** | No default pipes from orchestration, traces, or queues to external tenants |

---

## Mandatory justification rule

> **Every external-facing capability requires explicit site-benefit justification.**

Before any sponsor-, CRO-, or monitor-oriented surface ships, document:

1. **Site operational benefit** — how it reduces findings, deviations, overload, or revenue risk  
2. **Control model** — who at the site authorizes release, delay, and scope  
3. **Data minimization** — fields, timing, and de-identification  
4. **Why not coordinator-only** — why the site cannot achieve the same outcome internally first  

Without this, the capability is **LOW PRIORITY / FUTURE** (see `IMPLEMENTATION_SEQUENCE.md`, enterprise roadmap spec).

---

## Approved vocabulary (use in specs and roadmaps)

| Use | Instead of |
|-----|------------|
| Inspection Readiness Workspace | CRA Workspace |
| Controlled External Visibility | Sponsor Oversight |
| Operational Review Surface | Monitoring Dashboard |
| Finding Prevention Runtime | Oversight Engine |
| Inspection Readiness Review | Monitor Review |
| Controlled External Review | External Oversight |
| Coordinator operational survival prioritization | Task management (for orchestration/queues) |
| Operational explainability | Sponsor transparency |
| Site self-defense telemetry | Monitor visibility, oversight telemetry |

---

## LOW PRIORITY / FUTURE (default defer)

- Sponsor visibility packs and portals  
- Monitor tooling as primary product surface  
- CRA-facing interfaces without site-initiated workflow  
- External operational exposure APIs  
- Real-time sponsor feeds from runtime projections  

---

## Site-first checks (review checklist)

- [ ] Primary actor is coordinator, site, or PI/Sub-I  
- [ ] Reduces coordinator cognitive load or clarifies next action  
- [ ] Does not expose raw runtime tables to external roles by default  
- [ ] External output is derived, scoped, and site-gated  
- [ ] No language implying surveillance, ranking, or oversight-first product  

See also: `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`, `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`.
