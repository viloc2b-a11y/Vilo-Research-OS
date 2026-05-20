# Dynamic Section-Based eSource Architecture

**Status:** Product / architecture requirement (documentation).  
**Applies to:** Source Builder, publish pipeline, runtime capture, validation, signatures, audit.  
**Explicitly not:** A generalized protocol parser, sponsor portal, or universal builder (Phase 9A and later phases implement incrementally).

---

## Core principle

**Source is not a static form.**

A source document is a **versioned package** of **dynamic sections**, each containing **configurable fields** with **instructions and validation rules**, executed at runtime with **provenance, corrections, and signatures**.

```
Source Package
  → Dynamic Sections
  → Configurable Fields
  → Runtime Capture
  → Validation
  → Signatures
  → Audit Trail
```

---

## 1. Source Builder requirements

### 1.1 Dynamic sections

A source document **must** support multiple sections per procedure / source definition version. Sections are the unit of:

- procedural instructions
- field grouping
- optional enable/disable at runtime (`section_disabled_at` on response set)
- signature requirement binding (target state; see §1.6)

Coordinators **must** be able to:

| Action | Requirement |
|--------|-------------|
| Add partial section | Insert a section with a subset of fields (e.g. vitals subset for phone visit) |
| Remove partial section | Drop a section without deleting the whole procedure package |
| Add complete procedure section | Attach a full library section (e.g. full Vital Signs block) |
| Remove complete procedure section | Remove an entire section from a draft / published slice |
| Reorder sections | Change section order when protocol or site SOP requires |

**Planning authority:** `docs/PHASE6A-SOURCE-BUILDER-WORKSPACE.md`, `docs/PHASE6A-COORDINATOR-SOURCE-BUILDER-PLAN.md`.

### 1.2 Configurable fields

Each section contains fields that coordinators can add, edit, hide, reorder, and mark required without engineering.

**Required modalities (product):**

| Modality | Use |
|----------|-----|
| Text | Free text, short labels |
| Number | Labs, vitals, counts |
| Date / time | Collection time, administration time |
| Dropdown / select | Coded values |
| Checkbox | Boolean flags |
| Radio | Exclusive choice sets |
| Calculated field | BMI, derived scores (server-evaluated against bound version rules) |
| Normal / abnormal status | Structured clinical significance |
| Comments / notes | Narrative where protocol allows |
| File / image attachment | Evidence upload when supported |

**Schema target:** `field_type` + `ui_control_type` matrix in `docs/PHASE4B-VERSIONED-ESOURCE-RUNTIME-SCHEMA.md` (§B.0.1).

### 1.3 Instructions and validation

Each section and field **must** support:

- **Procedural instructions** (`instructions` on `source_fields`; section-level copy in publish `source_sections`)
- **Validation rules** (`validation_rules` JSON on fields; `published_source_validation_rules` at publish; runtime findings in `source_response_validation_findings`)

Validation is **server-side** at save/submit and via `lib/visit-runtime/validateProcedure.ts`.

### 1.4 Signatures

Source documents **must** support configurable signature requirements:

| Role | Typical binding |
|------|-----------------|
| Coordinator | Visit closeout / progress note; optional per-section in publish manifest |
| Principal Investigator | Visit sign-off after coordinator |
| Sub-Investigator | Delegated sign-off where protocol allows |

Requirements are **configurable by source section / procedure** via publish manifest (`signature_requirements` in compiler output — `docs/PHASE4C12-PUBLISH-SOURCE-PACKAGE-RPC-PLAN.md`).

**Today (visit-level):** Coordinator and investigator signatures are implemented on **visit closeout** (`visit_review_status`, progress note actions, `OPERATIONAL_EVENT_TYPES.COORDINATOR_SIGNED` / `INVESTIGATOR_SIGNED`). Per-section e-sign in capture is **planned**, not the Phase 9A blocker if visit-level closeout satisfies the pilot.

### 1.5 Runtime audit trail

Runtime **must** preserve:

| Dimension | Mechanism |
|-----------|-----------|
| Who entered data | `source_responses` originator / actor columns + RLS |
| Timestamp | `captured_at`, response set `opened_at` / `submitted_at` |
| Corrections | `source_response_corrections` + replacement `source_responses` |
| Addenda | Late-entry addendum RPC + read-contract addenda panel |
| Validation status | `procedure_executions.validation_status`, findings rows |
| Signature status | Visit `visit_review_status`, progress note signature status |
| Audit traceability | `operational_events`, `audit_events` references on corrections |

**Docs:** `docs/FDA-ESOURCE-PART11-READINESS.md`, `docs/ARCHITECTURE-VERSIONED-EXPORTS.md`.

---

## 2. Example — Vital Signs (structured, not a note)

Vital Signs **must not** be implemented as a single free-text note for GENERIC_PHASE3_OA or any regulated procedure profile.

**Target structured section** (field keys illustrative; pilot may use `TMPL_VITALS` subset + extensions):

| Field | Modality |
|-------|----------|
| Height | number + unit |
| Weight | number + unit |
| BMI | calculated (from height/weight) |
| Temperature | number |
| Blood pressure systolic | number |
| Blood pressure diastolic | number |
| Pulse / heart rate | number |
| Respiratory rate | number |
| Oxygen saturation | number (when required) |
| Position / resting condition | select |
| Measurement time | datetime |
| Pre-dose / post-dose flag | select or checkbox (when applicable) |
| Clinically significant | normal/abnormal or yes/no |
| Comments | text (optional) |

**Library baseline today:** `fixtures/source-builder/procedure-profile-library.v1.json` → `TMPL_VITALS` minimal set includes `performed_datetime`, `systolic_bp`, `diastolic_bp`, `heart_rate`, `clinically_significant`; optional `temperature`, `respiratory_rate`, `position`, `comments`. **Height, weight, BMI, SpO2, pre-dose flag** are product targets for pilot expansion, not yet in the minimal template.

---

## 3. What current architecture already supports

| Capability | Status | Evidence |
|------------|--------|----------|
| Versioned source definitions | **Supported** | `source_definitions`, `source_definition_versions`, publish packages |
| Sections at publish time | **Supported** | `published_source_sections`, `source_sections[]` in compiler output / `publish_source_package` |
| Fields with instructions + validation_rules | **Supported** | `source_fields`, `published_source_fields` |
| CPST / compiler section_code grouping | **Supported** | `scripts/compile-source-definitions.mjs`, golden fixtures (`section_code` per field) |
| Runtime capture (structured fields) | **Supported** | `/source/capture/[procedureExecutionId]`, `CaptureForm`, save/submit RPCs |
| Field kinds in capture UI | **Partial** | `text`, `number`, `date`, `boolean`, `select`, `json` — `lib/source/capture/types.ts` |
| Validation findings | **Supported** | `source_response_validation_findings`, acknowledge/resolve APIs |
| Procedure validation status | **Supported** | `procedure_executions.validation_status`, `validateProcedure` |
| Corrections + addenda | **Supported** | `source_response_corrections`, read-contract history/addenda |
| Operational event chronology | **Supported** | `operational_events`, visit closeout timeline |
| Coordinator / PI visit signatures | **Supported** | Progress note + `visit_review_status` workflow |
| Procedure profile library + field templates | **Supported** | `procedure-profile-library.v1.json`, `TMPL_VITALS`, etc. |
| Source Builder draft (visits, procedures, fields) | **Partial** | `SourceBuilderWorkspace` — procedure-centric fields, not section editor |
| Publish pipeline | **Supported** | `publish_source_package` RPC, Phase 4C compiler output |
| Signature requirements in publish manifest | **Schema / publish** | `signature_requirements` in compiler output; visit-level UX today |
| Validation rules manifest at publish | **Supported** | `published_source_validation_rules` |

---

## 4. What remains missing (gaps)

| Gap | Impact | Phase 9A stance |
|-----|--------|-----------------|
| **Section-level Source Builder UI** (add/remove/reorder sections) | Coordinators cannot visually manage sections in `/source-builder`; only procedure-level fields in draft | **Defer UI** — use compiler/CPST path for pilot package |
| **Authoring `source_sections` table (Phase 4A)** | Sections exist in **published** snapshot only; Phase 4A fields are flat per SDV | **Accept** for pilot via publish JSON |
| **Capture UI grouped by section** | Runtime uses **flat field list** per SDV (documented in Phase 4C12) | **Accept** for pilot if fields are structured; section grouping is UX polish |
| **Radio, calculated, file widgets in capture** | Not all modalities in `CaptureFieldKind` | **Partial** — use number/select/text; calculated BMI can be manual or follow-up |
| **Per-section signature in capture** | Visit-level signatures only | **Accept** visit closeout for 9A |
| **Sub-investigator role in signature UX** | PI/coordinator paths exist; sub-I may map to PI delegation | **Document** per site SOP |
| **GENERIC_PHASE3_OA pilot seed package** | Four-visit slice may not be fully seeded | **Deliver** minimal published package (see runbook) |
| **Conditional workflow from field values** | ACTH/HIT triggers need pilot-specific rules or manual workflow rows | **Minimal** rules or seeded workflow actions |

**Do not** delete existing sample/staging data to close gaps.

---

## 5. Recommended minimal implementation (Phase 9A)

**Goal:** Respect the architecture chain without building the full universal Source Builder.

| # | Deliverable | Approach |
|---|-------------|----------|
| 1 | **GENERIC_PHASE3_9A source package** | Compile/publish a pilot package (CPST import or `compile-source-definitions.mjs`) with `source_sections[]` + fields per §4 minimal procedures |
| 2 | **Structured Vital Signs** | Extend pilot SDV fields from `TMPL_VITALS` + add height, weight, BMI (calculated or fields), SpO2, pre-dose flag as publish-time fields — not a note field |
| 3 | **Section codes** | Use `section_code` (e.g. `vitals`, `labs`, `consent`) in compiler rows — matches biospecimen golden pattern |
| 4 | **Runtime capture proof** | Coordinator completes capture on Day 1 vitals + one lab procedure; submit; validation runs |
| 5 | **Conditional workflow** | Abnormal cortisol / platelet values → `subject_workflow_actions` (seeded rule or manual create + capture finding) |
| 6 | **Signatures** | Visit closeout coordinator + PI signature on at least one pilot visit |
| 7 | **Audit proof** | Confirm response provenance + correction path on one field; operational event on sign |
| 8 | **Subject chain** | Run `docs/PHASE9A-PARA-OA-012-PILOT-RUNBOOK.md` with signal density |

**Out of scope for 9A:** Section drag-and-drop builder, universal modality matrix UI, sponsor/CRA portals, full GENERIC_PHASE3_OA SOA, eDiary, PK substudy.

---

## Related docs

| Document | Role |
|----------|------|
| `docs/SOURCE-ENGINE-PHASE1.md` | Implemented config library + rule engine (`lib/source-engine/`) |
| `docs/PHASE9A-PARA-OA-012-PILOT-RUNBOOK.md` | Executable pilot checklist (includes dynamic source hard requirement) |
| `docs/PHASE6A-SOURCE-BUILDER-WORKSPACE.md` | Target builder capabilities |
| `docs/PHASE4B-VERSIONED-ESOURCE-RUNTIME-SCHEMA.md` | Field types and storage |
| `docs/PHASE4C2-CANONICAL-JSON-SCHEMAS.md` | Compiler / publish contract |
| `docs/COORDINATOR-OPERATIONAL-CHAIN.md` | End-to-end coordinator chain |
