# Runtime Sovereignty Principles

**Status:** Active — structural architecture protection  
**Scope:** Governance and type contracts. **Does not** change runtime execution, coordinator flows, or external tooling.

**Related:** `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`, `docs/EXTERNAL_VISIBILITY_POLICY.md`, `lib/runtime-protection/`

---

## 1. Operational sovereignty

The **site** owns operational truth. Vilo OS computes and stores runtime state for **site execution**, not for external surveillance.

- Projections, orchestration, traces, and queues are **site-operational assets**.
- Release of information outside the site is an **explicit sovereign act**, not a default pipeline.
- No feature may assume sponsors, CROs, or monitors are co-tenants of live runtime tables.

---

## 2. Site-controlled runtime

**Site-controlled runtime** means:

| Control | Requirement |
|---------|-------------|
| **Compute** | Derived from execution events and governed mutations on site behalf |
| **Access** | RBAC defaults to site roles (coordinator, PI/Sub-I, site admin) |
| **Export** | Gated by exposure policy (`lib/runtime-protection/exposure-policy.ts`) |
| **Delay** | Operational packets may lag external release by policy |
| **Revocation** | Site can withhold or scope future releases without breaking execution |

Runtime continues to run for the site even when external visibility is denied.

---

## 3. Prevention-first architecture

Runtime layers exist in this order of value:

1. **Prevent** findings (readiness, graph, source, signatures)  
2. **Prevent** deviations (protocol graph, governance signals)  
3. **Prevent** coordinator overload (orchestration, survival prioritization)  
4. **Protect** revenue and continuity (financial runtime, leakage)  
5. **Then** support controlled external review (inspection readiness)

Architectural additions must strengthen layers 1–4 before expanding layer 5.

---

## 4. External visibility restrictions

External visibility is **never** a first-class runtime output.

- **No raw runtime exposure** — projections, orchestration JSON, traces, or queues are not sponsor APIs.
- **Derived only** — packets are transformed aggregates with policy metadata.
- **Visibility classes** — `lib/runtime-protection/visibility.ts` (`site_only`, `internal_operational`, `derived_external`, `restricted`, `audit_locked`).
- **Policy validation** — `validateExposurePolicy()` enforces site review, de-identification, delay, and `derivedOnly`.

See `docs/EXTERNAL_VISIBILITY_POLICY.md`.

---

## 5. Coordinator protection rules

Coordinators are **operators**, not subjects of surveillance.

Structural prohibitions (see `docs/COORDINATOR_PROTECTION_RULES.md`):

- No coordinator scoring or ranking for external audiences  
- No coordinator productivity surveillance dashboards  
- No export of coordinator behavioral metrics to sponsors/CROs  
- No KPI leaderboards derived from runtime traces  

Coordinator-facing surfaces exist to **reduce load**, not to expose staff to external metrics.

---

## 6. Enforcement model (current vs future)

| Layer | Status |
|-------|--------|
| Principles & non-goals docs | **Active** |
| Type contracts (`runtime-protection/*`) | **Active** |
| Roadmap LOW PRIORITY annotations | **Active** |
| Middleware / export pipelines | **Pending** — `docs/PENDING_RUNTIME_PROTECTION_ENFORCEMENTS.md` |

**No runtime rewrite** is required to adopt sovereignty types; execution paths remain unchanged until enforcement tasks are scheduled.

---

## Architectural invariant

> External visibility may only narrow or delay information leaving the site; it must never widen default access to raw runtime.
