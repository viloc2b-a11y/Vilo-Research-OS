# INCEPTION CRF Guidelines — Source Production Assessment

**Status:** Production input assessment  
**Reviewed file:** `10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).pdf`  
**Document identity:** Novartis CRF Completion Guidelines, protocol `CKJX839A1US01`, version 2.0, effective 03-Nov-2021.  
**Assessment date:** 2026-05-19  
**Applies to:** Vilo Research Source Builder, runtime capture, validation findings, query workflow, correction/addendum model, procedure profile library.

---

## Decision

**Yes, this document contributes to Source creation in Vilo Research, but it should not be imported as a full protocol or copied as-is.**

It is not a Schedule of Activities, protocol synopsis, source template package, or universal field dictionary. It is a study-specific CRF completion guide for an EDC workflow. Its strongest value for Vilo is the operational logic around how capture fields behave, when forms appear, how missing/unknown values are handled, how queries are managed, and what procedure-level fields are expected for common clinical assessments.

Use it as a **production reference for eSource behavior and reusable procedure profile enrichment**, not as a direct source package generator.

---

## What the document contains

The document covers:

| Area | Relevance to Vilo Source |
|------|--------------------------|
| General data entry rules | High |
| Subject creation / numbering | Medium; Vilo already owns subject identity differently |
| ePRO registration and account management | Medium; useful as external-system reference workflow |
| Field types | High: text, radio/check, dropdown, date, time |
| Missing data handling | High: `ND`, `UNK`, `NA`, blank with query, override reason |
| Dynamic branching | High: conditional questions/forms based on prior answers |
| Repeating records | High: repeat CRFs for medical history, AE, procedures, unscheduled assessments |
| Query management | High: system and manual queries, open/answered counts, field-level query indicators |
| Visit / form guidance | High: consent, eligibility, demographics, history, vitals, labs, ECG, urinalysis, randomization, IP injection, ePRO, dispositions, conmeds, AE, procedures, hospitalization, ER, other visits, consent withdrawal |
| Sponsor-specific content | Low; do not reuse Novartis, UBC Pathways, protocol identifiers, inclisiran-specific dose as generic defaults |

---

## Production Impact

### 1. Source Builder should support CRF completion guidance as first-class metadata

The document is organized as "Question Completion Guidance" tables. Vilo should represent this pattern in Source Builder as field-level and section-level metadata:

| CRF guide concept | Vilo production target |
|-------------------|------------------------|
| Form guidance paragraph | `source_sections.instructions` / section helper text |
| Question completion guidance | `source_fields.instructions` |
| "If No, provide reason not done" | conditional required field rule |
| "Complete date required" | date completeness validation |
| "24-hour clock" | time input validation and helper |
| "Clinically significant abnormality" | normal/abnormal + AE workflow trigger |
| "Collected at Visit X and Unscheduled" | visit × procedure matrix row |

**Action:** Extend Source Builder authoring UX to make instructions editable and visible in runtime capture.

### 2. Missing data requires a structured reason model

The guide distinguishes:

| Missing state | Meaning |
|---------------|---------|
| `ND` | Not Done |
| `UNK` | Unknown |
| `NA` | Not Applicable |
| blank | May trigger query; acceptable only when no coded option exists |
| override missing value | Requires reason/comment |

Vilo should not treat missing regulated data as a plain empty string. A production source response needs:

| Field | Purpose |
|-------|---------|
| `missing_code` | `ND`, `UNK`, `NA`, `not_available`, or controlled equivalent |
| `missing_reason` | Human-readable reason |
| `missing_confirmed_by` | Actor |
| `missing_confirmed_at` | Server UTC |
| `finding_id` | Link to validation/query finding if applicable |

**Action:** Add a Source Builder/runtime requirement: required fields may be satisfied by a permitted missing code only when the field definition allows it and a reason is captured.

### 3. Query management maps directly to Vilo findings

The guide describes open queries generated automatically by validation or manually by CRA/Data Management, plus answered/open counts and field-level indicators.

Vilo already has `source_response_validation_findings` and finding action APIs. This document supports making that workflow more production-like:

| CRF guide behavior | Vilo target |
|--------------------|-------------|
| Open query count per form | response-set finding summary |
| Field-level query indicator | capture field finding badge |
| System-generated discrepancy | validation finding |
| Manual query by CRA/DM | monitor-created finding |
| Query answered/resolved | finding event timeline |
| Data changed after query | correction with reason + finding resolution link |

**Action:** Treat this as evidence that Vilo findings should be field-scoped, countable at form/visit level, and visible in capture and read views.

### 4. Conditional branching should be in the source definition, not hardcoded UI

The guide shows two branching patterns:

| Branch trigger | Result |
|----------------|--------|
| Demographics sex = female | child-bearing potential question appears |
| Treatment group = inclisiran + usual care | study treatment injection form appears |

Vilo should support this at two levels:

| Level | Production behavior |
|-------|---------------------|
| Field visibility | Show/hide questions within a source section |
| Form/procedure activation | Show/create procedure source form based on prior value or matrix condition |

**Action:** Add a conditional-rule authoring target to Source Builder: `trigger_field`, `operator`, `value`, `target_field_or_section`, `effect`, and human-readable condition summary.

### 5. Repeating records and unscheduled visits are mandatory production behavior

The guide repeatedly uses additional CRFs and unscheduled visits for real-world capture:

- Multiple medical history rows.
- Additional AE records when more events occur.
- Unplanned labs recorded in an unscheduled visit.
- Procedures, hospitalization, emergency room visits, and other clinical visits as repeatable records.

**Action:** Source definitions need a `repeatable` flag and runtime add-row/add-record capability for selected sections or procedures. Unscheduled visit capture should attach the procedure to an unscheduled visit context, not force it into the nearest scheduled visit.

---

## Procedure Library Enrichment

The document reinforces and slightly extends existing procedure profiles in `fixtures/source-builder/procedure-profile-library.v1.json`.

| Procedure | Existing Vilo profile | Recommended production enrichment |
|-----------|-----------------------|-----------------------------------|
| Informed consent | `PROC_INFORMED_CONSENT` | consent date, version, age at consent, copy provided, withdrawal linkage |
| Inclusion / exclusion | `PROC_INCLUSION_CRITERIA`, `PROC_EXCLUSION_CRITERIA` | criteria met, exceptions/deviations, screen failure trigger |
| Demographics | Missing as explicit profile | add `PROC_DEMOGRAPHICS` or keep in subject clinical profile; supports sex-triggered branch |
| ACS medical history | Missing as generic cardiovascular history | add study-specific override from `PROC_MEDICAL_HISTORY`, not global generic default |
| Statin intolerance | Missing as generic medication intolerance/history | add as study-specific custom procedure or clinical history section |
| Smoking status | Missing | add optional lifestyle profile or subject clinical profile field |
| Vital signs | `PROC_VITAL_SIGNS`, `PROC_HEIGHT`, `PROC_WEIGHT` | include height/weight visit scope, pulse, BP systolic/diastolic, BP position, clinically significant abnormality rule |
| Central laboratory | `PROC_HEMATOLOGY`, `PROC_CLINICAL_CHEMISTRY`, etc. | add panel grouping: pregnancy, hematology, chemistry, hepatitis, lipoproteins, coagulation, fasting glucose, biobank |
| ECG | `PROC_ECG_12LEAD` | date, time, clinically significant abnormality, AE/medical history routing |
| Urinalysis | `PROC_URINALYSIS_DIPSTICK` | dipstick result, microscopic exam performed, microscopic result, clinically significant abnormality |
| Randomization | `PROC_RANDOMIZATION` | date must match baseline visit date; treatment group drives downstream form/procedure |
| Study treatment injection | `PROC_IP_ADMINISTRATION` | administered yes/no, missed/interrupted reason, date, dose form, dose, units, route, anatomical location |
| ePRO questionnaires | `PROC_COA_REVIEW`, questionnaire profiles | external ePRO completion/reconciliation, not full answer duplication |
| Disposition | `PROC_EOS_ASSESSMENT`, `PROC_ET_ASSESSMENT` | screening disposition, treatment disposition, study completion/exit |
| Prior/concomitant meds | `PROC_CONMED_REVIEW` | question gateway + repeatable medication records |
| AE | `PROC_AE_REVIEW`, `PROC_SAE_REVIEW` | question gateway + repeatable AE records; avoid duplicating procedures/conmeds unless clinically required |
| Surgical/medical procedures | Missing explicit profile | add `PROC_MEDICAL_PROCEDURE_HISTORY` or repeatable clinical event profile |
| Hospitalization / ER / other visits | Missing explicit profiles | add repeatable healthcare utilization profiles |
| Withdrawal of consent | `PROC_RECONSENT` partially related | add `PROC_WITHDRAWAL_OF_CONSENT` |

---

## Do Not Import

The following should not be used as generic Vilo product defaults:

| Content | Reason |
|---------|--------|
| Novartis branding, author, MRA terminology | Sponsor-specific |
| UBC Pathways EDC screenshots and UI instructions | Third-party EDC-specific |
| Protocol `CKJX839A1US01` identifiers | Study-specific |
| Inclisiran dose and dosing schedule | Protocol/drug-specific |
| COVID-19 AE reporting language | Time- and sponsor-specific; keep only if a study protocol requires it |
| Exact CRF wording | Sponsor-owned operational text; convert to neutral Vilo field intent |

---

## Production Requirements

### Source Builder

1. Allow section and field instructions to be authored, reviewed, versioned, and published.
2. Allow field-level missing-data policy: allowed codes, reason required, query behavior.
3. Allow repeatable sections and repeatable procedure records.
4. Allow conditional field and section visibility.
5. Allow procedure activation based on prior source answers or matrix conditions.
6. Allow "not performed" capture with reason, without breaking visit completion when permitted.
7. Preserve source evidence references for external systems such as ePRO, central lab, ECG reports, and pharmacy/IP accountability.

### Runtime Capture

1. Display field guidance inline or as contextual help.
2. Enforce complete dates where required and partial dates only where allowed.
3. Enforce 24-hour time entry and prevent `00:00` from meaning unknown.
4. Support field-scoped query/finding indicators.
5. Capture change reason when a submitted or reviewed value changes.
6. Link abnormal/clinically significant values to safety workflows or findings.
7. Support unscheduled visit procedure capture.

### Audit / Compliance

1. Missing value override must be attributable and timestamped.
2. Corrections must be append-only with reason.
3. Query resolution must preserve prior value, corrected value, actor, reason, and finding state.
4. Published source definitions must remain immutable; amendments create new versions.
5. Runtime exports should show missing-code semantics and query/finding status.

---

## Recommended Production Backlog

| Priority | Item | Owner area |
|----------|------|------------|
| P0 | Add missing-data policy model to source fields and runtime responses | Source runtime |
| P0 | Ensure field instructions from Source Builder publish to runtime capture | Source Builder / compiler |
| P0 | Add "not performed + reason" pattern to procedure templates | Procedure library |
| P1 | Add repeatable section/procedure capability | Runtime capture |
| P1 | Add conditional visibility/action schema in Source Builder | Builder / compiler |
| P1 | Add form/response-set query count summary | Findings/read contract |
| P1 | Add healthcare utilization profiles: hospitalization, ER visit, other clinical visit | Procedure library |
| P2 | Add cardiovascular study pack: ACS history, statin intolerance, lipoproteins, injection treatment | Study-template library |
| P2 | Add ePRO external reference workflow | External source map |
| P2 | Add source preview rendering for guidance/instructions | Preview/export |

---

## Production Acceptance Criteria

Before this input is considered implemented, Vilo should pass these checks:

1. A coordinator can create a source field with `Complete date required` guidance, publish it, and see the instruction at capture.
2. A required field can be marked `UNK` only when the field allows unknown and a reason is captured.
3. A "Was assessment performed?" answer of `No` requires `reason_not_done` and does not display dependent assessment fields.
4. A demographics answer can trigger a dependent field.
5. A randomization treatment group can trigger a dependent procedure/form.
6. A repeatable AE record can be added after the gateway AE question is answered `Yes`.
7. A validation finding/query count is visible at response-set level and field level.
8. A corrected response requires reason for change and preserves history.
9. An unplanned lab can be captured under an unscheduled visit.
10. A published source preview includes section instructions, field instructions, required/missing behavior, and conditional rules.

---

## Final Product Call

Use this document to harden Vilo Source into a real coordinator-facing eSource system:

- **Adopt:** missing data semantics, dynamic branching, repeatable records, query workflow, field guidance, not-done reasons, abnormal-to-AE routing.
- **Adapt:** procedure forms into neutral reusable profiles and study-specific templates.
- **Reject:** sponsor-specific text, EDC screenshots, drug-specific dosing, and protocol identifiers as product defaults.

This PDF is most valuable as a **behavioral production checklist** for Vilo Source, not as a direct import artifact.

