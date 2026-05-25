# Future Implementation Guardrail

**Copy this block into feature specs, plans, and agent prompts.**

---

## Primary beneficiary

The **site** and **coordinator** (with **PI/Sub-I** for clinical sign-off and accountability).

Runtime exists so the site can prevent findings, prevent deviations, reduce coordinator overload, protect revenue, and maintain operational continuity **before** external escalation.

---

## Prohibited prioritization

No implementation may prioritize **sponsor**, **CRO**, or **CRA/monitor** visibility over **coordinator operational protection**.

Do not build:

- Sponsor surveillance surfaces  
- Monitor-first dashboards  
- Coordinator scoring for external audiences  
- Unrestricted runtime transparency to external tenants  

---

## External visibility (only when justified)

External visibility must always be:

- **Site-controlled** — explicit site authorization  
- **Derived** — from governed runtime and projections  
- **Scoped** — minimum necessary context  
- **Delayed when appropriate** — not real-time surveillance by default  
- **Operationally justified** — documented site benefit per `docs/PRODUCT_GUARDRAILS.md`  

---

## Terminology

Use site-first vocabulary: **Finding Prevention Runtime**, **Controlled External Visibility**, **Inspection Readiness**, **coordinator operational survival prioritization**, **site self-defense telemetry**.

Avoid: oversight-first product language, sponsor transparency, monitor visibility as goals.

---

## Runtime changes

This guardrail governs **intent and acceptance**. It does not authorize bypassing RBAC, faking state, or rewriting runtime without a separate technical plan.

**Reference:** `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`
