# Coordinator Protection Rules

**Status:** Active — structural prohibitions  
**Audience:** Architecture review, product, and agents

Coordinators are the **primary operational beneficiary**. Vilo OS must protect them from surveillance-shaped product patterns.

---

## Permitted coordinator surfaces

- Site Operations Home / command center  
- Study / subject / visit operational workspaces  
- Next-action strips and **coordinator operational survival prioritization** (work queues)  
- Why-blocked and readiness explainability **for the coordinator**  
- Source capture and sign workflows **on site behalf** (per RBAC)

---

## Explicitly prohibited

The following must **never** be implemented as product capabilities:

| Prohibition | Rationale |
|-------------|-----------|
| **Coordinator scoring** | Reduces humans to metrics for external judgment |
| **Coordinator ranking** | Comparative performance exposure across sites/staff |
| **Coordinator productivity surveillance** | Time-on-task, click tracking, or “efficiency” scores for sponsors/CROs |
| **External coordinator metrics** | Dashboards where primary consumer is sponsor, CRO, or CRA/monitor |
| **Behavioral export of coordinators** | Trace-derived activity feeds identifying coordinator actions for external analytics |
| **Automated performance alerts to sponsors** | Escalation of coordinator behavior outside the site |

---

## Allowed metrics (internal, site-only)

Site-facing operational counts are permitted when they **help the coordinator**:

- Blocked visit counts (aggregate)  
- Unsigned procedure counts  
- Open source backlog counts  
- Leakage risk scores **for site revenue protection**  

These must use visibility class `internal_operational` or `site_only` — not `derived_external` without policy review.

---

## RBAC alignment note

Coordinator **clinical** actions (capture, draft, submit) are governed by existing RBAC.

**Investigator signature** may require `pi_sub_i` / admin per `canSignClinicalSource` — product copy must say “PI signature required,” not imply coordinator failure.

---

## Review gate

Any feature touching coordinator activity data must answer:

1. Who is the primary beneficiary? (Must be coordinator or site.)  
2. Could this data identify or rank a coordinator for an external audience? (If yes → reject.)  
3. What visibility class applies? (Default: `site_only`.)

See `lib/runtime-protection/visibility.ts`.
