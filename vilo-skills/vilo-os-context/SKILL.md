---
name: vilo-os-context
description: Mandatory Vilo OS governance, architecture, and execution context. Load before any coding, migration, spec, refactor, UI copy, or AI/governance work on the vilo-os clinical research platform.
---
# Vilo OS Context

## Trigger
Load for: any code, migration, spec, plan, refactor, UI copy, alert/notification design, new feature, or AI/governance decision in this repo.
Activation phrase: `load skill: vilo-os-context`

## Platform identity
Vilo OS is a **Site Execution Operating System** and **Coordinator Survival OS**.
Primary beneficiary order: **Coordinator → Site → PI/Sub-I**.
Sponsors, CROs, and monitors are NOT primary beneficiaries.

## Workflow
1. Identify the work domain (code / migration / UI / AI / spec / refactor).
2. Apply the matching hard rules below before producing any output.
3. If a request violates a rule → **STOP** and surface the conflict first.
4. Use site-first vocabulary in all artifacts (see vocabulary table below).
5. Verify new modules/layers against the architecture gates before writing code.

---

## Hard rules

### 1 — Site-first
- Runtime exists for: finding prevention, deviation prevention, coordinator simplification, revenue protection.
- No feature may prioritize external visibility over coordinator protection.
- Sponsor/CRO/monitor-first dashboards → **forbidden**. See `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md`.

### 2 — Coordinator protection (STOP if requested)
Never implement:
- Coordinator scoring, ranking, or productivity metrics
- Behavioral export of coordinator actions to external analytics
- Automated performance alerts to sponsors/CROs
- Dashboards whose primary consumer is sponsor, CRO, or CRA/monitor
- Time-on-task or click tracking for external audiences

Visibility class default: `site_only`. Changing to `derived_external` requires explicit policy review (`lib/runtime-protection/visibility.ts`).
Copy note: "Investigator review needed" — not "coordinator failed to sign."

### 3 — Coordinator-facing language
**Forbidden in UI copy, labels, helper text:**
`violation`, `failure`, `enforcement`, `noncompliance`, `escalation triggered`, `monitoring issue`, `audit problem`, `coordinator score`, `productivity`, `ranking`, `surveillance`, `you must`, `non-compliant`, `failed audit`

Use `toCoordinatorSafeOperationalLanguage()` from `lib/coordinator-calm/language.ts` for dynamic strings.

| Instead of | Use |
|---|---|
| "Audit finding likely" | "Prevention focus" |
| "Deviation detected" | "Chronology needs review" |
| "Source validation failure" | "Source continuity incomplete" |
| "Evidence not compliant" | "Stabilization needed" |
| "Blocked by policy" | "Completion blocked" |
| "Monitor will reject" | "Stabilize before SDV" |

### 4 — External visibility
- Vilo OS does **not** emit operational truth to external actors by default.
- External visibility requires: site-controlled + derived + scoped + delayed + operationally justified.
- All new features start with `DEFAULT_DENY_EXPOSURE_POLICY`.
- Before shipping external visibility: call `validateExposurePolicy()` + `rejectsSurveillancePolicy()`.

Forbidden as default external outputs:
- `visit_coordinator_orchestration_projections` raw rows
- `visit_readiness_projections` / `subject_runtime_projections` dumps
- `runtime_traces`, `execution_spans`, `workflow_telemetry_events` streams
- Work queue buckets with coordinator identifiers
- Live feeds tied to projection refresh

### 5 — VIP / AI authority (GOV-1)
- AI is **ASSISTIVE only**. Never mutate truth layers directly.
- AI may suggest, summarize, route — never confirm eligibility, randomize, sign source, lock visits, adjudicate deviations.
- Authority levels: `ASSISTIVE` → `HUMAN_REQUIRED` → `SYSTEM_ENFORCED`. Use `WORKFLOW_AUTHORITY_LEVEL` constants only — no free-text authority strings in runtime, traces, or observability.
- New AI-assisted workflows **must** be registered in `workflow_decision_authorities` before shipping.
- `workflow_key` is immutable once referenced. Deprecate with `active = false`; never rename.
- Hard-stop policy: `ACTIVE_DELEGATION + evidence_status=MISSING` → `BLOCK_ACTION` (see `lib/vip-policy/hard-stop-policy.ts`). Advisory alerts cannot bypass this.

### 6 — PHI in logs, alerts, and copy
- No subject names, coordinator names, or emails in external payloads, alert bodies, or log fields.
- No PHI in `notes`, `condition_expression`, or any DB field surfaced externally.
- Call `validateMetadataNonPhi()` from `lib/ai-governance/risk-tier.ts` at every alert/governance creation boundary.
- ALCOA+ (FDA 21 CFR Part 11): timestamps must be server-generated — use DB `now()` in RPC or trigger, **not** `new Date().toISOString()`.

### 7 — Architecture gates
Before creating a new `lib/` module, API route family, or architectural layer:
- Does an existing module already own this concern? Check `lib/document-intake/`, `lib/governance-fabric/`, `lib/delegation-runtime/`, `lib/performance/` before adding new.
- No parallel detection logic — adapters only; delegate to existing detectors/scanners.
- Does this belong in `vilo-os/` or `apps/runtime-api/` (NestJS)? Verify the boundary.
- New migration: confirm latest number via `ls supabase/migrations/ | tail -5` before naming.
- No new layer unless a clear single-responsibility domain requires it and existing libs are genuinely insufficient.

### 8 — Coordinator UX Gate
Before approving any feature, answer all five:
- Can the coordinator complete the workflow with fewer clicks?
- Does this remove work or add work?
- Does this reduce context switching?
- Can this be executed from the workspace where the coordinator already works?
- Does this eliminate a manual export, copy/paste, or duplicate entry?

If the answer to any is no → **STOP and justify the feature.**

Preferred outcome: Coordinator workload ↓ | Operational clarity ↑ | Navigation complexity ↓

---

## Site-first vocabulary (all artifacts)

| Use | Instead of |
|---|---|
| Inspection Readiness Workspace | CRA Workspace |
| Controlled External Visibility | Sponsor Oversight |
| Operational Review Surface | Monitoring Dashboard |
| Finding Prevention Runtime | Oversight Engine |
| Coordinator operational survival prioritization | Task management (for orchestration/queues) |
| Site self-defense telemetry | Monitor visibility / oversight telemetry |
| Operational explainability | Sponsor transparency |
| Stabilize before SDV | Monitor will reject |

---

## Prohibited product patterns — STOP if proposed

- Sponsor surveillance surfaces of any kind
- Coordinator scoring / productivity metrics for external audiences
- Monitor-first dashboards
- Real-time sponsor feeds from projections or orchestration
- Raw runtime export APIs
- Cross-site coordinator leaderboards
- Default `exportable: true` exposure policies
- `authorityName` / free-text authority strings in trace payloads

---

## Key source files

| File | Purpose |
|---|---|
| `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md` | Architectural north star |
| `docs/PRODUCT_GUARDRAILS.md` | Site-benefit justification rule |
| `docs/FUTURE_IMPLEMENTATION_GUARDRAIL.md` | Copy into every spec |
| `docs/COORDINATOR_PROTECTION_RULES.md` | Prohibited surfaces |
| `docs/OPERATIONAL_CALM_LANGUAGE_GUIDE.md` | Approved phrasings |
| `docs/EXTERNAL_VISIBILITY_POLICY.md` | Visibility policy types |
| `docs/GOV-1-WORKFLOW-DECISION-AUTHORITY.md` | AI authority matrix |
| `docs/ARCHITECTURE_NON_GOALS.md` | Permanent exclusions |
| `lib/runtime-protection/visibility.ts` | Visibility class types |
| `lib/coordinator-calm/language.ts` | `toCoordinatorSafeOperationalLanguage()` |
| `lib/ai-governance/risk-tier.ts` | `validateMetadataNonPhi()` |
| `lib/vip-policy/hard-stop-policy.ts` | `BLOCK_ACTION` constraints |
