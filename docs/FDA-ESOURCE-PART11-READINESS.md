# FDA eSource / 21 CFR Part 11 readiness — architectural posture

**Scope:** Regulatory-informed **design posture** only. Not legal interpretation, IQ/OQ/PQ packs, vendor validation, or SOP authoring. Applies to **Vilo Research OS** (**vilo-os**).

**Implementation status:** **Architecture and documentation.** No certification claim until Vilo runs a controlled validation program.

**Do not:** alter **GREEN** Phase **3C** RPCs (`complete_visit`, `lock_visit`, `complete_procedure_execution`) unless a future approved change order supersedes this document.

**Companion technical docs:**  
`docs/ARCHITECTURE-VERSIONED-EXPORTS.md` (structured exports, **§I** + **ALCOA+ Consistent/Accurate**), `docs/ARCHITECTURE-VISIT-PDF-PACKET.md` (**§H** + **ALCOA+ Legible/Available**), `docs/PHASE3C-VISIT-LIFECYCLE-RESULTS.md` (visit **lock** baseline today).

---

## ALCOA+ Data Integrity Architecture

**ALCOA+** is a **first-class** design contract for regulated eSource and evidence in Vilo OS. The sections **A–M** below operationalize it; **enforcement** flows through **schema**, **`operational_events` / `audit_events`**, **`source_definition` versioning**, **`electronic_signatures`**, **exports**, and **future validators**.

| Pillar | Meaning for Vilo OS | Enforcement levers |
|--------|---------------------|---------------------|
| **Attributable** | Every regulated record traces to a **human user**, **delegated acting user**, or **named system/integration identity** — never anonymous clinical change. | `actor_user_id` / signer ids on **`operational_events`**, **`source_responses`**, **`source_response_corrections`**, **`electronic_signatures`**, export **`audit_events`**; integration IDs in future transfer/event rows (**§J**); **§B** forbids unattributed deletes. |
| **Legible** | Source and evidentiary payloads are **human-intelligible** to monitors and auditors (not opaque blobs alone). | **§H** visit PDF packets; curated export column labels/metadata (**§I**); PHI-safe truncation per **`phi-boundaries.md`**. |
| **Contemporaneous** | Times reflect **when** actions occurred in authoritative system time — **UTC**, **server-side**. | **§C** — all regulated **audit**, **operational**, **signature**, **correction**, **lock**, **export**, **transfer** timestamps generated **server-side in UTC**; no trusted client timestamps for attestation. |
| **Original** | The record of what was captured is tied to **immutable version context** — not rewired silently to today's live form. | **§E** durable locked snapshot + persisted **`source_responses`** under bound **`source_definition_version_id`**; **`source_definition_versions`** authoritative for field semantics (**Phase 4A–4B**). |
| **Accurate** | Values match defined rules at capture and remain explainable after change. | Runtime validation vs **`source_definition_version`** schema (**4B**); **§F** append-only corrections with reason + lineage; **no silent overwrite**; optional **`validation_findings` / data_quality_findings`** (below). |
| **Complete** | Required study/visit/source obligations are **met or explicitly waived** with reason. | Required procedures (`visit_def_procedure_map`, Phase 3C completion rules); **`source_fields`** `required`; **`missing_required_items`** or **`protocol_deviations`** rows with **`deviation_reason`** when omission is deliberate (DDL **Phase 4B+**); visit complete only when rules satisfied (**Phase 3C** today). |
| **Consistent** | Same factual story across **database**, **UI read models**, **PDF**, and **tabular exports** for a locked context. | Single **`procedure_execution_id`** + **`source_definition_version_id`** binds runtime, corrections, signatures, CSV/Excel (**§I**), PDF (**§H**) — **no mixed-version “clean” tables**. |
| **Enduring** | Evidence survives lifecycle and retains meaning under **archive/retention** without clinical **delete**. | **§§B, E, L, K**; **`export_artifacts`** checksums; immutability after **lock** unless **controlled append correction path** (**§F**, guardrails). |
| **Available** | Authorized roles can **retrieve** and **replay** inspection-ready artifacts years later. | **§L** retrieval + reproducible exports; **§I** manifests; RLS preserves org/study boundaries while allowing entitled review. |

**Cross-reference:** Regulatory principles table (**§A**), reconstruction (**§G**), and classification (**§K**) reinforce ALCOA+ priorities by data class.

---

## A. Regulatory design principles

Engineering targets align with FDA eSource themes and **Part 11–relevant** expectations when electronic records/signatures replace paper:

| Principle | Vilo OS posture |
|-----------|-----------------|
| **Data integrity** | **ALCOA+ Architecture** section — formal pillars + **§§A–M** tactical rules |
| **Traceability** | **`operational_events`** + typed correction/signature/export/transfer records; joins to **`study_version_id`** / **`source_definition_version_id`** |
| **Attribution** | **`actor_user_id`** / server-resolved identity on operational and audit paths (**§B**, **§C**) |
| **Legibility** | Human-readable **visit PDF** (**§H**) + structured exports with metadata (**§I**) |
| **Contemporaneous records** | Business times modeled explicitly; **regulated timestamps server-side UTC** (**§C**) |
| **Original source preservation** | **Durable source** = locked runtime snapshot + persisted responses — not mutable live forms (**§E**) |
| **Accurate copy / export** | Version-scoped tabular exports + reproducible PDF; **no mixing `source_definition` versions** in one clean CSV table (**§I**) |
| **Retention** | States and classes under **§K** and **§L**; clinical runtime **not deleted** (**§B**) |
| **Inspection readiness** | Reconstruction checklist **§G**; retrieval and long-horizon reproducibility **§L** |

---

## B. Audit trail model

**Clinical runtime data must not be deleted** (no hard delete of visits, procedure executions, operational facts, or submitted source rows). Lifecycle uses **supersede / correct / invalidate / lock** semantics and **append-only** chains.

Audit and operational trails **must support** evidentiary categories (mapped to **`operational_events.event_type`** extensions, **`audit_events.action`**, and future domain tables as needed):

| Trail category | Intent |
|----------------|--------|
| **create** | Initial capture / instantiation |
| **correct** | Append-only correction with reason — **§F** |
| **supersede** | New row replaces prior **without** deleting prior |
| **invalidate** | Retain row; mark invalid with reason — not a delete |
| **lock** | Visit / QC freeze — **Phase 3C** `lock_visit`; future execution-level freeze |
| **sign** | **§D** — non-boolean signature records |
| **export** | **`RECORD_EXPORTED`** and artifact references — **§I**, **§H** |
| **transfer** | **§J** — origin, destination, integrity |

**Streams (today + planned):**

- **`operational_events`** — append-only clinical/business facts (*create*, workflow transitions, future *correct* hooks).
- **`audit_events`** — security/compliance (*export*, privilege-sensitive actions); **no PHI-heavy payloads** (`audit-strategy.md`).
- **`source_response_corrections`** — typed *correct* / *supersede* lineage (**§F**).
- Future: **`data_transfer_events`** (or equivalent) for **§J**.

---

## C. Server-generated timestamps (UTC)

**Rule:** All timestamps that **attest regulated behavior** for **audit**, **operational**, **signature**, **correction**, **transfer**, **lock**, and **export** events **must be generated server-side** and stored **in UTC** (e.g. `timestamptz` with explicit UTC policy in app layer).

**Do not trust client-supplied timestamps** for regulated records. Client clocks may inform **display** or **draft** UX only; **authoritative** `occurred_at`, `corrected_at`, `signed_at`, `locked_at`, `exported_at`, `transferred_at` are **server-set**.

Existing materialized columns on **`visits`** / **`procedure_executions`** must continue to follow **database or RPC** writers, not browser time.

---

## D. Electronic signature model (future — not a boolean flag)

A signature **must never** be represented as **only** a boolean flag on a clinical row.

Each future **`electronic_signatures`** record **must** minimally include:

| Field | Requirement |
|-------|--------------|
| `signer_user_id` | Stable user reference |
| **Signer role** | Snapshot aligned to **`study_members.role`** (or successor authorization model) |
| **`timestamp` / `signed_at`** | **Server UTC** (**§C**) |
| `meaning_of_signature` | Controlled vocabulary — **mandatory** |
| `linked_entity_type` | e.g. `visit`, `procedure_execution`, `source_response_set` |
| `linked_entity_id` | UUID |
| `study_version_id` | When protocol window matters |
| `source_definition_version_id` | When signature attests sourced data |
| **Record hash / integrity reference** | Binds canonical signed payload |
| **`signature_event_reference`** | Stable pointer to **`operational_events`** or dedicated signature event row |
| **Permanent binding** | Non-repudiation of **signed snapshot** — later edits require **new** rows/events, not silent reassignment |

Dual signers (e.g. CRC + PI) emit **distinct** signature rows.

---

## E. Durable electronic source repository

**Definition:** The **locked runtime source snapshot** (visit **locked**, **`source_responses`** persisted per bound **`source_definition_version_id`**, optional **`export_artifacts`**) **is** the **durable electronic source record** for inspection and sponsor reconstruction.

- **Protocol Builder** and live form renderers are **authoring/presentation** surfaces — **not** the system of record for **historical** answers.
- Replays, PDFs, and regulatory extracts **must** read **persisted** rows + event/correction chains, **not** “whatever the widget shows today.”

---

## F. Source correction model (append-only)

Future **`source_responses`** (or equivalent): **immutable after submit.**

| Field | Purpose |
|-------|---------|
| `correction_reason` | Narrative/code per policy |
| `correction_type` | Controlled taxonomy |
| `supersedes_record_id` | Prior **`source_responses`** (or chain head) |
| `prior_value_reference` | Pointer/digest — **no silent wipe** |
| `corrected_by` | Actor |
| `corrected_at` | **Server UTC** |
| **`audit_event_id`** **or** **`operational_event_id`** | Traceability (**at least one** when policy requires) |

**No silent overwrites** of submitted values.

---

## G. Human-readable reconstruction

This section operationalizes **ALCOA+** **Legible** (with **§H**) and **Attributable** columns of the reconstruction matrix.

Visit / procedure / source must be reconstructable as:

| Dimension | Source of truth |
|-----------|----------------|
| **Who** | `actor_user_id`, profiles, attribution on events |
| **Did what** | `operational_events`, corrections, signatures |
| **When** | **§C** server UTC times |
| **Why** | `correction_reason`, operational payloads (PHI-safe) |
| **Under which study version** | `study_version_id` on execution / bindings |
| **Under which source definition version** | `source_definition_version_id` |
| **Correction history** | **`source_response_corrections`** chain |
| **Signature meaning** | **`meaning_of_signature`** (**§D**) |
| **Lock / export status** | `visit_status`, `locked_at`, export artifacts / audit refs |

PDF (**§H**) and version-scoped extracts (**§I**) are carriers for this narrative.

---

## H. PDF visit packet (future)

Per **`docs/ARCHITECTURE-VISIT-PDF-PACKET.md`**, each visit **must later** yield a readable packet including:

- Study / subject / visit metadata  
- Procedure execution details  
- Source data captured (per **bound** source version)  
- **Source definition version** labels/ids  
- **Correction timeline**  
- **Audit/event references** (not full noisy payloads)  
- **Signatures and meanings**  
- **Lock status**  
- **Export metadata**  

---

## I. CSV / Excel export rules

Structured exports are **source-version scoped**:

- **Do not** mix **`source_definition` versions** in one **clean** CSV table.  
- **Excel:** separate **sheet per source version** for primary clinical columns.  
- **CSV:** **separate file(s) per source version** (or folder + manifest).

Full field-level metadata: **`docs/ARCHITECTURE-VERSIONED-EXPORTS.md`**.

---

## J. Transfer chain traceability (future DHT / import)

Future data-handling / import workflows **must** record:

| Element | Notes |
|---------|--------|
| **Capture source** | Where data first entered Vilo control |
| **Transfer source** | Upstream system / shipment |
| **Destination durable repository** | Target store / visit scope |
| **Transfer timestamp** | **Server UTC** |
| **Actor / system** | Human and/or integration identity |
| **Integrity status** | Verified / pending / failed |
| **Checksum / hash** | When applicable |

Conceptual home: **`data_transfer_events`** + optional artifact rows (DDL in **Phase 4+**).

---

## K. Risk-based data classification

| Class | Examples (illustrative) | Audit burden | Retention expectation | Signature | Export | Lock behavior |
|-------|-------------------------|--------------|----------------------|-----------|--------|----------------|
| **Regulated** | Submitted eSource, attestations, locked visit packets | **High** — full trail **§B** | Long; aligned to protocol/archive policy | Often **required** (**§D**) | **Version-scoped** + PDF | **Freeze** drives immutability |
| **Operational** | Scheduling tweaks, draft checklists pre-submit | Moderate — operational_events | Operational retention | Rarely | Redacted summaries | Locks only where tied to regulated package |
| **Derived** | Analytics, rollups | Low — regenerated from regulated | Short / rebuildable | No | Controlled | N/A |
| **Temporary** | Session drafts, unsubmitted caches | Minimal — exclude from regulated exports | Ephemeral — **never** authoritative for inspection | No | Exclude | Garbage-collect **outside** durable source (**§E**) |

Classification drives **§L** archival policy and **`audit_events`** density.

---

## L. Retention and inspection readiness

| Topic | Architectural expectation |
|-------|---------------------------|
| **Retention state** | Model **active → archive → cold** (exact enums TBD) **without** clinical **delete** |
| **Archive state** | Read-only; exports remain reproducible |
| **Inspection retrieval** | PDF (**§H**) + tabular (**§I**) + audit **references** (**§B**) |
| **Reproducible exports years later** | Bind artifacts to **`study_version_id`**, **`source_definition_version_id`**, checksums (**`export_artifacts`**, **`integrity_reference`**) |

---

## M. Training and authorization (Phase 4G)

Future compliance modules **must** support linkage (exact schema **Phase 4G**):

- **Training records** — qualification validity windows  
- **Role qualification** — eligibility to sign / lock / approve  
- **Delegation log linkage** — who acted under whose authority  
- **Signature authorization** — ties **§D** to qualified roles  
- **PI oversight** — attestations and escalation paths  

This does **not** replace **`study_members`**; it **narrows** who may perform regulated acts.

---

## Implementation guardrails (non-negotiable)

**Core (Part 11 / eSource)**

1. **No overwrite** of submitted source data (**§F**, **ALCOA+ Accurate**).  
2. **No clinical runtime deletes** — **§B**, **ALCOA+ Enduring**.  
3. **No client-generated regulated timestamps** — **§C**, **ALCOA+ Contemporaneous**.  
4. **No unversioned source capture** — **`source_definition_version_id`** (**4B**, **ALCOA+ Original / Consistent**).  
5. **No signature without `meaning_of_signature`** — **§D**, **ALCOA+ Attributable**.  
6. **No export without source-version metadata** — **§I**, **`ARCHITECTURE-VERSIONED-EXPORTS`**.  
7. **No mutable live-form-only dependency** for historical reconstruction — **§E**, **ALCOA+ Original**.  
8. **No PHI-heavy audit payloads** — **`audit-strategy.md`**, **`phi-boundaries.md`**.  
9. **`service_role`** **not used** for **normal clinical lifecycle writes** — end-user JWT + RLS (**existing Phase 3C pattern**).

**ALCOA+–specific extensions**

10. **No anonymous clinical changes** — every create/correct/supersede/export path carries **authenticated or named service identity** (**ALCOA+ Attributable**).  
11. **No mixed-version clean exports** — one **`source_definition_version`** per rectangular export unit (**§I**, **ALCOA+ Consistent**).  
12. **No missing required procedure without explicit deviation/reason** — use **`missing_required_items`**, **`protocol_deviations`**, or equivalent + **`deviation_reason`** (**ALCOA+ Complete**) — aligns with **`visit_def_procedure_map.is_required`** and future source required fields.  
13. **No locked visit mutation** except **controlled correction/amendment append paths** (documented **`source_response_corrections`**, future compensating **`operational_events`**) — **ALCOA+ Accurate / Enduring**; **Phase 3C** lock remains baseline.

---

## Data model implications (Phase 4 — conceptual; no DDL commitment here)

**Already planned:** `source_definitions`, `source_definition_versions`, `source_fields`, `source_response_sets`, `source_responses`, `source_response_corrections`, `electronic_signatures`, `export_artifacts`.

**ALCOA+ completeness / accuracy (planned extensions — names TBD):**

| Construct | ALCOA+ pillar |
|-----------|----------------|
| **`validation_findings`** or **`data_quality_findings`** | **Accurate** — surfaced rule breaches, resolution lineage |
| **`missing_required_items`** / **`protocol_deviations`** + **`deviation_reason`** | **Complete** — omissions are explicit when required procedures/fields are not satisfied |

**Likely additions from this document:**

| Construct | Tie to section |
|-----------|----------------|
| **`data_transfer_events`** (name TBD) | **§J** |
| **`training_completion`**, **`delegation_assignments`** (names TBD) | **§M** / **4G** |

**RLS:** every regulated row carries **`organization_id`**; access gated via **`study_members`** (and fine-grained policies as today).

---

## Future validation script expectations (**ALCOA+ oriented**)

Next-generation validators (**`db:validate-*`** and/or integration tests) **must** ultimately prove:

| Check | ALCOA+ pillar |
|-------|----------------|
| **Attributable actor** on every **`source_response`**, **`source_response_correction`**, **`electronic_signature`**, regulated **export**, and substantive **`operational_event`** insert | Attributable |
| **Server UTC timestamps** — no uncritical trust of client-only clock fields on persist paths | Contemporaneous |
| **Required field / procedure completeness** — required **`source_fields`** populated or tied to **`deviation_reason`** (or **`protocol_deviations`**) when allowed | Complete |
| **Version-consistent exports** — tabular egress matches bound **`source_definition_version_id`**; no mixed-version clean tables | Consistent |
| **Durable source reconstruction** — PDF / export replays persisted rows + corrections, **not** live-render-only interpretation | Original / Available |
| **Locked visit immutability** — no forbidden UPDATE/delete on locked clinical payloads without append-only correction semantics | Enduring / Accurate |
| **Correction chain preservation** — **`supersedes_record_id`** / prior references intact; INSERT-only corrections | Accurate |
| **Inspection-readable PDF** — structural completeness for **§H** packet (**Phase 4C**) | Legible / Available |

Prior baseline checks (**append-only** corrections, **`electronic_signatures`** **§D** fields, **§I** export metadata, **§H** replay) remain in scope.

---

## Roadmap — Phase 4

| Phase | Name |
|-------|------|
| **4A** | Versioned Protocol Builder |
| **4B** | Versioned Dynamic eSource Runtime |
| **4C** | Visit PDF Packet Export |
| **4D** | Clean CSV / Excel Export Engine |
| **4E** | eSignature / Freeze / QC |
| **4F** | Query Engine |
| **4G** | Training / Delegation / Authorization |

---

## Exact next implementation step

**Phase 4A — Versioned Protocol Builder schema design:** entity diagram, FK + RLS sketch, naming per **Data model implications** above, migration sequencing **without** breaking GREEN **Phase 3C** RPC contracts.

**ALCOA+ intent:** Versioned `source_definitions` / required fields underpin **Original**, **Complete**, and downstream **Consistent** runtime capture in **Phase 4B**.

**Schema detail:** **`docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md`** — Versioned Protocol Builder (entities, lifecycle, RLS, planned migration order).

---

## References

- MHRA / industry **data integrity** guidance framing **ALCOA+**
- FDA *Computerized Systems Used in Clinical Investigations* (eSource)  
- 21 CFR Part 11 — **when electronic records/signatures apply**  
- `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md`  
- `projects/vilo-os/10_DECISIONS/audit-strategy.md`  
- `projects/vilo-os/10_DECISIONS/append-only-event-architecture.md`  
- `projects/vilo-os/10_DECISIONS/phi-boundaries.md`
