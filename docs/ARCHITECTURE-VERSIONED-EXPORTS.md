# Architecture — Version-scoped clinical exports

**Scope:** Requirements and **data-model implications only**. No export engine implementation, storage workers, scheduling, or investigator UI.

**Driving principle:** Exported eSource and source-aligned rows must remain **scientifically and operationally truthful** relative to **the definition versions in force when data were captured**. Version mixing in a single “clean” rectangular dataset is forbidden.

Visit-level **PDF packets** carry the same version truth but optimize for readability; rules and roadmap slice **4C**: **`docs/ARCHITECTURE-VISIT-PDF-PACKET.md`**.

Canonical app repo: **`VILO CTMS/vilo-os`**. Portfolio context: **`Clinical Research Operations OS eClinPro/projects/vilo-os`**.

**Regulatory alignment:** Tabular exports implement **`docs/FDA-ESOURCE-PART11-READINESS`** **§I** (version-scoped structured exports; metadata **§§C,G** timestamps and reconstruction). Companion **§§E–H** (durable source, corrections, reconstruction, PDF).

**ALCOA+:** **Consistent** and **Accurate** exports (one **`source_definition_version`** per clean table, full metadata, reproducible regen) and **Available** retrieval — see **ALCOA+ Data Integrity Architecture** in the same FDA doc.

---

## 1. Export rules (authoritative)

1. **Group by execution-time source definition version** — All exported eSource / source-aligned data for a logical export must be grouped by the **`source_definition` version effective at `procedure_execution` capture time** (not latest template, not “best effort” merge).

2. **No mixed versions in one clean CSV table** — A single CSV “data table” (one stable header ↔ row shape) MUST NOT contain observations produced under differing source definition schema versions.

3. **Excel** — Each distinct source definition version used in scope maps to **its own worksheet** (“sheet per version”). Do not concatenate heterogeneous versions onto one sheet for primary clinical fields.

4. **CSV** — Emit **one file (or bundle file set) per source definition version**. Multi-version studies produce multiple CSV outputs; manifests describe grouping.

5. **Export metadata (required)** — Every export artifact (file, bundle, or sheet prelude) MUST carry or adjoin metadata sufficient to interpret rows without ambiguity:

   | Field | Intent |
   |-------|--------|
   | `study` | Stable study identity (slug or id + human label policy TBD at build) |
   | `study_version` | **`study_versions.id`** / label tying protocol window |
   | `source_definition_version` | Immutable version row for eSource/template used at capture |
   | `visit_definition` | Visit template identity + version marker as modeled (see implications) |
   | `procedure_definition` | Procedure template identity + version marker as modeled |
   | `procedure_execution_id` | Instance key for reproducibility |
   | `subject_identifier` | Site/study identifier per existing subject model (PHI-aware handling per `phi-boundaries`) |
   | `captured_at` | Business time of capture (not only row `updated_at`) |
   | `captured_by` | Actor (`profiles` / `auth.users` reference strategy TBD) |
   | `locked_status` | Visit / execution freeze signal (align with visit lock + QC; e.g. `visit_status`, execution `verified`) |

   **Note:** “Include” may mean repeated columns per row, a sidecar JSON/metadata sheet, or a manifest—**Phase 4D** selects the canonical packaging pattern without changing versioning rules.

6. **Runtime binding** — **`procedure_execution` (and/or child fact rows)** MUST **store or reference** the exact **source definition version** (prefer FK to **`source_definition_versions.id`**) assigned **no later than first substantive capture**. Late rebinding without a compensating audited flow is forbidden.

7. **Reproducibility** — A historical export re-run MUST yield the **same grouping and compatible column semantics** for a given **`procedure_execution_id`** even if the study later adds amendments or replaces templates for *new* work.

8. **Immutability of history** — Protocol or source questionnaire changes MUST surface as **new `study_versions` and/or `source_definition` versions**. **Do NOT mutate rows** that underpin prior captures to silently “upgrade” semantics. Corrections remain **append-only** via **`operational_events`** (and future correction events) consistent with **`append-only-event-architecture.md`**.

---

## 2. Definitions

- **Clean table** — Rows share one logical schema (same item/column semantics). Splitting instruments into multiple tables is acceptable; mixing instrument versions inside one labeled “clean export” table is not.
- **Source definition version** — Immutable row capturing form schema revision (field keys, cardinality, validations, derivation rules—not live UI layout noise unless layout encodes clinically material choices).
- **Version-scoped bundle** — A set of artifacts where each table/file/sheet declares exactly one **`source_definition_version`**.

---

## 3. Data model implications

Phase 2 already introduces **`study_versions`**, **`visit_definitions`**, and **`procedure_definitions`** with optional `study_version_id` linkage—this is prerequisite but **not sufficient** for eSource versioning.

Required **conceptual additions** before export engine coding (exact DDL in migrations when Phase 4 opens):

| Concept | Requirement |
|---------|----------------|
| **Source definition entity** | A stable “instrument” (**`source_definitions`**) keyed by **`study_id`** (plus organization scope), separate from **`procedure_definitions`** where one procedure mounts one or many instruments over time. |
| **`source_definition_versions`** | Immutable revisions; analogous to **`study_versions`**: new row per protocol/source change affecting capture semantics. Holds or references machine-readable schema (JSON Schema, ODM-lite, internal DSL—**undecided** until 4A/4B). |
| **`procedure_executions`** | Mandatory **`source_definition_version_id`** (nullable only for procedures explicitly **without** eSource yet; exports skip or emit “structure-only” metadata rows per policy). **Optional denormalizations** cached for RLS/export performance: **`study_version_id`**, **`visit_definition_id`** / version, **`procedure_definition_id`** / version—must match FK truth at instantiation or first capture. |
| **Capture facts storage** | eSource responses live in normalized item-level tables OR JSONB blobs **only when** blobs are keyed and validated against the **frozen `source_definition_version` schema**. Either way, **`procedure_execution_id` + source_definition_version_id** must jointly key interpretation. Corrections modeled **append-only** per **`FDA-ESOURCE-PART11-READINESS`** Rule **C** (`source_response_corrections`). |
| **Visit locking / QC** | **`locked_status`** for exports aligns with **`visits.visit_status`** (e.g. `locked`), **`procedure_executions.execution_status`** (`verified`), and eventual signature/freeze (**Phase 4E**)—export metadata surfaces these verbatim. |
| **Audit vs operational separation** — retained | **`RECORD_EXPORTED`-class actions** belong in **`audit_events`** (`audit-strategy.md`); versioning rules do not replace operational truth in **`operational_events`**. |

**RLS:** every new row carries **`organization_id`**; reads join through **`study_members`** as today. Exports execute server-side under explicit permission + audit.

---

## 4. Future export formats (non-binding sketch)

Choosing among these remains **Phase 4D** (tabular export engine builds on **Phase 4C** visit PDF foundations for shared read models).

| Format | Version handling | Typical use |
|--------|-----------------|-------------|
| **CSV ZIP bundle** | One folder per **`source_definition_version`** + `manifest.json` | Regulatory submission-adjacent, scripting |
| **Excel workbook** | One worksheet per **`source_definition_version`** + metadata sheet(s) | Site monitors, QC review packs |
| **JSON Lines / NDJSON archive** | One stream or file-per-version mirroring CSV split | Auditor replay, deterministic diffing |
| **Standards-aligned** — CDISC ODM/CDASH mapping | Out of MVP; versioning rules above prerequisite any future mapping layer |

Regardless of carrier format, rules **§1 Export rules** remain: **never mix versions inside one clean rectangular primary table**.

---

## 5. Roadmap linkage (implementation order)

Planning labels for portfolio **`status.md`** and sprint tracking:

| Phase | Name | Relation to tabular exports |
|-------|------|------------------------------|
| **4A** | Versioned Protocol Builder | Authored **`study_versions`**, visit/procedure defs, **`source_definitions`/`source_definition_versions`**. |
| **4B** | Versioned Dynamic eSource Runtime | Binds **`source_definition_version_id`** on executions at first capture; validators enforce schema of bound version only. |
| **4C** | Visit PDF Packet Export | Visit-scoped sponsor/CRA PDF; **`docs/ARCHITECTURE-VISIT-PDF-PACKET.md`**. |
| **4D** | Clean CSV / Excel Export Engine | Version-scoped bundles, metadata manifests, PHI-safe pipelines, **`RECORD_EXPORTED`**. |
| **4E** | eSignature / Freeze / QC | Locks, **`signed_at`**, attestations feeding PDF signature blocks and export eligibility (**FDA §D**; **ALCOA+ Attributable**). |
| **4F** | Query Engine | Search/list without collapsing version boundaries in bulk extracts. |
| **4G** | Training / Delegation / Authorization | Qualification + delegation linkage for regulated acts (**FDA §M**). |

**Next implementation step:** **Phase 4A — Versioned Protocol Builder schema design** — see **`docs/FDA-ESOURCE-PART11-READINESS.md`** (closing *Exact next implementation step*) and **`docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md`** (DDL plan, lifecycle, RLS).

---

## 6. References

- `docs/FDA-ESOURCE-PART11-READINESS.md` — FDA / Part 11; **§§A–M**; **ALCOA+ Architecture**; guardrails; validators; transfer **§J**
- `docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md` — **Phase 4A** Protocol Builder (**planning**)

- `docs/ARCHITECTURE-VISIT-PDF-PACKET.md` — visit-level PDF (**Phase 4C**)

- `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md` — domain spine and **`study_versions`**
- `projects/vilo-os/10_DECISIONS/phi-boundaries.md` — PHI in exports and integrations
- `projects/vilo-os/10_DECISIONS/append-only-event-architecture.md` — corrections vs mutation
- `projects/vilo-os/10_DECISIONS/audit-strategy.md` — **`audit_events`** for export/security actions
