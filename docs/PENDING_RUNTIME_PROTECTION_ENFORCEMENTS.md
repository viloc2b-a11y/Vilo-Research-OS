# Pending Runtime Protection Enforcements

**Status:** Backlog — types and docs are active; runtime hooks are **not** implemented yet.  
**Rule:** Do not implement items below without architecture review. **No runtime rewrite** in sovereignty pass.

---

## Enforcement backlog

| ID | Capability | Description | Depends on |
|----|------------|-------------|------------|
| E1 | **Delayed exposure enforcement** | Server-side check of `minimumDelayHours` before external packet release | Exposure policy registry |
| E2 | **Site review acknowledgment** | Persist site approver, timestamp, justification on export records | Export audit table (future) |
| E3 | **De-identification pipeline** | Transform step applying redaction rules before `derived_external` release | Packet schemas |
| E4 | **Export approval workflow** | UI + API for site role to approve/deny scoped exports | RBAC, audit |
| E5 | **Runtime visibility enforcement middleware** | API/route guard: reject responses with `internal_operational` visibility to external sessions | Visibility registry per resource |
| E6 | **Projection export registry** | Map each projection/table to `RuntimeVisibilityClass` in code | `lib/runtime-protection/visibility.ts` |
| E7 | **Policy lint in CI** | Fail build if new external routes lack `validateExposurePolicy()` call | Exposure policy tests |
| E8 | **Coordinator metric export scan** | Static check blocking routes that aggregate per-user coordinator KPIs for external actors | `COORDINATOR_PROTECTION_RULES.md` |

---

## Suggested implementation order

1. E6 — visibility registry (documentation in code, no behavior change)  
2. E7 — CI policy lint for new external routes  
3. E5 — middleware on external API namespace only  
4. E2 + E4 — site review workflow  
5. E3 — de-identification transforms  
6. E1 — delay enforcement  
7. E8 — coordinator surveillance scan  

---

## Acceptance criteria (per item)

- **E1:** Export cannot occur before `minimumDelayHours` elapses unless site override with audit row.  
- **E2:** No export record without `approved_by` + `site_benefit_justification`.  
- **E3:** Automated test proves PHI patterns absent from sample external packet.  
- **E4:** Coordinator cannot approve export outside org/study scope.  
- **E5:** External session receives 403 on raw projection endpoints.  
- **E6:** Every row in registry has exactly one `RuntimeVisibilityClass`.  
- **E7:** CI fails when `exportable: true` policy missing from PR touching `/api/external/*`.  
- **E8:** CI fails on coordinator per-user ranking queries in sponsor routes.  

---

## Explicitly out of scope for backlog (unless site-first exception)

- Sponsor self-service portals  
- Live monitor subscriptions to orchestration refresh  
- AI-generated sponsor briefings from runtime traces  

---

## References

- `lib/runtime-protection/exposure-policy.ts`  
- `lib/runtime-protection/visibility.ts`  
- `docs/EXTERNAL_VISIBILITY_POLICY.md`  
