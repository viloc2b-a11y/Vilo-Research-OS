# Phase 6B.1 — Pathology / Medical History Lookup Library (Design)

**Status:** Planning / design only  
**Parents:** Phase 6A coordinator source builder · [`PHASE6A-SOURCE-BUILDER-WORKSPACE.md`](./PHASE6A-SOURCE-BUILDER-WORKSPACE.md)  
**Seed fixture:** [`fixtures/pathology/pathology-catalog-seed.v1.json`](../fixtures/pathology/pathology-catalog-seed.v1.json)

**This artifact does not implement UI, migrations, billing logic, or ICD adjudication engines.**

---

## 1. Product goal

Provide coordinators a **simple, searchable lookup library** for medical history and relevant diagnoses when capturing or reviewing source data—not a billing or coding engine.

| Goal | Approach |
|------|----------|
| Fast coordinator search | `common_name`, `medical_name`, `synonyms` |
| Controlled vocabulary | Thematic blocks + `active_flag` + dedupe rules |
| Clinical alignment | `medical_name` + optional `icd10_code` |
| Study flexibility | Expand by specialty; do not force exact ICD at first pass |

**Immediate outcome:** Coordinator selects a row → structured values populate medical history fields (e.g. `PROC_MEDICAL_HISTORY` documentation profile)—without free-text chaos or duplicate terms.

---

## 2. Non-goals

| Non-goal | Reason |
|----------|--------|
| Billing / claims ICD engine | Coordinator lookup only |
| Mandatory exact ICD-10 at first selection | General diagnosis first; refine later |
| AI diagnosis | Out of scope |
| Sponsor / CRA workflow | Site-first |
| Duplicate of full problem list intake CRF | Lean selection + notes |

---

## 3. Canonical record structure

Each pathology / medical history lookup row uses these fields:

| Field | Type | Description |
|-------|------|-------------|
| `system` | string (controlled) | Body system or thematic group. Examples: Cardiovascular, Respiratory, Endocrine, Digestive, Musculoskeletal, Mental. |
| `common_name` | string | Plain language label for coordinators. |
| `medical_name` | string | Standardized clinical term. |
| `icd10_code` | string | Diagnostic code (may be general; refinable later). |
| `synonyms` | string[] | Search aliases (comma-separated in workbook import). |
| `chronic_acute` | enum | `Chronic` \| `Acute` \| `Both` |
| `sex_specific` | enum | `Female` \| `Male` \| `Both` \| `Children` (when needed) |
| `pediatric_use` | boolean | Appropriate for pediatric documentation context. |
| `active_flag` | boolean | Activate/deactivate term in search results. |

### 3.1 Logical primary key (planning)

```text
pathology_term_id = hash(system + medical_name + icd10_code)  // or UUID in DB
```

Uniqueness rule: **no duplicate** `(medical_name, icd10_code)` within the same `system` when `active_flag = true`.

---

## 4. Thematic blocks (load order)

Pathology data is organized and loaded by **thematic block** (aligns with ICD chapters at a coordinator-friendly granularity):

| # | Thematic block |
|---|----------------|
| 1 | Infectious and parasitic diseases |
| 2 | Neoplasms |
| 3 | Blood and immune disorders |
| 4 | Endocrine and metabolic disorders |
| 5 | Mental and behavioral disorders |
| 6 | Nervous system |
| 7 | Eye |
| 8 | Ear / ENT |
| 9 | Circulatory system |
| 10 | Respiratory system |
| 11 | Digestive system |
| 12 | Skin |
| 13 | Musculoskeletal system |
| 14 | Genitourinary system |
| 15 | Pregnancy and perinatal conditions |
| 16 | Congenital conditions |
| 17 | Symptoms and signs |
| 18 | Medical history / risk factors |

`system` values in seed data may use short labels (e.g. `Cardiovascular`) mapped to block 9, or block name directly—**import normalizes** to a controlled `system` list in `Value_Lists`.

---

## 5. Seed example rows

Canonical seed (also in JSON fixture):

| system | common_name | medical_name | icd10_code | synonyms | chronic_acute | sex_specific | pediatric_use | active_flag |
|--------|-------------|--------------|------------|----------|---------------|--------------|---------------|-------------|
| Cardiovascular | High blood pressure | Essential hypertension | I10 | HTN, hypertension | Chronic | Both | Yes | Yes |
| Respiratory | Asthma | Asthma, unspecified | J45.909 | Bronchial asthma | Chronic | Both | Yes | Yes |
| Endocrine | Diabetes | Type 2 diabetes mellitus without complications | E11.9 | T2DM | Chronic | Both | Yes | Yes |
| Digestive | GERD | Gastro-esophageal reflux disease without esophagitis | K21.9 | Acid reflux | Chronic | Both | Yes | Yes |
| Musculoskeletal | Osteoarthritis | Osteoarthritis, unspecified site | M19.90 | Arthritis | Chronic | Both | Yes | Yes |
| Mental | Depression | Major depressive disorder, single episode, unspecified | F32.9 | Depression | Chronic | Both | Yes | Yes |

---

## 6. Operational rules

| Rule | Detail |
|------|--------|
| Start with common diagnoses | Seed high-frequency terms first (see §5). |
| Expand by study specialty | Add blocks/rows per therapeutic area (e.g. ophthalmology, endocrine). |
| Synonyms required for search | Every active row should have ≥1 synonym or alias beyond `common_name`. |
| Controlled list prevents duplicates | Import rejects or flags duplicate `(system, medical_name, icd10_code)`. |
| General ICD first | Coordinator may pick `I10` before a more specific code. |
| Refine ICD later | UI may offer “specify code” as optional second step—not required in 6B.1. |
| No exact coding pressure | Copy: “Lookup aid—not for billing.” |
| Deactivate, don’t delete | Use `active_flag = false` to retire terms. |
| Coordinator lookup only | Selection writes to source capture fields; library is not the SoR for subject facts. |

---

## 7. Workbook / source file structure (outside DB)

When maintained in Excel/CSV before database import:

| Sheet | Purpose |
|-------|---------|
| **Catalog_Master** | One row per pathology term (columns below) |
| **Value_Lists** | Controlled values: `chronic_acute`, `sex_specific`, `system` |
| **Instructions** | Coordinator + import rules |
| **Mappings** | Optional map `system` → thematic block # |
| **Audit_Log** | Import batches, row changes (append-only) |

### 7.1 Catalog_Master columns (import contract)

| Column | Maps to |
|--------|---------|
| `System` | `system` |
| `Common_Name` | `common_name` |
| `Medical_Name` | `medical_name` |
| `ICD10_Code` | `icd10_code` |
| `Synonyms` | `synonyms` (pipe or comma separated) |
| `Chronic_Acute` | `chronic_acute` |
| `Sex_Specific` | `sex_specific` |
| `Pediatric_Use` | `pediatric_use` (Y/N, true/false, 1/0) |
| `Active_Flag` | `active_flag` |

---

## 8. Import tooling (workbook / CSV)

**Do not over-engineer.** v1 = one script or admin action: read `Catalog_Master` → validate → upsert active rows.

### 8.1 Import behavior

1. Parse header row; validate required columns present.  
2. Normalize booleans and enums against `Value_Lists`.  
3. Split `Synonyms` into array.  
4. Compute `row_hash` (stable hash of normalized row).  
5. Skip or flag duplicates per §6.  
6. Write `import_batch_id`, append `Audit_Log` entry.

### 8.2 Optional import metadata (per batch / row)

| Field | Purpose |
|-------|---------|
| `source_file_name` | Original workbook/CSV filename |
| `imported_by` | User id |
| `imported_at` | Timestamp |
| `row_hash` | Idempotency / change detection |
| `import_batch_id` | UUID for batch rollback reference |

### 8.3 Proposed npm script (future)

```bash
npm run import:pathology-catalog -- --file path/to/Catalog_Master.csv
```

Report: `tmp/imports/pathology-catalog-import-report.json` (counts, errors, warnings).

---

## 9. Planning-level data concepts

No migrations in 6B.1. Logical tables for 6B.2+:

### `pathology_catalog_terms`

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `system` | text |
| `common_name` | text |
| `medical_name` | text |
| `icd10_code` | text |
| `synonyms` | text[] or jsonb |
| `chronic_acute` | text |
| `sex_specific` | text |
| `pediatric_use` | boolean |
| `active_flag` | boolean |
| `thematic_block` | int 1–18 (optional denormalized) |
| `row_hash` | text |
| `created_at` / `updated_at` | timestamptz |

### `pathology_catalog_import_batches`

| Column | Notes |
|--------|-------|
| `import_batch_id` | uuid |
| `source_file_name` | text |
| `imported_by` | uuid |
| `imported_at` | timestamptz |
| `rows_inserted` / `rows_updated` / `rows_skipped` | int |
| `report_json` | jsonb |

**Tenant scope:** Catalog may be **global seed** or **organization_id** scoped—default global read-only seed + org extensions later.

---

## 10. Coordinator search UX (6B.2 target — minimal)

| Requirement | Implementation hint |
|-------------|-------------------|
| Search box | Match `common_name`, `medical_name`, any `synonyms` |
| Filter by `system` | Dropdown from Value_Lists |
| Filter `active_flag` | Default active only |
| Result row display | `common_name` + `medical_name` + `icd10_code` |
| On select | Populate medical history capture fields (not full CRF) |
| Optional refine ICD | Second step; not required in v1 |

Integrates with Source Builder / capture when `PROC_MEDICAL_HISTORY` (or study-specific history fields) is used.

---

## 11. Integration points

| Consumer | Use |
|----------|-----|
| Medical history procedure profile | `PROC_MEDICAL_HISTORY` — lookup populates summary fields |
| Source Builder | Optional link from field widget `pathology_lookup` |
| Capture runtime | Read-only search API; writes go to `source_responses` via existing RPCs |
| CPST / Field_Definitions | `option_list_code` or external lookup ref—not embedded in CPST workbook v3 initially |

**Does not modify** Phase 5 capture RPCs in 6B.1—lookup is a **UI helper** until explicit API is defined in 6B.2.

---

## 12. Implementation sequence (suggested)

| Phase | Deliverable |
|-------|-------------|
| **6B.1** | This design + seed JSON fixture |
| **6B.2** | DB migration + `pathology_catalog_terms` + import script |
| **6B.3** | Coordinator search component in capture / source review |
| **6B.4** | Org-specific extensions + audit UI |

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Treating as billing ICD engine | UI disclaimer; general codes OK |
| Duplicate terms | Import dedupe + controlled `system` list |
| Over-large catalog | Thematic blocks; `active_flag`; start with seed only |
| Synonym sprawl | Normalize on import; trim whitespace |
| Wrong pediatric/sex filters | Optional filters; default `Both` |

---

## Appendix A — JSON seed shape

See [`fixtures/pathology/pathology-catalog-seed.v1.json`](../fixtures/pathology/pathology-catalog-seed.v1.json).

---

*End of Phase 6B.1 pathology library design.*
