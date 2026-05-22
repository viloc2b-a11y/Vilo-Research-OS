# PARA_OA_012 — Phase 11F-A Operational Buildout (Data Only)

**Status:** Thin operational runtime loaded on staging host study `6bae715a-8536-4000-8d24-22b6a3dbb8c9`.

**Loader:** `node scripts/load-para-oa-012-runtime.mjs`  
**Manifest:** `fixtures/para-oa-012/runtime-manifest.v1.json`  
**Proof:** `node scripts/phase11fa-proof.mjs`

## Operational mapping (pre-load audit)

| PARA requirement | Runtime primitive | Classification |
|------------------|-------------------|----------------|
| Screening → eligibility → enrollment | `study_subjects.enrollment_status`, General tab | Supported |
| External randomization | `recordExternalRandomizationAction` | Supported |
| Visit schedule / windows | `visit_definitions` + `generate_subject_visit_schedule` | Supported (thin SOA) |
| Arm-specific visits | `visit_definitions.eligible_arms` | Supported |
| Phone / remote / off-site | `visit_definitions.modality` → `visits.modality` | Supported |
| ACTH / HIT / adrenal conditional | `is_conditional` + instantiate RPC + visit UI | Supported (coordinator-confirmed) |
| Source capture | Published SDV + `procedure_source_bindings` | Partial — shared visit-level SDVs |
| Signatures / closeout | Visit closeout bundle | Supported (existing spine) |
| eDiary / questionnaire COA | External ref fields in library only | P2 deferred |
| Auto lab → ACTH trigger | No rules engine | P1 friction — workflow checklist |
| Full long SOA (all cycles) | Not loaded | P2 deferred |
| IWRS randomization | External record only | Supported (by design) |

## What was loaded

- Study version: `PARA_OA_012-operational-thin-v1`
- 10 visit definitions (`PARA_SCR` … `PARA_ET`)
- 14 procedure definitions
- 30 visit×procedure maps (2 conditional)
- 15 procedure source bindings (SCR/D1/FU/EOS/ET/LAB published SDVs)
- Legacy phase2/VPI visit defs excluded via `eligible_subject_roles = __legacy_para_excluded__`

## Intentionally deferred

- Full protocol visit matrix and all treatment cycles
- Procedure-specific adrenal/HIT source instruments (reuse visit-level SDVs)
- eDiary integration
- Automatic cortisol/platelet decision engine
- Dedicated PARA workflow seed rows (coordinator uses UI + conditional panel)

## Conditional workflow approach

- `PROC_PARA_ACTH_STIM` and `PROC_PARA_HIT_PANEL` are **conditional maps** (not auto-created).
- Coordinator uses visit **Procedures** tab → **Confirm condition met**.
- Operational event `CONDITIONAL_PROCEDURE_INSTANTIATED` logged.
- Optional manual `subject_workflow_actions` for cortisol/HIT follow-up (not auto-seeded in 11F-A).
