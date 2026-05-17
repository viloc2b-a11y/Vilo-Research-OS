# Phase 4C.3 — CPST Workbook v3 Generator

**Status:** Implemented.

**Parents:** [`PHASE4C2-CANONICAL-JSON-SCHEMAS.md`](./PHASE4C2-CANONICAL-JSON-SCHEMAS.md) · [`PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md`](./PHASE4C-PROTOCOL-TO-SOURCE-GENERATOR.md)

**Core principle:** Workbook v3 is a **generated editing interface**. JSON Schemas under `vilo-os/schemas/` are the **source of truth**. The workbook is never authoritative over schema.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

Generate `cpst-workbook-v3.xlsx` and a machine-readable `cpst-workbook-v3.manifest.json` from Phase **4C.2** JSON Schemas so that:

- Manual builders and Excel import use the same column contract as the compiler
- Required fields, enums, and validation hints are visible at edit time
- Schema versions and hashes are recorded for audit

---

## B. Generated files

| File | Role |
|------|------|
| `vilo-os/scripts/generate-cpst-workbook-v3.mjs` | Generator (reads schemas, writes XLSX + manifest) |
| `vilo-os/templates/cpst-workbook-v3.xlsx` | Generated workbook |
| `vilo-os/templates/cpst-workbook-v3.manifest.json` | Round-trip / CI manifest |

**Commands:**

```bash
node scripts/validate-schemas.mjs
node scripts/generate-cpst-workbook-v3.mjs
```

**Dependency:** `exceljs` (devDependency). Install: `npm install -D exceljs`

---

## C. Workbook sheets

### Meta / help

| Sheet | Purpose |
|-------|---------|
| `Overview` | High-level orientation |
| `Schema_Version` | Workbook version, generator metadata, schema paths + SHA-256 hashes |
| `Instructions` | Editing rules, required `*`, runtime/domain notes |
| `Controlled_Lists` | Seed enums from `common.schema.json` + parser/registry enums |

### Core (compiler design input)

`Study_Setup`, `Visit_Groups`, `Visit_Templates`, `Procedure_Library`, `Visit_Procedure_Matrix`, `Conditional_Rules`, `Schedule_Windows`, `External_Source_Map`, `Substudy_Map`, `Roles_Signoff`, `Value_Lists`, `Field_Definitions`, `Audit_and_Versioning`

### Runtime support (not compiler design input)

`Visit_Execution_Log` — orange tab, banner row, documented on Instructions

### Domain (optional overlays)

`Oncology_Module`, `Dose_Escalation`, `Crossover_Design`, `Adaptive_Design_Rules`, `Decentralized_Workflows`, `Imaging_Matrix`, `Device_Trial_Controls`, `EDC_Reconciliation`, `ePRO_Workflows`, `Pediatric_Consent_Assent`

---

## D. Schema-to-workbook mapping

For each `*.schema.json` dictionary row schema:

1. Read `properties` in schema key order
2. Reorder columns: **technical IDs first** (per `TECH_ID_KEYS` + `$defs/*ID` refs), then remaining properties, `x_vilo_provenance` last
3. Header = property name; required fields append ` *`
4. Row 2 = `[EXAMPLE]` from schema `examples` / `enum` / `format`
5. Row 3 = `[VALIDATION]` pattern, min/max, enum summary
6. Header cell **comment** = property or `$ref` description
7. Freeze through row 3; data from row 4+

No columns are hardcoded outside schema traversal.

---

## E. Controlled lists / dropdowns strategy

| Source | Controlled_Lists sheet |
|--------|------------------------|
| `common.schema.json` `$defs` enums | Visit Type, Visit Mode, Source Type, Requirement Status, Data Type, Rule Action, Role Name, etc. |
| `Parser_Extraction_Result.schema.json` | Extraction Method, Reviewer Status |
| `Domain_Module_Registry.schema.json` | Module Category |

Named ranges `CL_<List_Name>` reference `Controlled_Lists!$C$start:$C$end`.

Property → list mapping via `PROPERTY_TO_LIST` in generator (e.g. `delivery_mode` → Visit Mode).

**Value_Lists sheet:** Study-specific list items are entered on `Value_Lists` dictionary sheet; workbook does not duplicate dynamic study lists in `Controlled_Lists`.

Inline property `enum` arrays use Excel list validation with comma-separated values.

---

## F. Required field strategy

- Schema `required` array drives ` *` suffix on headers
- Instructions sheet documents the marker
- Required enum/boolean columns: dropdown `allowBlank: false`

---

## G. Validation / roundtrip manifest

`cpst-workbook-v3.manifest.json` includes per sheet:

- `sheet_name`, `schema_path`, `schema_hash`
- `columns`, `required_columns`
- `property_descriptions`, `enum_fields`, `technical_id_columns`
- Workbook-level `generated_at`, `schema_hashes`, `domain_schema_versions`

Future import tooling should validate rows against the same schema paths in the manifest.

---

## H. Limitations

| Limitation | Notes |
|------------|-------|
| Cross-row rules | `window_min ≤ window_max`, conditional rule FKs — compiler/validator only |
| `Value_Lists` dropdowns | Study-specific codes not auto-wired to `Field_Definitions.option_list_code` in v1 generator |
| Sheet protect | Light protection on technical ID columns; full lock after publish is operational policy |
| AJV row validation | Not in workbook generator; use `validate-schemas.mjs` + future import validator |
| Matrix dynamic columns | Visit_Procedure_Matrix remains row-based (`visit_id` + `procedure_id`), not visit-column pivot |

---

## I. Exact next step

1. **`PHASE4C3-PARSER-MAPPING-PLAN.md`** — PDF/Excel/OCR → schema rows + review queue  
2. **Import validator** — workbook/JSON → AJV per `manifest.json`  
3. **Optional:** `npm run generate:workbook` CI check when schemas change  

---

*Regulatory-informed engineering posture only.*
