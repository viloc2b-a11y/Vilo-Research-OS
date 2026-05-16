# Phase 4A — Versioned Protocol Builder (schema design)

**Status:** **Planning / documentation only.** No DDL shipped in this artifact. Guides **FDA / Part 11 / ALCOA+** posture per **`FDA-ESOURCE-PART11-READINESS.md`**.

**Product rule:** **Nothing clinical execution becomes fixed until a protocol/source version is *published*.** Drafts remain mutable. **Published** rows are immutable for authoring payloads; operational history binds to **frozen** **`source_definition_version_id`**. Inspection/replay reads **persisted** execution-linked versions, never live drafts.

**Constraints:** Do **not** change **GREEN** Phase **3C** RPCs in this phase. Do **not** build UI, form canvas, captures, exports, signatures, QC queries, or AI.

**Canonical codebase:** **`VILO CTMS/vilo-os`** — existing spine: **`studies`** → **`study_versions`** → **`visit_definitions`** / **`procedure_definitions`** (**`0006`**) → **`visits`** / **`procedure_executions`** (**`0008`/`0009`**) → **`operational_events`** (**`0010`**).

---

## A. Proposed ERD

```mermaid
erDiagram
  organizations ||--o{ studies : tenants
  studies ||--o{ study_versions : protocol_windows
  studies ||--o{ source_definitions : instruments
  source_definitions ||--o{ source_definition_versions : revisable_snapshots_until_publish
  source_definition_versions ||--o{ source_fields : items_when_normalized
  study_versions ||--o{ source_definition_versions : optional_window
  procedure_definitions ||--o{ procedure_source_bindings : default_source
  source_definition_versions ||--o{ procedure_source_bindings : published_default_fk
  visit_definitions ||--o{ visit_source_bindings : optional_per_visit_overlay
  source_definition_versions ||--o{ visit_source_bindings : published_fk_optional
  procedure_executions }o--o| source_definition_versions : binds_at_activation_or_capture

  studies {
    uuid id PK
    uuid organization_id FK
    text slug
    text name
  }

  study_versions {
    uuid id PK
    uuid study_id FK
    uuid organization_id
    text version_label
  }

  source_definitions {
    uuid id PK
    uuid organization_id FK
    uuid study_id FK
    text code UK_study_scope
    text label
  }

  source_definition_versions {
    uuid id PK
    uuid source_definition_id FK
    uuid study_id FK
    uuid organization_id FK
    uuid study_version_id FK_null
    text lifecycle_status
    uuid supersedes_version_id FK_null
    text schema_manifest_hash
    timestamptz published_at_null
    uuid published_by_user_id_null
    timestamptz created_at
    timestamptz updated_at
  }

  source_fields {
    uuid id PK
    uuid source_definition_version_id FK
    text field_key
    boolean is_required
    int sort_order
  }

  procedure_source_bindings {
    uuid id PK
    uuid procedure_definition_id FK
    uuid default_source_definition_version_id FK
    uuid organization_id FK
    uuid study_id FK
    boolean is_optional_proc_source
  }

  procedure_executions {
    uuid id PK
    uuid procedure_definition_id FK
    uuid source_definition_version_id_null FK_future
  }
```

**Notes**

- **`visit_source_bindings`** is **optional**. Use when a visit type overrides the procedure-level default instrument; otherwise **`procedure_source_bindings`** alone may suffice Phase **4B** MVP.
- **`procedure_executions.source_definition_version_id`** is additive (nullable until **Phase 4B** bind rules); aligns with **`FDA`** / **`ARCHITECTURE-VERSIONED-EXPORTS`** execution-time versioning.

---

## B. Tables and key columns

### B.1 `source_definitions`

Stable **instrument lineage** (“VITALS”, “AE_LOG”, PK instrument) scoped to **study** (and **`organization_id`** denormalized for RLS).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL FK | |
| `study_id` | uuid NOT NULL FK | |
| `code` | text NOT NULL | Unique per **`(study_id, code)`**. |
| `label` | text NOT NULL | **ALCOA+ Legible** display. |
| `description` | text | Optional investigator-facing synopsis. |
| `created_at` | timestamptz | Server (**§C UTC** posture). |

No **delete** of definitions that underpin **published** versions — use **retired** lineage on version rows (**FDA** guardrail).

---

### B.2 `source_definition_versions`

One row per **draft or published revision** of a **`source_definitions`** instrument.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Stable identity once referenced from runtime. |
| `organization_id` | uuid NOT NULL | Denormalized. |
| `study_id` | uuid NOT NULL | |
| `source_definition_id` | uuid NOT NULL FK | Parent instrument. |
| `study_version_id` | uuid NULL FK → `study_versions` | Optional linkage: “authored under this protocol window”. |
| `version_label` | text | Author-facing e.g. `v3-draft`, `published-2027-03-01`. |
| **`lifecycle_status`** | text ENUM | **`draft`** \| **`in_review`** \| **`published`** \| **`retired`** \| **`amended`**. See **§ C**. |
| `supersedes_version_id` | uuid NULL FK self | Previous **published** / **retired** line when lineage explicit. |
| `schema_manifest_hash` | text | Canonical hash of authored schema (computed server-side **pre-publish**). |
| **`published_at`** | timestamptz NULL | Set **once** when transitioning → **`published`**; immutable thereafter. |
| **`published_by_user_id`** | uuid NULL | **`auth.users`**; **Attributable**. |
| **`retired_at` / `retired_by_user_id`** | optional | When **`lifecycle_status`** = **`retired`**. |
| `created_at` | timestamptz | Server UTC. |
| `updated_at` | timestamptz | **Allowed while `lifecycle_status ∈ {draft, in_review}`**; **frozen** semantics after **`published`** except status-only moves to **`retired`/`amended`** without payload mutation (policy detailed in **§C**). |

**Optional JSON blob:** `instructions_markdown` or `builder_metadata jsonb` (PHI-safe) for pack-level prose — still **immutable** once **published**.

---

### B.3 `source_fields`

Normalized **machine items** for a **given `source_definition_version_id`**. Enables **Completeness**, validation rules, ordering.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `source_definition_version_id` | uuid NOT NULL FK | |
| **`field_key`** | text NOT NULL | Stable machine key (**unique per version row**). |
| `label` | text NOT NULL | Human label (**Legible**). |
| **`instructions`** | text NULL | Supplemental human text. |
| `sort_order` | int NOT NULL | |
| **`is_required`** | boolean NOT NULL | **ALCOA+ Complete**. |
| `validation_rules` | jsonb NOT NULL DEFAULT `{}` | e.g. min/max length, enumerated codes — **server-evaluated**. |
| `widget_hint` | text | `number`, `date`, `select`, … (**UI-agnostic**, runtime interprets Phase **4B**). |

Authoring **may edit** rows only while parent version **`draft`/`in_review`**. **Published** freezes field rows (**no UPDATE**/DELETE policies for app roles; corrections = **new version**).

---

### B.4 `procedure_source_bindings`

Default **instrument version** mounted on a **`procedure_definitions`** template for scheduling/instantiation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organization_id`, `study_id` | uuid NOT NULL | RLS parity. |
| `procedure_definition_id` | uuid NOT NULL FK UNIQUE (per logical binding) | Or **`UNIQUE(study_id, procedure_definition_id)`** if single default. |
| **`default_source_definition_version_id`** | uuid NOT NULL FK | MUST reference **`lifecycle_status = published`** (**DB trigger**) except deliberate NULL only if instrument truly absent (explicit policy). |

When **`procedure_execution`** rows are created (**Phase 4B**), runtime copies **`default_source_definition_version_id`** → **`procedure_executions.source_definition_version_id`** (first activation or first capture boundary — exact trigger in **4B**, not Phase **4A** DDL).

---

### B.5 `visit_source_bindings` (optional)

| Column | Purpose |
|--------|---------|
| `visit_definition_id` FK | Visit template override lane. |
| `procedure_definition_id` FK NULL | Narrow override to proc within visit scope. |
| `default_source_definition_version_id` FK | **Published only**. |

Keeps **`visit_definitions`** coherent with **`study_versions`** when visit-level questionnaires differ.

---

### B.6 `protocol_builder_drafts` *(optional)*

**Recommendation:** Prefer **omit** Phase **4A** — represent drafts solely as **`source_definition_versions`** in **`draft`/`in_review`**. Add **`protocol_builder_drafts`** later only if product requires:

- branching drafts concurrent per **`source_definitions`**, or  
- autosave workspaces larger than normalized **`source_fields`**.

---

### B.7 `version_publish_events` (**optional)**

**Recommendation:** Prefer **append-only `operational_events`** with audited semantics:

| `event_type` (proposed strings) |
|--------------------------------|
| `SOURCE_DEFINITION_VERSION_PUBLISHED` |
| `SOURCE_DEFINITION_VERSION_SUBMITTED_REVIEW` |
| `SOURCE_DEFINITION_VERSION_RETIRED` |
| `SOURCE_DEFINITION_VERSION_SUPERSEDED` |

Payload: **`source_definition_version_id`**, **`prior_lifecycle_status`**, **`manifest_hash`**, optional **`study_version_id`**. **`occurred_at` / `created_at`** server UTC; **`actor_user_id`** mandatory (**Attributable**).

Separate **`audit_events`** row acceptable for SOC2-style escalation but **avoid PHI** payloads.

---

## C. Lifecycle rules

States:

| Status | Meaning | Mutability |
|--------|---------|-------------|
| **`draft`** | Authoring workspace | **`source_definition_versions`** + **`source_fields`** editable; **no** runtime bind to subjects. |
| **`in_review`** | QC / sponsor review lane | Controlled transition from **`draft`**; edits limited by role; still **no** patient binding. |
| **`published`** | **Frozen authoring snapshot** — **instrument of record** for new executions | Payload **immutable** (**no destructive UPDATE**/DELETE); becomes eligible as **`procedure_source_bindings.default_*`** FK target. |
| **`retired`** | Withdrawn **for new binds** only | Keeps FK integrity for historic **`procedure_executions`** referencing this **`id`**; disallow new binds via trigger + bindings filter. |
| **`amended`** | Lineage bookkeeping | **Recommendation:** Treat as **taxonomy** synonym for **`retired`** with **`supersedes_version_id`** populated to **new published** successor **or** use **`retired` + operational_event `SUPERSEDED`** exclusively to reduce ENUM drift (**pick one enum at DDL time** — document mandates single meaning). |

**Publish transition (authoritative)**

1. Compute **`schema_manifest_hash`** server-side.  
2. Validate required metadata (**Complete** checklist).  
3. Set **`lifecycle_status='published'`**, **`published_at=now()` (UTC)** , **`published_by_user_id`**.  
4. Insert **`operational_events`** (**+ optional `audit_events`**).  
5. **Reject** publish if HASH collision / invalid refs.

**“Amended” clinically** = **create new `source_definition_versions` row**, publish — **never** overwrite prior **published** row (**FDA**, **ALCOA+ Original / Enduring**).

---

## D. RLS strategy

Guiding principles (align **`PHASE2-CLINICAL-DOMAIN-SCHEMA`** + **`FDA-ESOURCE-PART11-READINESS`** **§ Guardrails**, **§K** classifications):

| Policy | Outline |
|--------|---------|
| **`organization_id` on every Phase 4A table** | Baseline tenancy. |
| **SELECT** | Members with **`user_has_study_access(study_id)`** (+ org admin bypass pattern consistent with **`procedure_definitions`** reads). |
| **INSERT draft versions / fields / bindings** | **`study_admin`**, **`coordinator`**; optional **`study_regulatory`** if introduced (future **4G** alignment). **Restrict `monitor`** to read-only authoring. |
| **UPDATE restricted** | **Only** rows where **`lifecycle_status ∈ {'draft','in_review'}`** for payload tables; **`published`** — **policy denies UPDATE on `source_fields` / frozen columns** (**except** status-only escalation to **`retired`** possibly via audited RPC **`SECURITY INVOKER`**). |
| **DELETE** | **Deny for authenticated clinical roles on published artefacts** (**FDA**: no deleting published defs). Prefer **lifecycle** instead. |
| **No public/anonymous access** (`anon`). |
| **`service_role` bypass** | Allowed only infra jobs outside clinician UX — **not** normal clinical lifecycle writes. |

Prefer **narrow SECURITY DEFINER RPCs** for **`publish`** / **`retire`** (mirrors **`complete_procedure_execution`** paradigm) versus broad UPDATE rights.

---

## E. FDA / Part 11 / ALCOA+ implications

| Requirement | Mechanical enforcement |
|-------------|------------------------|
| **No overwriting published source versions** | RLS + no UPDATE triggers on **`source_fields` / authored columns** once **`published`**. |
| **No deleting published definitions** | No DELETE policies; lineage via **`retired`**. |
| **Amend requires new version** | New **`source_definition_versions`** row + publish; linkage **`supersedes_version_id`**. |
| **Signature compatibility later** (**4E**) | **`electronic_signatures.source_definition_version_id`** already planned — bind to **published only**. |
| **Human-readable reconstruction** | **`labels`/`instructions`** on **`source_definitions` / `source_fields`**; **`source_response_sets`** (Phase **4B**) keyed by **`source_definition_version_id`**. |
| **Audit publish lifecycle** | **`operational_events`** + **`actor_user_id`** + server **`occurred_at`**. |
| **No client trusted regulated timestamps** | Publish RPC sets **`published_at`**; client displays only. |

**ALCOA+ checklist mapping**

| Pillar | Builder phase hook |
|--------|-------------------|
| **Attributable** | `published_by_*`, ops events, binding editor user ids (Phase **4B** instantiation log). |
| **Legible** | Labels + instructions texts. |
| **Contemporaneous** | **`published_at`**, **`created_at`**, server defaults. |
| **Original** | **Published snapshot** authoritative; executions never point at **draft**. |
| **Accurate** | **`validation_rules`**, constrained ENUM lifecycle transitions. |
| **Complete** | **`is_required`**, future **`missing_required_items`/`deviations`** linkage from FDA doc. |
| **Consistent** | Procedures bind **explicit `default_source_definition_version_id`**. |
| **Enduring** | Immutable **published**. |
| **Available** | RLS SELECT for entitled roles + future exports read **frozen execution-bound version**. |

### Snapshot & binding discipline (task 5 / runtime alignment)

**`study_versions`:** Optional FK **`study_version_id`** on **`source_definition_versions`** aligns instruments with protocol amendments. **`visit_definitions` / `procedure_definitions`** keep optional **`study_version_id`** — publish validates window consistency.

**`procedure_executions`:** **`source_definition_version_id`** (future nullable column): populated **≤ first substantive capture** (**Phase 4B**); FK MUST target **`lifecycle_status='published'`** at bind time (**trigger**). **Exports/PDF** read persisted FK only — never current **`procedure_source_bindings`** defaults (**ALCOA+ Consistent**; **`ARCHITECTURE-VERSIONED-EXPORTS`**).

**`visit_definitions`:** Optional **`visit_source_bindings`** overlays; forbid draft FKs at publish.

**Future `source_response_sets`:** Reference **`procedure_execution_id` + `source_definition_version_id`**; immutable post-submit (see **`FDA-ESOURCE-PART11-READINESS`**).

---

## F. Planned migration sequence (documentation only — file numbers illustrative)

Recommended **after existing `0013_*`** unless repository re-numbers:

| Order | File name (planned) | Content |
|-------|---------------------|---------|
| 1 | **`0014_source_definitions.sql`** | Table + indexes + enable RLS + policies (**SELECT/INSERT**, restricted UPDATE none or owner-only drafts via partial policy). |
| 2 | **`0015_source_definition_versions.sql`** | Table + states CHECK + FK self `supersedes` + FK `study_versions`; partial unique index enforcing **≤1 draft per definition** optionally. |
| 3 | **`0016_source_fields.sql`** | Table + FK + unique **`(source_definition_version_id, field_key)`**. |
| 4 | **`0017_procedure_source_bindings.sql`** | Table + trigger **default_source_definition_version_id must be published** + FK uniq per procedure. |
| 5 | **`0017b_visit_source_bindings.sql`** (\*optional\* split) | If visit overrides mandated. |
| 6 | **`0018_procedure_executions_source_version.sql`** | `ALTER ADD COLUMN IF NOT EXISTS source_definition_version_id` **NULL** + FK + future trigger skeleton (**no breakage** Phase **3C** RPC semantics). |
| 7 | **`0019_publish_source_version_rpc.sql`** (\*later approval\*) | `SECURITY INVOKER` publish transitions only — **implement Phase 4A close or Phase 4B open** pending review. |

**Important:** Applying **`0018`** as **nullable FK only** keeps **GREEN** RPCs deterministic; populate column in **Phase 4B**.

---

## G. Validation plan (future `db:validate-phase4a` — not scripted yet)

| Test | Objective |
|------|-----------|
| **Lifecycle** | Cannot publish draft missing required fields (`is_required` non-null answer — placeholder until captures exist validate schema graph only). |
| **Binding integrity** | `procedure_source_bindings.default_*` rejects non-**published** targets. |
| **Immutability** | Attempt UPDATE `source_fields` where parent **published** — expect **policy/trigger denial**. |
| **RLS isolation** | User B zero rows on Org A authoring tables. |
| **Execution bind** (**4B**) | Once populated, FK matches binding at instantiation time baseline fixture. |

---

## H. Risks & anti-patterns

| Risk | Mitigation |
|------|------------|
| **Editing published definitions “just a hotfix”** | Blocked — ship **new version** row; communicate training impact (**4G**). |
| **Binding procedure to draft by mistake** | DB trigger restricting FK to **`published`** + publish RPC tests. |
| **Client-sent `published_at`** | Publish RPC ignores body clock; purely server `now()` UTC. |
| **Huge JSON payloads in version row** vs normalized fields | Prefer **`source_fields`** for regulated exports; JSON only auxiliary. |
| **`UNIQUE (visit_id, procedure_definition_id)` races** (**0009**) | Instantiate executions once; binding copy idempotent (**4B**). |
| **`DELETE CASCADE` nuking histories** | Use **RESTRICT**/soft lifecycle — never drop published artefacts. |

---

## I. Explicit non-goals & exact next step

### I.1 Phase 4A non-goals (do not ship from this milestone)

Do **NOT** ship yet:

- Visual drag-and-drop builder UI  
- **`source_response_sets` / `source_responses` / corrections** (**Phase 4B**)  
- Visit PDF (**4C**) / CSV–Excel (**4D**)  
- **Signatures** (**4E**)  
- Dedicated query consoles / QC dashboards (**4F**) beyond baseline read policies  
- **AI** authoring assist  
- Any change to GREEN **`complete_visit`**, **`lock_visit`**, **`complete_procedure_execution`** **logic** (**nullable FK `ADD`** only after sign-off migration **`0018_...`**, Phase **4B** population rules).

Full risk catalogue: §**H**.

### I.2 Exact next step

1. **Stakeholder review** of this schema design + **`FDA-ESOURCE-PART11-READINESS.md`** ALCOA+ guardrails + **`rbac-model.md`** (**who may publish**/retire).  
2. **Approve & author migrations** **`0014`–`0017`** (optional **`0017b_visit_source_bindings`**), **`0018_procedure_executions_source_version.sql`** (nullable FK only); wire **`scripts/apply-migrations.mjs`** → implement **`scripts/validate-phase4a.mjs`** (§**G**).  
3. **Publish lifecycle RPC (`SECURITY INVOKER`) + `SOURCE_*` `operational_events`** inserts in a dedicated implementation PR after RLS on new tables proves green in staging.
