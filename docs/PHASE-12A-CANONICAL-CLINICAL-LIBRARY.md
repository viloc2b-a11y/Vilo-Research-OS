# Phase 12A — Canonical Clinical Library Standardization

**Status:** Canonical core + overlay libraries defined; no protocol packages published.

**Fixture:** `fixtures/source-builder/canonical-clinical-library.v1.json`  
**Regenerate:** `node scripts/build-canonical-clinical-library.mjs`  
**Loader:** `@/lib/source-engine/canonical-clinical-library`  
**Smoke:** `npx tsx scripts/phase12a-canonical-library-smoke.ts`

## Existing library audit (pre-12A)

| Location | Role | Gap |
|----------|------|-----|
| `lib/source-engine/config.library.ts` | Legacy widget `FieldDefinition` by domain (thin vitals/AE/IP) | Overlapping keys (`heart_rate`, `blood_pressure_systolic`); no structured conditional metadata |
| `lib/source-engine/definitions/field.catalog.ts` | Phase 1 definition catalog | Partial overlap (`systolic_bp`, `ae_term`); no IP admin depth |
| `lib/source-engine/vilo-field-catalog.ts` | Minimal `FieldSpec` demo catalog | Not protocol-grade |
| `fixtures/source-builder/generic-operational-source-library.v1.json` | Site startup / training / facilities | Not clinical CRF fields |
| `fixtures/source-builder/procedure-profile-library.v1.json` | Procedure profile codes | References `TMPL_VITALS` keys, not canonical 12A keys |
| `lib/source-builder/generic-operational-library.ts` | Operational profile loader | Separate from clinical SDV fields |

## Canonical libraries added

| Code | Kind | Domain | Fields |
|------|------|--------|--------|
| `VITALS_CORE_V1` | core | vital_signs | 22 |
| `AE_CORE_V1` | core | adverse_events | 25 |
| `CONMED_CORE_V1` | core | concomitant_medications | 16 |
| `IP_ADMIN_CORE_V1` | core | investigational_product | 26 |
| `LAB_CORE_V1` | core | labs | 17 |
| `ECG_CORE_V1` | core | ecg | 14 |
| `PHYSICAL_EXAM_CORE_V1` | core | physical_exam | 14 |

## Overlays (protocol-specific)

| Code | Namespace prefix | Use |
|------|------------------|-----|
| `PARA_ADRENAL_OVERLAY_V1` | `adrenal_*` | PARA adrenal symptom review |
| `PARA_HIT_OVERLAY_V1` | `hit_*` | PARA HIT / platelet monitoring |
| `MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1` | `mv_*` | STUDY-INF-001 household symptom / swab |

## Controlled lists

`YES_NO`, `YES_NO_NA`, `BODY_POSITION`, `PRE_POST_IP_TIMING`, `AE_SEVERITY`, `AE_OUTCOME`, `AE_CAUSALITY`, `ROUTE`, `LAB_SOURCE_TYPE`, `PROCESSING_STATUS`, `ECG_INTERPRETATION`, plus temperature/weight/height/fasting/specimen/source origin lists.

## Composition guidance

- Use **one core library per source section** when publishing templates (avoids shared keys like `clinically_significant` across vitals/labs/ECG).
- Overlays append to a core block for protocol extensions (`composeCanonicalLibraryFieldKeys(['VITALS_CORE_V1'], ['PARA_ADRENAL_OVERLAY_V1'])`).
- `canonicalFieldsToFieldDefinitions(libraryCode)` bridges to legacy capture `FieldDefinition` without changing publish/signature flow.

## Intentionally not done (12A)

- No new SDV publish / package regeneration
- No automatic procedure binding
- No visual form builder or rules DSL
- No inventory/accountability module
