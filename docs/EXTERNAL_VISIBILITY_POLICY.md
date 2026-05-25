# External Visibility Policy

**Status:** Active — mandatory rules for any external-facing capability  
**Implementation types:** `lib/runtime-protection/visibility.ts`, `lib/runtime-protection/exposure-policy.ts`

---

## Policy statement

Vilo OS does **not** emit operational truth to external actors by default. External visibility is a **controlled, derived, site-authorized** exception.

---

## Rules (mandatory)

### 1. No raw runtime exposure

Forbidden as default external outputs:

- `visit_coordinator_orchestration_projections` rows (raw JSON)
- `visit_readiness_projections` / `subject_runtime_projections` dumps
- `runtime_traces`, `execution_spans`, `workflow_telemetry_events` streams
- Work queue buckets with coordinator identifiers
- Live feeds tied to projection refresh

Allowed only after transform + policy validation → **`derived_external`** class.

### 2. Derived-only visibility

External artifacts must be:

- Aggregated or redacted packets (inspection readiness, query response, regulatory packet)
- Produced by an explicit transform with `derivedOnly: true` on `RuntimeExposurePolicy`
- Validated via `validateExposurePolicy()` before implementation ships

### 3. Site review first

`requiresSiteReview: true` for every exportable policy.

Site review means a documented site role action (coordinator lead, PI, or designated site admin) — not automatic release on submit.

### 4. Delayed exposure support

`minimumDelayHours` on exposure policy (default deny template: **24 hours**).

Purpose: prevent real-time surveillance of site operations. Inspection-readiness template may use `0` when release is event-driven and site-initiated.

### 5. Scoped exposure

- Declare `externalActorTypes` explicitly (`sponsor`, `cro`, `cra_monitor`, `regulator`, `auditor`)
- Minimum necessary fields in packet schema (separate spec per packet type)
- Study / subject / visit scope boundaries enforced in transform layer (future middleware)

### 6. De-identification requirement

`requiresDeidentification: true` for all exportable policies.

Strip or aggregate:

- Subject identifiers (unless site-approved coded IDs in packet spec)
- Coordinator user names/emails in external payloads
- Free-text clinical content not required for the external purpose

---

## Default templates

| Template | Use |
|----------|-----|
| `DEFAULT_DENY_EXPOSURE_POLICY` | All new features until reviewed |
| `INSPECTION_READINESS_EXPOSURE_TEMPLATE` | CRA/monitor inspection packets — still site-gated |

---

## Approval checklist

Before shipping external visibility:

- [ ] `validateExposurePolicy()` passes  
- [ ] `rejectsSurveillancePolicy()` returns false  
- [ ] Visibility class is `derived_external` (not `internal_operational`)  
- [ ] Site-benefit justification documented (`docs/PRODUCT_GUARDRAILS.md`)  
- [ ] Entry added in `docs/PENDING_RUNTIME_PROTECTION_ENFORCEMENTS.md` if middleware needed  

---

## Anti-patterns (reject in architecture review)

- Sponsor live dashboard fed from projection refresh  
- Monitor subscription to orchestration `work_queue` JSON  
- Bulk export API over runtime tables  
- “Transparency” telemetry aimed at CRO without site review  
