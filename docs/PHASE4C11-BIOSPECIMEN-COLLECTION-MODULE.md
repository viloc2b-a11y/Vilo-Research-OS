# Phase 4C.11 — Biospecimen Collection Domain Module

**Status:** Implemented (dictionary + compilers + canonical source template + golden fixture).

**Canonical baseline:** `fixtures/cpst/biospecimen-canonical-template.json` (Source_Template, Value_Lists, Instructions semantics).

**Parents:** [`PHASE4C2-CANONICAL-JSON-SCHEMAS.md`](./PHASE4C2-CANONICAL-JSON-SCHEMAS.md) · [`PHASE4C4-RUNTIME-GRAPH-COMPILER.md`](./PHASE4C4-RUNTIME-GRAPH-COMPILER.md) · [`PHASE4C5-SOURCE-DEFINITION-COMPILER.md`](./PHASE4C5-SOURCE-DEFINITION-COMPILER.md)

**Baseline:** Phase **3C** GREEN unchanged. Phase **4B** migrations unchanged. Publish migrations **0026–0032** unchanged.

---

## A. Purpose

Optional domain module for **biospecimen collection-only** studies. The generator produces a real source document from **Field_Definitions** (primary dictionary), with the module row supplying capabilities, validation context, and workbook supplements — not synthetic replacement fields.

---

## B. Biospecimen source document section model

| Order | Section (`section_code`) | Procedure code | Operational focus |
|------:|--------------------------|----------------|-------------------|
| 1 | `header` | `BIO_HEADER` | Study/site/subject/collection event timing |
| 2 | `consent` | `BIO_CONSENT` | Consent verification before collection |
| 3 | `specimen` | `BIO_SPECIMEN` | Specimen identity, quantity, collection method |
| 4 | `processing` | `BIO_PROCESS` | Processing/aliquots/temperature |
| 5 | `storage` | `BIO_STORAGE` | Physical storage location and date |
| 6 | `shipping` | `BIO_SHIPPING` | Shipment, courier, tracking, condition |
| 7 | `quality` | `BIO_QUALITY` | Acceptability, deviations, rejection |
| 8 | `closeout` | `BIO_CLOSEOUT` | Source complete and reviewer sign-off |

One **source section** per procedure on the collection visit (matrix-driven). Section display names match the canonical template (Header, Consent, Specimen, …).

---

## C. Full source field dictionary

All capture fields are defined in **Field_Definitions** (48 fields in golden fixture `F-BIO-001` … `F-BIO-048`). Entity mapping:

| Sheet (canonical) | `section_code` | `procedure_id` (golden) |
|-------------------|----------------|-------------------------|
| Source_Template → Header | `header` | `P-BIO-001` |
| Consent | `consent` | `P-BIO-002` |
| Specimen | `specimen` | `P-BIO-003` |
| Processing | `processing` | `P-BIO-004` |
| Storage | `storage` | `P-BIO-005` |
| Shipping | `shipping` | `P-BIO-006` |
| Quality | `quality` | `P-BIO-007` |
| Closeout | `closeout` | `P-BIO-008` |

Schema-native columns: `field_row_id`, `study_template_id`, `field_key`, `section_code`, `display_label`, `data_type`, `is_required`, `procedure_id`, `option_list_code`, `export_name`. Extended workbook columns (Sheet_Name, Entity_Type, Notes) map to `section_code` + `procedure_id` + canonical template rows.

---

## D. Minimum required field set

**Template required = Yes** (28 fields): all fields marked `is_required: true` in golden fixture.

**`biospecimen_minimal_mode`** (15 fields — operational subset):

| Field key |
|-----------|
| `study_protocol` |
| `subject_id` |
| `collection_event` |
| `consent_obtained` |
| `consent_version` |
| `specimen_type` |
| `container_type` |
| `label_id` |
| `quantity_collected` |
| `collection_time` |
| `processed` |
| `storage_location` |
| `sample_acceptable` |
| `deviation_flag` |
| `source_complete` |

Set `biospecimen_minimal_mode: true` and `source_document_mode: "minimal"` on the module row; full studies use `source_document_mode: "full"`.

---

## E. Compiler behavior (module-backed fields)

| Concern | Behavior |
|---------|----------|
| **Source fields** | Emitted **only** from `Field_Definitions` → CRG `FieldNode` → compiler (provenance: Field_Definitions + row ID). |
| **Module row** | CRG `DomainModuleNode` + `runtime_capabilities` + `applies_to` edges; **does not** emit duplicate capture fields. |
| **Validation** | Module adds **compiler-level validation skeletons** (expressions) when the referenced `field_key` exists in Field_Definitions. |
| **Workflow** | `BIOSPECIMEN_REVIEW` when `reviewer_required`; conditional rules from CPST for consent gate, rejection, deviation, closeout. |

**Rule:** Fields should be represented in **Field_Definitions** wherever possible. Module flags express capability/requirements; they do not replace the field dictionary.

---

## F. Data types and value lists

| Template type | Schema `data_type` |
|---------------|---------------------|
| Text | `text` |
| Date | `date` |
| Time | `time` |
| Yes/No | `boolean` |
| Number | `number` |
| Integer | `integer` |
| List | `dropdown` + `option_list_code` |

**Canonical Value_Lists** (golden + `biospecimen-canonical-template.json`):

| List code | Items |
|-----------|--------|
| `SPECIMEN_TYPE` | WHOLE_BLOOD, PLASMA, SERUM, SALIVA, URINE, TISSUE |
| `QUANTITY_UNIT` | ML, UG, PIECES |
| `COLLECTION_CONDITION` | NORMAL, HEMOLYZED, INSUFFICIENT, CONTAMINATED |
| `SHIP_CONDITION` | FROZEN, REFRIGERATED, AMBIENT |

Core CPST **Value_Lists** sheet holds study rows; workbook also generates **Biospecimen_Value_Lists** supplement from canonical JSON.

---

## G. Operational instructions (preserved)

From canonical template — surfaced in workbook **Instructions** sheet and biospecimen preview:

- Do not collect specimen before consent verification.
- Every specimen must have a unique **Label ID**.
- Processing requires date/time/staff attribution.
- Storage location must be explicitly documented.
- Shipment requires destination/courier/tracking when shipped.
- Quality deviations/rejections must be documented.
- **Source complete** only after appropriate review.
- Allowed values derive from Value_Lists.
- Missing data remains blank unless truly zero.

---

## H. Validation expectations (compiler skeletons)

| Rule code | Intent |
|-----------|--------|
| `BIO_CONSENT_BEFORE_COLLECTION` | `consent_obtained == true` before collection workflow |
| `BIO_LABEL_ID_PRESENT` | Label ID traceability |
| `BIO_QTY_POSITIVE` | `quantity_collected > 0` |
| `BIO_PROCESS_AFTER_COLLECTION` | Processing time ≥ collection time (same-day) |
| `BIO_SHIP_AFTER_STORAGE` | Ship date ≥ storage date when both present |
| `BIO_REJECTION_REASON` | Rejection reason when `sample_rejected` |
| `BIO_DEVIATION_DESC` | Deviation description when `deviation_flag` |
| `BIO_CLOSEOUT_REVIEWER` / `BIO_CLOSEOUT_REVIEW_DATE` | Reviewer fields when `source_complete` |

CPST **Conditional_Rules** (`R-BIO-001` … `R-BIO-004`) provide additional workflow hooks.

---

## I. Workbook integration

`npm run generate:workbook` adds biospecimen supplemental sheets from `fixtures/cpst/biospecimen-canonical-template.json`:

| Sheet | Role |
|-------|------|
| `Source_Template` | Human-readable field catalog (section, name, required, type, example, notes) |
| `Biospecimen_Value_Lists` | Canonical list seed reference |
| `Instructions` | Operational rules |

Plus standard **`Biospecimen_Collection_Module`** dictionary sheet and core **`Field_Definitions`** / **`Value_Lists`**.

---

## J. Chain-of-custody model

Module flags (`chain_of_custody_required`, `courier_tracking_required`, …) drive CRG **runtime_capabilities** (`chain_of_custody`, `shipment_tracking`, …). Capture fields (`label_id`, `tracking_number`, `destination_lab`, …) live in Field_Definitions under Specimen/Shipping sections.

---

## K. Anti-patterns

- Synthetic module-only capture fields without Field_Definitions rows.
- UI/RPC/DB migrations in this phase.
- Altering Phase 3C / 4B / publish DDL for biospecimen convenience.
- PHI in analytics paths.

---

## L. QA commands

```bash
npm run schemas:validate
npm run generate:workbook
npm run compile:graph:biospecimen
npm run compile:source:biospecimen
npm run render:source-preview:biospecimen
```

---

## M. Exact next step

Import a biospecimen CPST workbook via `npm run import:workbook`, or copy golden fixture rows into a study workbook. Diff compiler output against `tmp/compiled/source-preview.golden-biospecimen.md`. When publish is approved separately, use existing 4C.8 package builder — no new migrations in 4C.11.
