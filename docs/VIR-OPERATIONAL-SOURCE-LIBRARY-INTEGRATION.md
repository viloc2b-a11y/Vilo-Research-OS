# VIR Operational Source Library Integration

**Status:** Implementation guide  
**Code:** `fixtures/source-builder/vir-operational-source-library.v1.json`, `lib/source-builder/vir-operational-library.ts`  
**Purpose:** Add an operational startup/readiness layer to the Vilo OS Source Engine Creator.

---

## What This Adds

The VIR documents contribute a reusable operational library, separate from clinical procedure source forms:

| Library area | Vilo OS use |
|--------------|-------------|
| Site contact sheet | Study staff roster, system access, role/contact model |
| Facilities checklist | Site readiness checks, local lab readiness, emergency area, consent area, sample prep |
| Equipment checklist | ECG, crash cart, IP refrigerator, freezers, thermometers, calibration/inspection |
| Essential documents | CV, GCP, license, IATA, CAP/CLIA, reference ranges, SOP requirements |
| Training log | Staff training completion, version, date, signature/evidence |
| eCRF guidelines | Missing data, query workflow, log forms, signatures, external source references |

Do not merge this directly into the clinical `procedure-profile-library.v1.json`. Keep it as an **operational source/readiness library** and map selected rules into published Source definitions when needed.

---

## Integration Points

### 1. Source Builder

Load the library next to the existing procedure library:

```ts
import {
  buildEssentialDocumentChecklist,
  buildFieldsFromOperationalProfile,
  buildReadinessChecklist,
  buildSourceCaptureRuleCatalog,
  loadVirOperationalSourceLibrary,
} from '@/lib/source-builder/vir-operational-library'

const library = loadVirOperationalSourceLibrary()
const essentialDocs = buildEssentialDocumentChecklist()
const readiness = buildReadinessChecklist()
const captureRules = buildSourceCaptureRuleCatalog()
const trainingFields = buildFieldsFromOperationalProfile('OPS_STAFF_TRAINING_LOG')
```

Use these outputs to seed tabs inside Source Builder:

| Source Builder tab | Seed function |
|--------------------|---------------|
| Startup Documents | `buildEssentialDocumentChecklist()` |
| Site Readiness | `buildReadinessChecklist()` |
| Staff Training | `buildFieldsFromOperationalProfile('OPS_STAFF_TRAINING_LOG')` |
| External Sources | `buildFieldsFromOperationalProfile('OPS_EXTERNAL_SOURCE_RECONCILIATION')` |
| Capture Rules | `buildSourceCaptureRuleCatalog()` |

### 2. Study Startup / Regulatory Readiness

Recommended future tables:

| Table | Source |
|-------|--------|
| `study_site_staff_contacts` | `OPS_SITE_CONTACT_ROSTER` |
| `study_training_requirements` | `OPS_STAFF_TRAINING_LOG` |
| `study_essential_document_requirements` | `essential_document_requirements` |
| `study_facility_readiness_items` | `facility_requirements` |
| `study_equipment_readiness_items` | `equipment_requirements` |
| `study_external_source_references` | `OPS_EXTERNAL_SOURCE_RECONCILIATION` |

These tables should feed operational readiness and inspection-readiness views before first subject capture.

### 3. Source Engine Compiler

The `source_capture_rules` array should compile into source metadata, not into visible clinical questions by default.

| Rule | Compiler target |
|------|-----------------|
| `RULE_DATE_COMPLETE` | `validation_rules.allow_partial_date=false` |
| `RULE_TIME_24H` | time parser / field helper |
| `RULE_MISSING_CODE_REASON` | missing-code policy on required fields |
| `RULE_QUERY_FIELD_SCOPE` | validation finding scope metadata |
| `RULE_LOG_FORMS_REPEATABLE` | repeatable section/procedure flag |
| `RULE_CHANGE_REASON` | correction reason required |
| `RULE_ELECTRONIC_SIGNATURE` | signature requirement manifest |
| `RULE_EXTERNAL_SOURCE_REFERENCE` | external source map/evidence strategy |

### 4. Runtime Capture

Runtime should consume the compiled policies:

- Required missing values must use controlled code plus reason.
- Submitted corrections must use reason-for-change.
- Repeating AE/conmed/procedure logs need add-record support.
- Query/finding counts should roll up to response set and field level.
- External systems should be referenced by ID/status, not duplicated as raw source.

---

## Practical Next Step

Wire `buildEssentialDocumentChecklist()` and `buildReadinessChecklist()` into a new Source Builder "Startup Readiness" tab. That gives immediate product value without disturbing the clinical capture flow.

