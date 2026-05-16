# Phase 2 — Clinical domain schema plan

**Status:** Planning only — **no SQL migrations and no UI** until explicitly approved.

**Corrections vs generic sketches:**

| Requirement | Decision |
|-------------|----------|
| Tenancy column | **`organization_id`** everywhere (never `org_id`) |
| Compliance/security audit | Existing **`audit_events`** table only — **do not** add `audit_log` |
| Clinical/business timeline | **`operational_events`** — separate append-only stream |
| PHI posture | Synthetic staging until BAA; follow Verdent `projects/vilo-os/10_DECISIONS/phi-boundaries.md` |

This document translates a typical clinical CTMS-style domain model into **Vilo OS** conventions: multi-site research operations with **visit/procedure execution** as the operational spine and **derived** compliance/finance signals later.

---

## 1. Design principles

1. **organization_id** is the mandatory tenant boundary on every clinical row (UUID FK → `organizations`).
2. **Study-scoped access** uses **`study_members`** (plus org membership); RLS never trusts URL/query alone.
3. **audit_events** — immutable-style security/compliance trail (who exported, role changed, privileged reads when instrumented). Populated via server/service patterns already in scaffold (`lib/audit/log.ts`).
4. **operational_events** — append-only workflow/source-of-truth stream for visits and procedures (scheduled, checked in, completed, corrected). Corrections use compensating events, not silent UPDATE.
5. **Convenience tables** (`visits`, `procedure_executions`) hold **materialized current state** updated in the **same transaction** as the matching `operational_events` insert (Phase 2 implementation detail — still documented here).
6. **Attachments** (`attachments`) reference studies/subjects/visits/procedures without mixing PHI into audit payloads.

Naming: English-only identifiers per `english-ui-primary` decision (Verdent portfolio docs).

---

## 2. Entity overview (conceptual)

```
organizations (existing)
    └── studies
            └── study_versions (protocol/version snapshots)
            └── study_members (RBAC bridge)
            └── visit_definitions ── visit_def_procedure_map ── procedure_definitions
            └── study_subjects (site enrollment)
                    └── visits (scheduled/performed instances)
                            └── procedure_executions (line-level performed work)
                                    └── operational_events (append-only facts)
attachments → polymorphic link to study / subject / visit / execution (organization_id denormalized)
audit_events (existing) ← security actions only
```

---

## 3. Migration sequence (ordered)

Apply **after** `0001_auth_foundation.sql` and `0002_audit_foundation.sql`. **Do not re-order** without reviewing FK dependencies.

| Order | Migration file (planned name) | Purpose |
|-------|-------------------------------|---------|
| 0003 | `0003_studies.sql` | `studies` — protocol shell per organization |
| 0004 | `0004_study_versions.sql` | `study_versions` — immutable protocol version rows |
| 0005 | `0005_study_members.sql` | `study_members` — study-scoped RBAC |
| 0006 | `0006_visit_procedure_definitions.sql` | `visit_definitions`, `procedure_definitions`, `visit_def_procedure_map` |
| 0007 | `0007_study_subjects.sql` | `study_subjects` — enrollment registry |
| 0008 | `0008_visits.sql` | `visits` — scheduled/performed visit instances |
| 0009 | `0009_procedure_executions.sql` | `procedure_executions` — performed procedure rows |
| 0010 | `0010_operational_events.sql` | `operational_events` — append-only event stream |
| 0011 | `0011_attachments.sql` | `attachments` — metadata + storage path |

**Rationale:**

- **study_versions** before heavy subject data so subjects can optionally reference `study_version_id`.
- **Definitions** (`visit_definitions`, `procedure_definitions`, map) before **instances** (`visits`, `procedure_executions`) so instances FK to definitions.
- **operational_events** after visits and executions exist so events reference stable FKs (`visit_id`, `procedure_execution_id`).
- **attachments** last to reference any parent entity without circular FK pressure.

---

## 4. Table definitions (conceptual — no DDL yet)

### 4.1 studies

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | FK → organizations, NOT NULL |
| `slug` | Unique per organization (optional) |
| `name`, `status` | Operational labels |
| `created_at`, `updated_at` | Standard timestamps |

### 4.2 study_versions

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | NOT NULL |
| `study_id` | FK → studies |
| `version_label` | e.g. `Amendment 2`, `Protocol v3` |
| `effective_date`, `protocol_identifier` | IRB/protocol refs |
| `metadata` | JSONB — optional structured protocol facts **without PHI narratives** |

RLS: organization membership + study_membership.

### 4.3 study_members

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | NOT NULL (denormalized for simpler RLS) |
| `study_id` | FK → studies |
| `user_id` | FK → auth.users |
| `role` | Align with portfolio RBAC: `study_admin`, `coordinator`, `monitor`, `lab`, `finance`, `viewer`, … |

Unique `(study_id, user_id)`. RLS primary mechanism for study-level isolation.

### 4.4 visit_definitions

Template for a visit **type** within a study (e.g. Screening Day 1, Week 4).

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id`, `study_version_id` (optional) |
| `code` | Stable machine code e.g. `V1_SCREENING` |
| `label`, `sort_order` | Display |

### 4.5 procedure_definitions

Atomic billable / schedulable procedure template.

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id`, `study_version_id` (optional) |
| `code` | e.g. `LAB_CBC`, `PK_SAMPLE` |
| `label`, `is_required_default`, `billable_default` | Operational flags |

### 4.6 visit_def_procedure_map

Many-to-many: which procedures belong to which visit definition.

| Column | Notes |
|--------|--------|
| `visit_definition_id`, `procedure_definition_id` |
| `organization_id`, `study_id` | Denormalized for RLS performance |
| `sort_order`, `is_required` | Per-map overrides |

### 4.7 study_subjects

Site enrollment row (subject in study context).

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id` |
| `subject_identifier` | Screening/enrollment ID — **PHI-adjacent** |
| `enrollment_status` | Enum (see §6) |
| `consented_at`, `randomization_arm` (nullable / blinded handling later) |

### 4.8 visits

Concrete scheduled or performed visit instance.

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id`, `study_subject_id` |
| `visit_definition_id` | FK |
| `scheduled_date`, `scheduled_window_end` | Scheduling |
| `visit_status` | Enum (see §6) |
| `occurred_at`, `completed_at` | Materialized convenience |

### 4.9 procedure_executions

One row per procedure expected/performed on a visit.

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id`, `visit_id` |
| `procedure_definition_id` | FK |
| `execution_status` | Enum (see §6) |
| `performed_at`, `performed_by_user_id` | Materialized convenience |
| `billable_flag`, `billable_override_reason` | Finance hooks later |

### 4.10 operational_events

Append-only clinical/business stream.

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | NOT NULL |
| `study_id` | NOT NULL |
| `visit_id` | Nullable only if event is pre-visit (rare); prefer NOT NULL for visit-scoped events |
| `procedure_execution_id` | Nullable |
| `event_type` | Enum string (see §6) |
| `payload` | Small JSONB — **no PHI blobs**; references IDs + deltas |
| `actor_user_id` | Who caused the transition |
| `occurred_at` | Business time |
| `created_at` | Insert time |

**Append-only:** application roles get **SELECT + INSERT** only where appropriate; **no UPDATE/DELETE** policies for end users. Corrections via `*_CORRECTED` event types.

### 4.11 attachments

| Column | Notes |
|--------|--------|
| `id`, `organization_id`, `study_id` |
| `entity_type` | `study`, `study_subject`, `visit`, `procedure_execution`, … |
| `entity_id` | UUID |
| `storage_bucket`, `storage_path`, `file_name`, `mime_type`, `size_bytes` |
| `uploaded_by_user_id`, `created_at` |

Storage bucket policies must mirror organization/study access (implementation follows Phase 2b).

---

## 5. RLS strategy (organization_id–centric)

### 5.1 Baseline rule

Every Phase 2 table:

- Enables **RLS**.
- Includes **`organization_id`** NOT NULL.
- Policies require:

```text
organization_id IN (
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
)
```

AND for study tables:

```text
study_id IN (
  SELECT study_id FROM study_members WHERE user_id = auth.uid()
)
```

Refine **SELECT / INSERT / UPDATE / DELETE** per role via:

- **`study_members.role`** checks inside policies (or SECURITY DEFINER helpers audited separately — prefer plain policies + indexes first).

### 5.2 operational_events

- **SELECT:** users with membership for `study_id` (role-dependent read — coordinators vs monitors).
- **INSERT:** coordinators/nurses/study_admin only (explicit role allow-list).
- **UPDATE / DELETE:** **none** for authenticated JWT roles.

### 5.3 audit_events

Keep existing behavior: **admin/owner read**; inserts via **service role** only (no competing `audit_log` table).

### 5.4 Defense in depth

Server Actions must still resolve `organization_id` + `study_id` from membership, never from unchecked client body alone (align with Verdent cross-tenant tests).

---

## 6. Append-only strategy — operational_events

| Rule | Detail |
|------|--------|
| Immutability | No UPDATE/DELETE policies for application roles |
| Corrections | Insert `VISIT_STATUS_CORRECTED`, `PROCEDURE_EXECUTION_CORRECTED` with `payload.reason_code`, `payload.previous_status` |
| Transaction | Same transaction: INSERT operational_events + UPDATE materialized `visits` / `procedure_executions` |
| Payload limits | Cap JSON size; forbid full free-text clinical notes in payload |
| Idempotency | Optional unique partial index on `(event_type, visit_id, dedupe_key)` for automation later |

---

## 7. Lifecycle enums (English identifiers)

### 7.1 Enrollment (`study_subjects.enrollment_status`)

Suggested:

- `screening`
- `screen_failed`
- `enrolled`
- `withdrawn`
- `completed`

### 7.2 Visit (`visits.visit_status`)

Suggested:

- `scheduled`
- `checked_in`
- `in_progress`
- `completed`
- `cancelled`
- `no_show`

### 7.3 Procedure execution (`procedure_executions.execution_status`)

Suggested:

- `pending`
- `in_progress`
- `completed`
- `not_applicable`
- `cancelled`

### 7.4 operational_events.event_type (non-exhaustive)

**Visit:**

- `VISIT_SCHEDULED`
- `VISIT_CHECKED_IN`
- `VISIT_STARTED`
- `VISIT_COMPLETED`
- `VISIT_CANCELLED`
- `VISIT_NO_SHOW`
- `VISIT_STATUS_CORRECTED`

**Procedure:**

- `PROCEDURE_STARTED`
- `PROCEDURE_COMPLETED`
- `PROCEDURE_MARKED_NA`
- `PROCEDURE_CANCELLED`
- `PROCEDURE_EXECUTION_CORRECTED`

**Cross-cutting:**

- `ATTACHMENT_LINKED` (optional — can defer to attachments trigger layer)

Policy: **`audit_events.action`** stays separate — use stable audit codes (`RECORD_EXPORTED`, `ROLE_CHANGED`), not duplicates of operational_events.

---

## 8. First vertical slice (end-to-end story)

**Goal:** Prove Study → Subject → Visit → Procedure → **operational_event** → optional **audit_event**.

| Step | System behavior |
|------|------------------|
| 1 | Study exists with `study_members` for test user |
| 2 | `study_subject` created (`enrollment_status = screening` → `enrolled`) |
| 3 | `visit_definitions` + `procedure_definitions` + map seeded |
| 4 | `visit` scheduled (`VISIT_SCHEDULED` operational_events row + materialized status) |
| 5 | `procedure_executions` rows instantiated from map when visit moves to `checked_in` or `in_progress` (implementation choice documented at build time) |
| 6 | User completes procedure → `PROCEDURE_COMPLETED` + execution row updated |
| 7 | Visit completion → `VISIT_COMPLETED` |
| 8 | Optional: sensitive export triggers **`audit_events`** row via server helper |

**Out of slice:** finance accruals, eSource forms, queries, biospecimen chain-of-custody.

---

## 9. Risks before implementation

| Risk | Mitigation |
|------|------------|
| **RLS recursion** | Policies on `study_members` referencing itself — use EXISTS patterns carefully; test `rls-validation-tests.md` early |
| **Denormalized organization_id** | Drift vs `study.organization_id` — enforce CHECK/FK triggers or generate organization_id from study in application layer |
| **Duplicate procedure_executions** | Unique `(visit_id, procedure_definition_id)` where repeated draws needed → use occurrence index column later |
| **Operational payload PHI** | Ban narratives in `payload`; restrict columns by role via views later |
| **Monitor/blinded roles** | Not in MVP slice — add views or column-level policies before CRA accounts |
| **Attachment storage leakage** | Bucket policies must match DB RLS; signed URLs audited |
| **Migration blast radius** | Ship migrations incrementally; verify each step on staging synthetic data |
| **audit_events noise** | Do not mirror every operational_events row into audit_events — reserve for security/compliance |

---

## 10. Deliverables checklist (when Phase 2 coding opens)

- [ ] Author SQL migrations `0003`–`0011` matching this plan  
- [ ] Regenerate Supabase types  
- [ ] Extend `npm run db:validate` with study isolation fixtures  
- [ ] Document seed SQL for vertical slice  
- [ ] Portfolio decision log entry if enums or naming diverges  

---

## 11. Version-scoped exports and visit PDF packets (Phase 4 — planning only)

Exported eSource and tabular extracts must be **version-scoped**: one **clean rectangular table per `source_definition` version**, no mixing versions in CSV or Excel primary sheets/files (**`docs/ARCHITECTURE-VERSIONED-EXPORTS.md`**). **`procedure_executions`** must **bind `source_definition_version_id` at first capture**, with protocol changes expressed as **new study/source versions**, not mutations of historic rows.

**Visit-level PDF packets** — **`docs/ARCHITECTURE-VISIT-PDF-PACKET.md`** — implement **FDA §H** (human-readable visit reconstruction).

**ALCOA+** (**Attributable, Legible, Contemporaneous, Original, Accurate, Complete, Consistent, Enduring, Available**) is a **first-class** contract in **`docs/FDA-ESOURCE-PART11-READINESS.md`** (*ALCOA+ Data Integrity Architecture*). Exports (**`ARCHITECTURE-VERSIONED-EXPORTS`**), PDF (**`ARCHITECTURE-VISIT-PDF-PACKET`**), and Phase **4B+** schema execute those pillars alongside **Sections A–M**.

Full FDA/eSource posture: **`docs/FDA-ESOURCE-PART11-READINESS.md`** (**Sections A–M** — principles, audit model **§B**, server UTC **§C**, signatures **§D**, durable source **§E**, corrections **§F**, reconstruction **§G**, transfer **§J**, classification **§K**, retention **§L**, training/delegation **§M**, **Phase 4G**).

Operational corrections remain **append-only** via **`operational_events`** and future **`source_response_corrections`** (**FDA §F**).

Roadmap **4A–4G**, **ALCOA+**, and detailed **Phase 4A instrument schema**: **`FDA-ESOURCE-PART11-READINESS`**, **`PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA`**, **`ARCHITECTURE-VERSIONED-EXPORTS`**, **`ARCHITECTURE-VISIT-PDF-PACKET`**.

---

## References

- Verdent portfolio: `Clinical Research Operations OS eClinPro/projects/vilo-os/10_DECISIONS/` (`organization_id.md`, `append-only-event-architecture.md`, `audit-strategy.md`, `rbac-model.md`, `phi-boundaries.md`)  
- `docs/FDA-ESOURCE-PART11-READINESS.md` — FDA / Part 11 posture (**§§A–M**), **ALCOA+** architecture, guardrails, **§C** server UTC  
- `docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md` — **Phase 4A** versioned protocol/source builder (**planning**)  
- Existing scaffold: `supabase/migrations/0001_*`, `0002_*`  
- Phase 1b: `docs/PHASE1B-RUNBOOK.md`
