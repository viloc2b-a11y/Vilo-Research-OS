# MV40618 — Phase 11F-B Operational Buildout (Data Only)

**Status:** Thin operational runtime on staging host study `6bae715a-8536-4000-8d24-22b6a3dbb8c9` (shared with PARA thin runtime).

**Loader:** `node scripts/load-mv40618-runtime.mjs`  
**Manifest:** `fixtures/mv40618/runtime-manifest.v1.json`  
**Proof:** `node scripts/phase11fb-proof.mjs`

## Operational mapping (pre-load audit)

| MV40618 requirement | Runtime primitive | Classification |
|---------------------|-------------------|----------------|
| Index patient screening | `subject_role=index_patient`, visit `eligible_subject_roles` | Supported |
| Household contact enrollment | `household_contact`, `household_id`, `anchor_subject_id` | Supported |
| Role-aware schedules | `phase11d_visit_definition_applies_to_subject` + role arrays | Supported |
| Home / remote / phone / off-site visits | `visit_definitions.modality` → `visits.modality` | Supported |
| Symptom / sick unscheduled workflow | `is_conditional` + `instantiate_conditional_procedure_execution` + visit UI | Supported (coordinator-confirmed) |
| Swab / sample collection | Thin procedure maps + LAB SDV binding | Partial — visit-level SDV reuse |
| Source capture / signatures / closeout | Published SDV + operational spine | Supported (existing) |
| Contact tracing dashboard / analytics | Not in scope | P2 deferred |
| Infection spread / symptom automation | No rules engine | P2 deferred |
| Auto symptom → visit orchestration | No event engine | P1 friction — checklist + conditional panel |
| Full household SOA / all cycles | Not loaded | P2 deferred |
| eDiary / transmission surveillance UI | Not in scope | P2 deferred |
| IWRS / inventory / PV suite | Out of scope | P2 deferred |
| Readiness gate for role-specific maps | Gate checks `participant` or null roles only | P1 — PARA `participant` maps satisfy gate; MV bindings enforced at schedule PE insert |

## What was loaded

- Study version: `MV40618-operational-thin-v1`
- 11 visit definitions (`MV_SCR` … `MV_ET`)
- 12 procedure definitions
- 24 visit×procedure maps (4 conditional)
- 12 procedure source bindings (SCR/D1/FU/EOS/ET/LAB published SDVs)
- PARA visits re-scoped to `eligible_subject_roles = ['participant']` so index/contact schedules do not inherit PARA SOA

## Intentionally deferred

- Full transmission protocol visit matrix and surveillance cadence
- Procedure-specific symptom / swab instruments (reuse visit-level SDVs)
- Contact tracing graph, household analytics, spread engine
- Automatic symptom-driven visit creation
- Dedicated MV workflow seed rows (coordinator UI + conditional panel)

## Household / role handling

- Index: `subject_role=index_patient`, receives index-only + shared visits.
- Contact: `subject_role=household_contact`, `household_id` shared with index, `anchor_subject_id` → index subject.
- Shared visits use `eligible_subject_roles: ['index_patient','household_contact']`.

## Conditional workflow

- `PROC_MV_SICK_ASSESS`, `PROC_MV_EXTRA_SWAB` are conditional (not auto-created).
- Coordinator confirms on visit **Procedures** tab; `CONDITIONAL_PROCEDURE_INSTANTIATED` event logged.
- `MV_SICK_UNSCHED` visit is scheduled with placeholder window (day 99); procedures require instantiate.

## Source coverage (thin)

| Area | SDV bucket |
|------|------------|
| Screening / consent | SCR |
| Symptom / phone / sick | FU |
| Swab / lab | LAB |
| Site vitals / AE | D1 |
| EOS / ET | EOS / ET |

## Pilot identifiers (optional live enroll)

- Index: `MV40618-IDX-PILOT-001`
- Contact: `MV40618-CNT-PILOT-001`
