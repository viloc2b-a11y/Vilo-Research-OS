# Architecture — Visit-level PDF export packets

**Scope:** Requirements and **data-model implications only**. No PDF generation library integration, rendering jobs, routes, templates, or investigator UI.

**Relationship:** Tabular exports (CSV/Excel) remain governed by **`docs/ARCHITECTURE-VERSIONED-EXPORTS.md`**. Visit PDF packets are a **distinct carrier** optimized for sponsor/monitor readability while honoring the same **execution-time source version** semantics.

Canonical app repo: **`VILO CTMS/vilo-os`**.

**ALCOA+:** Visit PDFs are the primary **Legible** and **Available** carrier alongside tabular egress; packets must expose **Attributable** actors, **Contemporaneous** server times (**FDA §C**), and **Consistent** version labels — **`FDA-ESOURCE-PART11-READINESS`** (*ALCOA+ Data Integrity Architecture*).

---

## 1. Critical requirement (packet contents)

Each **visit-level** PDF packet **must be able** to assemble a sponsor/audit-readable narrative combining:

| Section (conceptual) | Content |
|---------------------|---------|
| Visit metadata | Visit instance identifiers, **`visit_definition`** (+ version linkage), **`visit_status`**, scheduled vs actual dates/time windows, **`locked_at`** where applicable |
| Subject / study context | Study identity, **`study_version`**, site/org context (non-noisy), **`subject_identifier`** per policy (**`phi-boundaries`**) |
| Procedures performed | One block per **`procedure_execution`**: **`procedure_definition`** (+ version), status, **`source_definition_version`**, performed/captured summaries |
| Source data captured | Rendered facts aligned to the bound **`source_definition_version`** per execution — never silently merged across versions |
| Source definition version | Explicit label + stable id/reference per procedure block (mandatory) |
| Change tracking | Human-readable lineage: what changed, when, by whom (**operational_events** spine + materialized timestamps where modeled) |
| Timestamps / timepoints per change type | **`created_at`**, **`updated_at`**, **`corrected_at`**, **`signed_at`**, **`locked_at`** (see §4) |
| Actor identity | Resolved display name / user id reference per substantive action |
| Audit references | Pointers/codes linking to **`audit_events`** (**id + action + compact context**); **omit** bulky raw payloads from the PDF body |
| PI / CRC signatures | Structured signature blocks with required fields (**§3**) once **Phase 4E** persists signature facts |
| Lock status | Visit + execution-level freeze signals surfaced clearly in header/summary |
| Export metadata | PDF generation/version, **`visit_id`**, generation timestamp, exporter identity (**`RECORD_EXPORTED`**) linkage |

---

## 2. Rules (authoritative)

1. **Visit-scoped** — One canonical packet answers *this* **`visit_id`**. Bulk “study-wide PDF” remains out of scope for this artifact class (may wrap many visit packets later without changing inner visit scope).

2. **Exact execution-time source version** — For each **`procedure_execution`**, display and structured metadata MUST use **`source_definition_version_id`** (or equivalent FK) bound at first capture (**`ARCHITECTURE-VERSIONED-EXPORTS`** §1, rule 6 — runtime binding).

3. **Historical reproducibility** — Re-render or stored artifact retrieval for past visits MUST remain consistent with archived facts + append-only **`operational_events`** after **`study_versions`** / **`source_definition_versions`** advance for future work only.

4. **Change timepoints** — The narrative MUST surface timestamps appropriate to lifecycle stages (populate from DB/events as modeled in **§4**):
   - **`created_at`**
   - **`updated_at`**
   - **`corrected_at`**
   - **`signed_at`**
   - **`locked_at`**

5. **Signature section** — Each attestable signing action included in the packet MUST expose:
   - Signer resolved name **and/or** authoritative user identifier
   - Signer **`study_members.role`** (or superseding signature-role model aligned with **`rbac-model.md`**)
   - **`signed_at`** (business/legal time preference over insert-only **`created_at`** when both exist)
   - **Meaning of signature** — fixed phrase from protocol/config (e.g. “attest clinical accuracy as site PI for this visit”)
   - **Related scope** — `visit_id`; procedure blocks when signature is execution-scoped; **source definition version** row id/label referenced

6. **No silent version mixing** — Multiple **`source_definition_version`** rows on one visit MUST appear as **explicitly separated subsections or labeled tables** inside the PDF (never one undifferentiated “merged” questionnaire block).

7. **Audit/event references — not payloads** — Cite **`audit_events.id`** (or deterministic digest), **`action`** code, **`occurred_at`**, **`actor_user_id`** as appropriate; omit large JSON payloads. **`operational_events`** referenced by **`event_type`**, **`occurred_at`**, **`actor_user_id`**, compact **`payload` excerpt** policy TBD (**PHI-safe** trims only).

8. **Presentation bar** — PDF is **human-readable**, print-stable, numbering/TOC friendly, and avoids debug clutter; sponsor/CRA appropriate typography is a **Phase 4C layout** detail, not a schema relaxation.

9. **Generation modes (future)** — Initial generation may be **on demand**. Optionally, after **`visit`** lock (**Phase 3C / 4E** alignment), persist an **immutable export artifact** (see **§7**) with cryptographic checksum and **`RECORD_EXPORTED`**.

---

## 3. Data model implications

| Area | Requirement |
|------|--------------|
| **Visit / subject spine** | Existing **`visits`**, **`study_subjects`**, **`studies`**, **`study_versions`** furnish header context; **`visit_definition_id`** + version surrogate columns if added in **4A**. |
| **Procedure + source binding** | Same as tabular exports: **`procedure_executions.source_definition_version_id`** plus fact rows keyed **`(procedure_execution_id, source_definition_version_id)`**. |
| **Temporal columns on facts** | Item-level facts need **`created_at`**, **`updated_at`**; **immutable-after-lock** semantics coordinated with visit lock (existing patterns extended in **4B**). **`corrected_at`** may be synthesized from **`operational_events`** where `*_CORRECTED` types attach to visit/execution/item **or** modeled as explicit nullable column set on fact rows (**design choice during 4B**). |
| **Signatures** — **Phase 4E prerequisite for full §2 rule 5** | New modeled entities expected, e.g. **`visit_signature`** / **`execution_signature`** (or polymorphic **`signatures`**): `organization_id`, `study_id`, `visit_id`, optional **`procedure_execution_id`**, signer **`user_id`**, role snapshot, **`signed_at`**, **`meaning_code`** FK → study-configurable catalog, cryptographic optional fields. PDF reads these rows verbatim. |
| **Lock status** | Uses **`visits.visit_status`** / **`locked_at`** / **`locked_by_user_id`** (Phase 3C) and **`procedure_executions.execution_status`** (`verified`); **Phase 4E** may tighten eligibility for signing. |
| **Audit linkage** | **`audit_events`** remain security/compliance stream; PDF lists **references** only. Operational truth stays in **`operational_events`**. |
| **`RECORD_EXPORTED`** | Each generated/stored artifact generation records **`audit_events`** with export scope (**`visit_id`**, artifact hash placeholder). |

---

## 4. Change timepoints — mapping expectation

Until **DDL lands**, PDF composition logic MUST derive display fields from authoritative sources:

| Display label | Primary sources (preferred order) |
|---------------|-----------------------------------|
| `created_at` | Fact row / attachment / execution **`created_at`** |
| `updated_at` | Fact row **`updated_at`** (if policy allows edits pre-lock); else omit row or show lock note |
| `corrected_at` | **`operational_events.occurred_at`** for corrective event types touching the entity OR dedicated **`corrected_at`** column if modeled |
| `signed_at` | **`signatures.signed_at`** (**Phase 4E**) |
| `locked_at` | **`visits.locked_at`** (and optionally execution-level QC freeze timestamps later) |

**Rule:** If a timestamp is materially unknown prior to modeled columns (e.g. **`signatures`** in **Phase 4E**), the PDF renders **explicit “pending attestation milestone”** placeholders only in **draft** tooling — production packets MUST NOT fabricate timestamps.

---

## 5. Export artifact strategy (**Phase 4C** vs **production hardening**)

| Mode | Behavior |
|------|-----------|
| **On-demand PDF** | Server composes PDF from DB read models + watermark “generated `{ISO timestamp}`”; **`audit_events`** insert **`RECORD_EXPORTED`** |
| **Immutable stored artifact** (post-lock option) | After **`visit`** (or QC milestone) **`locked`**, optional job writes **`storage_path`**, **`content_sha256`**, **`frozen_at`** to e.g. **`visit_export_artifacts`** (planned table — not implemented now); binds **visit row version** at freeze; prevents silent overwrite (**append-only** new artifact revision if superseded policy allows) |

**Principles:**

- Stored artifacts **must not** silently change when questionnaire templates update site-wide — they snapshot **referenced ids + hashes** optional.
- RLS mirrors study access; artifact download audited.
- **PHI posture** unchanged — follow **`phi-boundaries.md`** for egress and logging.

---

## 6. Roadmap linkage

| Phase | Name | Relation to PDF |
|-------|------|-----------------|
| **4A** | Versioned Protocol Builder | Definitions + versioning needed to label PDF sections accurately |
| **4B** | Versioned Dynamic eSource Runtime | Execution-time **`source_definition_version_id`** binding and factual timestamps populate packet body |
| **4C** | Visit PDF Packet Export | **This document**: rendering references, TOC, PHI-safe trims, **`RECORD_EXPORTED`**, optional artifact persistence |
| **4D** | Clean CSV / Excel Export Engine | Tabular exports per **`ARCHITECTURE-VERSIONED-EXPORTS.md`** |
| **4E** | **eSignature** / Freeze / QC | **`electronic_signatures`** (**FDA §D**): meaning codes, **`signed_at`** (**§C UTC**), integrity ref, tightened lock eligibility |
| **4F** | Query Engine | Discovery without collapsing version boundaries; may trigger regulated PDF pulls |
| **4G** | Training / Delegation / Authorization | **FDA §M** — qualification + delegation logs for regulated actions |

---

## 7. Next implementation step

**Remain on Phase 4A — Versioned Protocol Builder schema design** (**`PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md`** + **`FDA-ESOURCE-PART11-READINESS`** *Exact next implementation step*). **Immediately before Phase 4C**, finalize packet outline + correction/timestamp matrix per **`append-only-event-architecture.md`**.

---

## 8. References

- `docs/FDA-ESOURCE-PART11-READINESS.md` — **§§A–M**; **ALCOA+** (*ALCOA+ Data Integrity Architecture*); **§§C,H** timestamps and packets; §**D**

- `docs/ARCHITECTURE-VERSIONED-EXPORTS.md` — version-scoped tabular exports, no silent mixing
- `docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md`
- `projects/vilo-os/10_DECISIONS/phi-boundaries.md`
- `projects/vilo-os/10_DECISIONS/audit-strategy.md`
- `projects/vilo-os/10_DECISIONS/append-only-event-architecture.md`
- `projects/vilo-os/10_DECISIONS/rbac-model.md`
