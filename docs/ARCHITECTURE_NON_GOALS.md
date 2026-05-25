# Architecture Non-Goals

**Status:** Active — permanent exclusions  
**Purpose:** Prevent structural drift toward sponsor-first or monitor-first systems.

If a proposal matches a non-goal, **stop** unless the site-first exception process in `docs/PRODUCT_GUARDRAILS.md` is completed.

---

## Product non-goals

Vilo OS will **not** become:

1. **Sponsor surveillance platform** — continuous visibility into site operations for sponsor convenience  
2. **CRA productivity tooling** — primary UX optimizing monitor throughput over site execution  
3. **Unrestricted operational telemetry** — streaming internal traces/events to external tenants  
4. **Raw runtime export** — APIs or dumps of projection/orchestration tables  
5. **Coordinator monitoring analytics** — scoring, ranking, or surveillance of coordinator staff  

---

## Technical non-goals (for external-facing work)

- Real-time WebSocket feeds of readiness/orchestration to sponsor URLs  
- “Open telemetry” endpoints for CRO without site review middleware  
- Cross-site coordinator leaderboards  
- Sponsor-configurable dashboards over live `work_queue` JSON  
- Default `exportable: true` exposure policies  

---

## Process non-goals

- Shipping external visibility in the same phase as coordinator survival features  
- Using “transparency” or “oversight” as primary product vocabulary  
- Bypassing `validateExposurePolicy()` for expedience  

---

## What we build instead

| Instead of | Build |
|------------|--------|
| Sponsor dashboard | Site command center + coordinator queues |
| Monitor surveillance | Inspection readiness **derived** packets (site-initiated) |
| Oversight engine | Finding prevention runtime (readiness + orchestration) |
| CRA workspace (surveillance) | Inspection Readiness Workspace (controlled) |
| Task management for CRO | Coordinator operational survival prioritization |

---

## Related guardrails

- `docs/RUNTIME_SOVEREIGNTY_PRINCIPLES.md`  
- `docs/EXTERNAL_VISIBILITY_POLICY.md`  
- `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`  
- `docs/PENDING_RUNTIME_PROTECTION_ENFORCEMENTS.md`  
