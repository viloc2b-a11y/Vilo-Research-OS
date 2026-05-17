# Phase 6A.3 — Procedure Documentation Profile Library

**Status:** Planning / schema definition only  
**Parents:** [`PHASE6A-COORDINATOR-SOURCE-BUILDER-PLAN.md`](./PHASE6A-COORDINATOR-SOURCE-BUILDER-PLAN.md) · **[`PHASE6A-SOURCE-BUILDER-WORKSPACE.md`](./PHASE6A-SOURCE-BUILDER-WORKSPACE.md)** (canonical workspace)  
**Machine-readable catalog:** [`fixtures/source-builder/procedure-profile-library.v1.json`](../fixtures/source-builder/procedure-profile-library.v1.json)

**Source reference:** A **complex interventional Schedule of Events** (10+ visits, PK, imaging, ophthalmology, endocrine labs, eDiary, conditional procedures) was used **only** to ensure operational realism. **No protocol name, sponsor label, or protocol-specific identifiers** appear in this library.

**This artifact does not implement UI, migrations, PDF extraction, or auto-publish.**

---

## Design principles

| Principle | Application |
|-----------|-------------|
| **Coordinator-first** | Fields answer: what happened, when, result/status, action needed, where evidence lives |
| **Reusable across studies** | Profiles attach to generic **Visit 1, Visit 2, …** via builder matrix |
| **Library is not rigid** | Global profiles are a **starting point**; coordinators customize per study without engineering |
| **Source Builder is system of record** | All library, overrides, visits, matrix, and PDF review live in one workspace before publish ([`PHASE6A-COORDINATOR-SOURCE-BUILDER-PLAN.md`](./PHASE6A-COORDINATOR-SOURCE-BUILDER-PLAN.md) §2) |
| **Lean operational capture** | No full CRF recreation; no duplicate external systems |
| **Human approval** | Library is curated; coordinators pick, clone, and adapt profiles per visit |
| **Evidence by reference** | Labs/imaging use report/requisition refs, not embedded documents |

---

## A. Complete reusable procedure library

**68 procedure documentation profiles** in **11 categories** (covers every procedure in the SoE reference list plus biologic sample collection from operational practice).

Canonical data: `fixtures/source-builder/procedure-profile-library.v1.json`

### Summary by category

| Category code | Label | Count |
|---------------|-------|------:|
| `CAT_REGULATORY_ENROLLMENT` | Regulatory / Enrollment | 9 |
| `CAT_QUESTIONNAIRE_COA` | Questionnaires / COA / ePRO | 7 |
| `CAT_CLINICAL_REVIEW` | Medical / Clinical Review | 11 |
| `CAT_VITALS_BODY` | Vitals / Body Measurements | 3 |
| `CAT_CARDIAC` | Cardiac | 2 |
| `CAT_LAB_SAMPLE` | Laboratory Sample Collection | 15 |
| `CAT_LAB_PANEL` | Laboratory Panel / Assay | 8 |
| `CAT_IMAGING` | Imaging | 2 |
| `CAT_OPHTHALMOLOGY` | Ophthalmology | 6 |
| `CAT_TREATMENT_IP` | Treatment / IP | 3 |
| `CAT_FOLLOWUP` | Follow-up / Visit Closure | 4 |

### Profile index (procedure_profile_code → display_name)

<details>
<summary>Regulatory / Enrollment (9)</summary>

| Code | Display name |
|------|--------------|
| `PROC_INFORMED_CONSENT` | Informed Consent |
| `PROC_RECONSENT` | Reconsent |
| `PROC_ELIGIBILITY_REVIEW` | Eligibility Review |
| `PROC_INCLUSION_CRITERIA` | Inclusion Criteria Review |
| `PROC_EXCLUSION_CRITERIA` | Exclusion Criteria Review |
| `PROC_RANDOMIZATION` | Randomization |
| `PROC_SUBJECT_TRAINING` | Subject Training |
| `PROC_EDIARY_TRAINING` | eDiary Training |
| `PROC_COUNSELING_EDUCATION` | Counseling / Education |

</details>

<details>
<summary>Questionnaires / COA / ePRO (7)</summary>

| Code | Display name |
|------|--------------|
| `PROC_DAILY_PAIN_REVIEW` | Daily Pain Score Review |
| `PROC_WOMAC` | WOMAC Questionnaire |
| `PROC_EQ5D5L` | EQ-5D-5L |
| `PROC_PGIC` | PGIC |
| `PROC_WPAI` | WPAI |
| `PROC_EDIARY_RECONCILIATION` | eDiary Reconciliation |
| `PROC_COA_REVIEW` | COA Review |

</details>

<details>
<summary>Medical / Clinical Review (11)</summary>

| Code | Display name |
|------|--------------|
| `PROC_MEDICAL_HISTORY` | Medical History |
| `PROC_OPHTHAL_HISTORY` | Ophthalmologic History |
| `PROC_PHYSICAL_EXAM` | Physical Examination |
| `PROC_TARGETED_PHYSICAL_EXAM` | Targeted Physical Examination |
| `PROC_AE_REVIEW` | Adverse Event Review |
| `PROC_SAE_REVIEW` | Serious Adverse Event Review |
| `PROC_CONMED_REVIEW` | Concomitant Medication Review |
| `PROC_RESCUE_MED_REVIEW` | Rescue Medication Review |
| `PROC_NONPHARM_THERAPY_REVIEW` | Non-Pharmacologic Therapy Review |
| `PROC_ADRENAL_SYMPTOM_REVIEW` | Adrenal Insufficiency Symptom Review |

</details>

<details>
<summary>Vitals / Body (3) · Cardiac (2)</summary>

| Code | Display name |
|------|--------------|
| `PROC_VITAL_SIGNS` | Vital Signs |
| `PROC_HEIGHT` | Height |
| `PROC_WEIGHT` | Weight |
| `PROC_ECG_12LEAD` | 12-lead ECG |
| `PROC_ECG_PK` | PK ECG Collection |

</details>

<details>
<summary>Laboratory (22)</summary>

| Code | Display name |
|------|--------------|
| `PROC_BIOLOGIC_SAMPLE_COLLECTION` | Biologic Sample Collection |
| `PROC_BLOOD_COLLECTION` | Blood Collection |
| `PROC_URINALYSIS_DIPSTICK` | Urinalysis Dipstick |
| `PROC_PREGNANCY_TEST` | Pregnancy Test |
| `PROC_HEMATOLOGY` | Hematology |
| `PROC_COAGULATION` | Coagulation |
| `PROC_CLINICAL_CHEMISTRY` | Clinical Chemistry |
| `PROC_BIOMARKER_COLLECTION` | Biomarker Collection |
| `PROC_SERUM_BIOMARKER` | Serum Biomarker Collection |
| `PROC_PK_PLASMA` | PK Plasma Sample |
| `PROC_MORNING_CORTISOL` | Morning Cortisol Collection |
| `PROC_ACTH_COLLECTION` | ACTH Collection |
| `PROC_ALDOSTERONE_COLLECTION` | Aldosterone Collection |
| `PROC_PRC_PRA_COLLECTION` | PRC/PRA Collection |
| `PROC_DHEAS_COLLECTION` | DHEA-S Collection |
| `PROC_CBG_COLLECTION` | Cortisol-binding Globulin Collection |
| `PROC_SYNTHETIC_STEROID_PANEL` | Synthetic Steroid Panel |
| `PROC_GLUCOCORTICOID_SCREEN` | Glucocorticoid Screen |
| `PROC_ACTH_STIM_TEST` | ACTH Stimulation Test |
| `PROC_ANTI_PF4` | Anti-PF4 Testing |
| `PROC_SEROTONIN_RELEASE_ASSAY` | Serotonin Release Assay |
| `PROC_DDIMER_COLLECTION` | D-dimer Collection |
| `PROC_FIBRINOGEN_COLLECTION` | Fibrinogen Collection |

</details>

<details>
<summary>Imaging (2) · Ophthalmology (6) · Treatment / IP (3) · Follow-up (4)</summary>

| Code | Display name |
|------|--------------|
| `PROC_XRAY` | X-Ray |
| `PROC_MRI` | MRI |
| `PROC_OPHTHAL_EXAM` | Ophthalmology Examination |
| `PROC_OCT_REVIEW` | OCT Review |
| `PROC_RETINAL_EXAM` | Retinal Examination |
| `PROC_CFP_IMAGING` | CFP Imaging |
| `PROC_FAF_IMAGING` | FAF Imaging |
| `PROC_IP_ADMINISTRATION` | IP Administration |
| `PROC_INJECTION_SITE_ASSESS` | Injection Site Assessment |
| `PROC_POST_DOSE_OBSERVATION` | Post-dose Observation |
| `PROC_TELEPHONE_FOLLOWUP` | Telephone Follow-up |
| `PROC_REMOTE_FOLLOWUP` | Remote Follow-up |
| `PROC_EOS_ASSESSMENT` | EOS Assessment |
| `PROC_ET_ASSESSMENT` | Early Termination Assessment |

</details>

Each profile in the JSON includes all nine required attributes:

1. `procedure_profile_code`  
2. `display_name`  
3. `category`  
4. `operational_purpose`  
5. `documentation_style`  
6. `minimal_operational_fields` (via `field_template` + `field_overrides`)  
7. `optional_fields` (via template)  
8. `evidence_reference_strategy`  
9. `conditional_logic_examples`  

---

## B. Procedure categories

Categories are **operational groupings** for library search and UI filters—not protocol arms.

| Code | Coordinator use |
|------|-----------------|
| `CAT_REGULATORY_ENROLLMENT` | Consent, eligibility, randomization, training |
| `CAT_QUESTIONNAIRE_COA` | PRO/COA completion and reconciliation |
| `CAT_CLINICAL_REVIEW` | History, exam, safety reviews |
| `CAT_VITALS_BODY` | Vitals and anthropometrics |
| `CAT_CARDIAC` | ECG procedures |
| `CAT_LAB_SAMPLE` | Specimen collection events |
| `CAT_LAB_PANEL` | Result summaries for sent panels |
| `CAT_IMAGING` | Radiology procedures |
| `CAT_OPHTHALMOLOGY` | Eye exam and imaging |
| `CAT_TREATMENT_IP` | IP and post-dose monitoring |
| `CAT_FOLLOWUP` | Remote contacts and visit closure |

---

## C. Minimal operational field definitions

Fields are defined once per **field template** (`TMPL_*`); profiles reference a template and optional **field_overrides** (semantic rename only).

### Shared field catalog (`procedure_documentation_fields`)

| field_key | data_type | Typical label | Required in templates |
|-----------|-----------|---------------|------------------------|
| `performed_datetime` | datetime | Performed date/time | vitals, ECG, exam, UA |
| `collection_datetime` | datetime | Collection date/time | lab sample |
| `administration_datetime` | datetime | Administration date/time | IP |
| `contact_datetime` | datetime | Contact date/time | remote |
| `reviewed_datetime` | datetime | Reviewed date/time | safety, clinical |
| `completion_datetime` | datetime | Completion date/time | questionnaires |
| `performed_date` | date | Performed date | imaging |
| `consent_version` / `document_version` | string | Document version | regulatory |
| `consent_obtained` / `action_completed` | boolean | Completed | regulatory |
| `copy_provided` | boolean | Copy provided to subject | consent |
| `criteria_met` | boolean | Criteria met | eligibility |
| `deviations_noted` | boolean | Deviations noted | eligibility |
| `training_completed` | boolean | Training completed | training |
| `completed` | boolean | Completed | questionnaire |
| `systolic_bp` | number | Systolic BP (mmHg) | vitals |
| `diastolic_bp` | number | Diastolic BP (mmHg) | vitals |
| `heart_rate` | number | Heart rate | vitals |
| `temperature` | number | Temperature | vitals (optional) |
| `measurement_value` | number | Value | height/weight |
| `unit` | string | Unit | height/weight |
| `result_summary` | string | Result summary | ECG, labs, imaging |
| `clinically_significant` | boolean | Clinically significant | vitals, ECG, imaging |
| `abnormal_flag` | boolean | Abnormal | labs |
| `action_taken` | string | Action taken | labs |
| `repeat_required` | boolean | Repeat required | ECG, imaging |
| `report_reference` | string | Report reference ID | external evidence |
| `lab_requisition_ref` | string | Lab requisition ref | samples |
| `lab_report_ref` | string | Lab report ref | panels |
| `within_window` | boolean | Within collection window | PK, timed labs |
| `relative_to_dose_time` | string | Relative to dose | PK |
| `route` | string | Route | IP |
| `dose` | string | Dose | IP |
| `administration_completed` | boolean | Administration completed | IP |
| `post_dose_observation_completed` | boolean | Post-dose obs completed | IP |
| `issues` | string | Issues | IP |
| `ae_present` / `event_present` | boolean | Events present | safety |
| `log_updated` | boolean | Log updated | safety |
| `changes_since_last_visit` | boolean | Changes since last visit | conmed |
| `contact_method` | string | Contact method | remote |
| `subject_reached` | boolean | Subject reached | remote |
| `closure_type` | string | Closure type | EOS/ET |
| `comments` | string | Comments | all (optional) |

### Worked examples (minimal + optional)

**Informed Consent** (`PROC_INFORMED_CONSENT` → `TMPL_REGULATORY_ATTEST`)

| Field | Required |
|-------|----------|
| `performed_datetime` (consent_datetime) | yes |
| `consent_version` | yes |
| `consent_obtained` | yes |
| `copy_provided` | yes |
| `comments` | optional |

**Vital Signs** (`PROC_VITAL_SIGNS` → `TMPL_VITALS`)

| Field | Required |
|-------|----------|
| `performed_datetime` | yes |
| `systolic_bp`, `diastolic_bp`, `heart_rate` | yes |
| `clinically_significant` | yes |
| `temperature`, `comments` | optional |

**Blood Collection / PK Plasma** (`TMPL_LAB_SAMPLE`)

| Field | Required |
|-------|----------|
| `collection_datetime` | yes |
| `sample_collected`, `within_window` | yes |
| `processing_datetime`, `relative_to_dose_time`, `abnormal_flag`, `action_taken`, `lab_requisition_ref`, `comments` | optional |

**12-lead ECG** (`TMPL_ECG`)

| Field | Required |
|-------|----------|
| `performed_datetime`, `result_summary`, `clinically_significant` | yes |
| `repeat_required`, `report_reference`, `comments` | optional |

**MRI** (`TMPL_IMAGING`)

| Field | Required |
|-------|----------|
| `performed_date`, `procedure_completed`, `result_summary`, `clinically_significant` | yes |
| `report_reference`, `comments` | optional |

**IP Administration** (`TMPL_IP_ADMIN`)

| Field | Required |
|-------|----------|
| `administration_datetime`, `route`, `dose`, `administration_completed` | yes |
| `post_dose_observation_completed`, `issues`, `comments` | optional |

**AE Review** (`TMPL_SAFETY_REVIEW`)

| Field | Required |
|-------|----------|
| `reviewed_datetime`, `ae_present`, `ae_log_updated` | yes |
| `comments` | optional |

**Concomitant Medication Review**

| Field | Required |
|-------|----------|
| `reviewed_datetime`, `changes_since_last_visit`, `conmed_log_updated` | yes |
| `comments` | optional |

**Questionnaire / COA** (`TMPL_QUESTIONNAIRE`)

| Field | Required |
|-------|----------|
| `completed`, `completion_datetime` | yes |
| `missing_items`, `score_summary`, `comments` | optional |

**Remote Follow-up** (`TMPL_REMOTE_CONTACT`)

| Field | Required |
|-------|----------|
| `contact_datetime`, `contact_method`, `subject_reached` | yes |
| `ae_review_completed`, `conmed_review_completed`, `followup_required`, `comments` | optional |

---

## D. Planning tables (conceptual — no migrations in 6A.3)

### 1. `procedure_documentation_profiles`

Reusable profile header (org-agnostic library; may be global seed).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `procedure_profile_code` | text unique | e.g. `PROC_VITAL_SIGNS` |
| `display_name` | text | Coordinator-facing |
| `category` | text | `CAT_*` |
| `operational_purpose` | text | Short description |
| `documentation_style` | text | `STYLE_*` |
| `evidence_reference_strategy` | text | See §E |
| `field_template_code` | text | `TMPL_*` |
| `default_owner_role` | text | Default `coordinator` |
| `repeatable` | boolean | Per visit |
| `active` | boolean | Library soft-delete |
| `library_version` | text | `1.0.0` |

### 2. `procedure_documentation_fields`

Normalized fields per template (maps to CPST `Field_Definitions` at export).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `field_template_code` | text | FK logical to template |
| `field_key` | text | Stable key |
| `display_label` | text | UI label |
| `data_type` | text | datetime, boolean, number, string |
| `is_required` | boolean | Minimal vs optional |
| `sort_order` | int | Form order |
| `widget_hint` | text | text, number, boolean, datetime, textarea |
| `option_list_code` | text nullable | Controlled lists |

### 3. `procedure_template_library`

Join table: profile + field overrides for variants.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `procedure_profile_code` | text | FK |
| `field_key` | text | Override target |
| `override_label` | text nullable | Display rename |
| `force_required` | boolean nullable | Promote to minimal |

### 4. `study_builder_visit_templates`

Generic visit slots (not protocol-named).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `organization_id` | uuid | Tenant |
| `study_id` | uuid | FK |
| `visit_template_code` | text | e.g. `VISIT_01` |
| `visit_label` | text | Coordinator editable (“Visit 1”) |
| `visit_group` | text | Screening, Treatment, Follow-up, Closeout |
| `planned_day` | int nullable | Study day anchor |
| `window_start_day` | int nullable | Window |
| `window_end_day` | int nullable | Window |
| `delivery_mode` | text | onsite, phone, hybrid |
| `sort_order` | int | |

### 5. `study_builder_visit_procedures`

Matrix: which profiles attach to which visit template.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `visit_template_id` | uuid | FK |
| `procedure_profile_code` | text | FK to profile library |
| `matrix_marker` | text | required, optional, conditional |
| `conditional_flag` | boolean | |
| `condition_summary` | text nullable | Human-readable; not executable rules |
| `execution_order` | int | |
| `notes` | text nullable | From SoE footnotes |
| `confidence` | text nullable | For PDF extract path |
| `row_status` | text | proposed, active, rejected |

**Export path:** `study_builder_visit_procedures` + profiles → `Procedure_Library` + `Visit_Procedure_Matrix` + `Field_Definitions` rows in CPST import JSON.

> **Note:** Builder tables below are subsumed by the unified **Source Builder** draft model in Phase 6A §4. `study_builder_*` rows are logical aliases of `source_builder_draft_*` during migration planning.

---

## J. Coordinator customization layer

The global library (`procedure-profile-library.v1.json`) is **read-mostly seed data**. Coordinators must adapt templates per study/protocol in the **Source Document Builder workspace** — not via engineering tickets.

### J.1 What coordinators can do (no-code)

| Capability | Mechanism | `source_override_type` |
|------------|-----------|------------------------|
| Add fields | `study_procedure_field_overrides` or `custom_procedure_fields` | `add` |
| Edit fields | Label, required, order, helper text, visibility | `edit` |
| Disable fields | `hidden=true` on override | `disable` |
| Custom procedures | `custom_procedure_templates` + fields | n/a (new entity) |
| Clone procedures | `study_procedure_template_overrides` + `clone_lineage_id` | clone of `base_procedure_template_id` |
| Study variations | Draft-scoped overrides on top of global | mixed |

**Examples:**

- **Vitals** (`PROC_VITAL_SIGNS`) cloned to **Pre-dose Vitals**, **Post-dose Vitals**, **Supine Vitals** — same base fields, different `custom_name` and optional added fields (`position`, `minutes_post_dose`).
- **PK Plasma** — add `vendor_collection_id` field for central lab without changing global library.
- **Informed Consent** — add `sponsor_witness_name` for site SOP without forking the whole profile in code.

### J.2 Planning tables (customization)

#### `study_procedure_template_overrides`

| Column | Type |
|--------|------|
| `override_id` | uuid PK |
| `study_template_id` | text |
| `draft_id` | uuid nullable |
| `base_procedure_template_id` | text — `procedure_profile_code` |
| `custom_name` | text |
| `documentation_style` | text nullable |
| `created_by` | uuid |
| `created_at` | timestamptz |
| `clone_lineage_id` | uuid nullable |

#### `study_procedure_field_overrides`

| Column | Type |
|--------|------|
| `override_field_id` | uuid PK |
| `study_template_id` | text |
| `draft_id` | uuid nullable |
| `draft_procedure_id` | uuid |
| `base_field_id` | uuid nullable |
| `base_field_key` | text nullable |
| `custom_field_code` | text |
| `display_label` | text |
| `data_type` | text |
| `required` | boolean |
| `hidden` | boolean |
| `display_order` | int |
| `helper_text` | text nullable |
| `conditional_rule` | text nullable |
| `source_override_type` | text — `add` \| `edit` \| `disable` |

#### `custom_procedure_templates`

| Column | Type |
|--------|------|
| `custom_template_id` | uuid PK |
| `study_template_id` | text |
| `draft_id` | uuid |
| `custom_name` | text |
| `category` | text |
| `documentation_style` | text |
| `operational_notes` | text nullable |
| `created_by` | uuid |
| `created_at` | timestamptz |

#### `custom_procedure_fields`

| Column | Type |
|--------|------|
| `custom_field_id` | uuid PK |
| `custom_template_id` | uuid FK |
| `field_code` | text |
| `display_label` | text |
| `data_type` | text |
| `required` | boolean |
| `display_order` | int |
| `helper_text` | text nullable |

### J.3 Lineage and versioning

| Requirement | Table / field |
|-------------|---------------|
| Who modified | `source_builder_template_versions.modified_by` |
| When | `modified_at` |
| From which base | `base_template_ref` / `base_procedure_template_id` |
| Version history | Append-only `source_builder_template_versions`; draft `version` integer on `source_builder_drafts` |
| Publish audit | `source_builder_publish_versions` + existing `source_publish_approval_evidence` |

### J.4 Effective configuration (export)

```text
For each draft_procedure_id in draft:
  IF custom_template_id → use custom_procedure_fields
  ELSE IF override_id → merge base profile fields + study_procedure_field_overrides
  ELSE → copy from procedure_profile_code field_template
  APPLY source_builder_draft_fields (draft-session edits)
  EMIT Field_Definitions[] + Procedure_Library row
```

PDF-imported proposals materialize as **draft rows** with `import_row_status`; coordinator edits use the **same override mechanisms** as manual entry.

### J.5 UX principles

- Inline edit: labels, required toggle, drag reorder fields  
- “Clone procedure” from library picker  
- “Add field” with type picker (string, number, boolean, datetime)  
- Disable = hide in capture preview, not delete from global library  
- No JSON/YAML editor in v1  

### J.6 Anti-patterns (do not build)

| Anti-pattern | Why |
|--------------|-----|
| Immutable global profiles | Blocks real-site workflow |
| Per-study engineering | Defeats product goal |
| Separate PDF review app | Fragments coordinator mental model |
| Auto-publish after OCR | Safety violation |
| Enterprise rules engine in v1 | Coordinator uses `conditional_rule` text |

---

## E. Documentation styles

| Style code | Use when | Typical field template |
|------------|----------|------------------------|
| `STYLE_REGULATORY_ATTEST` | Consent, randomization | `TMPL_REGULATORY_ATTEST` |
| `STYLE_ELIGIBILITY_CHECK` | I/E criteria | `TMPL_ELIGIBILITY_CHECK` |
| `STYLE_TRAINING_ATTEST` | Training, counseling | `TMPL_TRAINING_ATTEST` |
| `STYLE_QUESTIONNAIRE` | COA/ePRO/diary | `TMPL_QUESTIONNAIRE` |
| `STYLE_CLINICAL_REVIEW` | History, exam | `TMPL_CLINICAL_REVIEW` |
| `STYLE_VITALS` | Vital signs | `TMPL_VITALS` |
| `STYLE_BODY_MEASURE` | Height, weight | `TMPL_BODY_MEASURE` |
| `STYLE_ECG` | ECG | `TMPL_ECG` |
| `STYLE_LAB_SAMPLE` | Specimen draw | `TMPL_LAB_SAMPLE` |
| `STYLE_LAB_PANEL` | Panel result | `TMPL_LAB_PANEL` |
| `STYLE_URINALYSIS` | Dipstick | `TMPL_URINALYSIS` |
| `STYLE_PREGNANCY_TEST` | Pregnancy test | `TMPL_PREGNANCY_TEST` |
| `STYLE_IMAGING` | X-ray, MRI | `TMPL_IMAGING` |
| `STYLE_OPHTHAL_EXAM` | Eye procedures | `TMPL_OPHTHAL_EXAM` |
| `STYLE_IP_ADMIN` | IP dosing | `TMPL_IP_ADMIN` |
| `STYLE_INJECTION_SITE` | Injection assessment | `TMPL_INJECTION_SITE` |
| `STYLE_POST_DOSE_OBS` | Observation period | `TMPL_POST_DOSE_OBS` |
| `STYLE_SAFETY_REVIEW` | AE/CM/rescue | `TMPL_SAFETY_REVIEW` |
| `STYLE_REMOTE_CONTACT` | Phone/remote | `TMPL_REMOTE_CONTACT` |
| `STYLE_VISIT_CLOSURE` | EOS/ET | `TMPL_VISIT_CLOSURE` |

### Evidence reference strategies

| Strategy | Meaning |
|----------|---------|
| `none` | Source is self-contained |
| `optional_note` | Free-text pointer acceptable |
| `optional_external_ref` | ID/reference if available |
| `external_report_ref` | ECG/imaging report ID expected |
| `lab_requisition_ref` | Requisition / accession |
| `lab_report_ref` | Central lab report |
| `imaging_report_ref` | PACS / radiology report |
| `ediary_system_ref` | eDiary vendor record |
| `pharmacy_record_ref` | IP accountability record |

---

## F. Conditional procedure examples

Conditions are **documented on the matrix row** (`condition_summary`) for coordinator interpretation—not auto-executed protocol logic.

| Pattern | Example profiles | Matrix notation |
|---------|------------------|-----------------|
| **Visit-type conditional** | `PROC_ET_ASSESSMENT` | Only on ET visit row |
| **Gender / WOCBP** | `PROC_PREGNANCY_TEST` | `conditional_flag=true`, “WOCBP only” |
| **Prior event** | `PROC_RECONSENT` | “After amendment effective” |
| **Symptom-triggered** | `PROC_ACTH_STIM_TEST` | “If adrenal insufficiency suspected” |
| **Safety-triggered** | `PROC_ANTI_PF4`, `PROC_SEROTONIN_RELEASE_ASSAY` | “If thrombocytopenia / HIT concern” |
| **Time-relative to IP** | `PROC_PK_PLASMA`, `PROC_ECG_PK` | “Within PK window relative to dose” |
| **Time-of-day** | `PROC_MORNING_CORTISOL` | “Morning collection window” |
| **Sub-study optional** | `PROC_BIOMARKER_COLLECTION` | `matrix_marker=optional` |
| **eDiary-dependent** | `PROC_DAILY_PAIN_REVIEW`, `PROC_EDIARY_RECONCILIATION` | “While eDiary period active” |
| **Repeated per schedule** | `PROC_VITAL_SIGNS`, `PROC_CONMED_REVIEW` | Required on most onsite visits |

Maps to CPST `Visit_Procedure_Matrix.conditional_flag` + `condition_rule_id` (future rules engine **out of scope**).

---

## G. Runtime integration points

```text
procedure_profile_library.v1.json (global seed)
  → Source Builder workspace (draft + overrides + customization)
  → effective Field_Definitions + Procedure_Library + Visit_Procedure_Matrix
  → compile-cpst-runtime-graph.mjs
  → compile-source-definitions.mjs
  → publish_source_package
  → source_fields (Phase 4A)
  → open_source_response_set / capture UI
```

PDF path merges into the **same** middle step:

```text
PDF → source_builder_import_job → populate source_builder_draft_* → workspace edit → export
```

| Layer | Integration |
|-------|-------------|
| **Library seed** | `fixtures/source-builder/procedure-profile-library.v1.json` |
| **CPST** | `Procedure_Library.procedure_code` ← `procedure_profile_code`; fields ← `procedure_documentation_fields` |
| **Compiler** | One source section per (visit × procedure) per `PHASE4C5` |
| **Publish** | `publish_source_package` — coordinator role allowed |
| **Capture** | Existing widgets from `data_type` / `widget_hint` |
| **Operational schedule** | Optional sync to `visit_definitions` / `visit_def_procedure_map` (future) |

**Mapping rule:** `procedure_profile_code` becomes `procedure_code` in CPST; `display_name` → `procedure_label`; `category` → controlled category code.

---

## H. Risks if over-documented

| Risk | Symptom | Guardrail |
|------|---------|-----------|
| **CRF duplication** | 50+ fields per procedure | Cap minimal fields per template; use `result_summary` |
| **Embedded documents** | PDF upload per procedure | Evidence refs only |
| **Executable protocol logic** | Auto-skip visits | Conditions as text + coordinator judgment |
| **Lab value entry** | Full analyte grids | Panel = summary + abnormal flag + ref |
| **Mixed sample vs result** | Duplicate rows | `STYLE_LAB_SAMPLE` vs `STYLE_LAB_PANEL` split |
| **Ophthalmology overkill** | Full grading scales | Exam summary + clinically_significant |
| **COA duplication** | Re-enter all answers | `completed` + reconciliation refs |
| **Protocol naming leak** | Sponsor-specific codes | Profile codes are generic `PROC_*` only |
| **Rigid library** | Coordinator escalations to engineering | Override layer + Source Builder workspace |
| **Override drift** | Published capture ≠ preview | Effective-field merge at export; version snapshots |

---

## I. Recommended next implementation step

**Phase 6A.3 implementation — Source Builder workspace**

1. Load `procedure-profile-library.v1.json` as browse-only seed.  
2. Implement `source_builder_drafts` + visits + procedures + **draft_fields** + matrix.  
3. Implement override tables (§J.2) and effective-field merge (§J.4).  
4. UI: clone procedure, add/disable field, custom procedure wizard.  
5. Export → validate → publish → capture smoke test.

**Do not** start PDF import until customization + clone + publish work in the unified workspace.

---

## Appendix — Output checklist

| Output | Location |
|--------|----------|
| **A. Complete library** | JSON: 68 profiles; §A index |
| **B. Categories** | §B + JSON `categories` |
| **C. Field definitions** | §C + JSON `field_templates` |
| **D. Planning tables** | §D |
| **E. Documentation styles** | §E |
| **F. Conditional examples** | §F + per-profile `conditional_logic_examples` in JSON |
| **G. Runtime integration** | §G |
| **H. Over-documentation risks** | §H |
| **I. Next step** | §I |
| **J. Customization layer** | §J |

---

*End of Phase 6A.3 planning document.*

