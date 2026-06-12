# Atlas Architecture Card — Vilo Research OS

**Project:** Vilo Research OS  
**Repository inspected:** `C:\dev\vilo-os`  
**Generated:** 2026-06-06  
**Mode:** Architecture intelligence / operational memory  
**Scope inspected:** `README.md`, `docs/`, `app/`, `components/`, `lib/`, `supabase/`, `scripts/`, `cliniq-engine/`, `vilo-skills/`, `.runtime-validation/`, `package.json`

---

## 1. Executive Summary

Vilo Research OS is a private, site-first clinical research execution operating system for Vilo Research Group. It is not a classic CTMS, not a sponsor dashboard, not a pure document portal, and not an AI knowledge layer. Its core purpose is to convert protocol/document inputs into executable study, visit, source, governance, financial, and coordinator-action runtime workflows so a clinical research site can operate with less duplicate entry, fewer missed obligations, stronger evidence continuity, and better revenue protection.

The system is built as a Next.js / React / Supabase application with a large runtime spine: protected operations shell, Supabase SSR auth, organization tenancy, document intake/intelligence, protocol intake and reconciliation, runtime generation, source package publication, visit execution, operational signatures, governance signals, financial projections, performance/VPI risk queues, CRM/communications, consent, deliverables, pharmacy/IP accountability, and a separate early ClinIQ financial engine.

Current maturity is **advanced prototype / pre-pilot operational platform**, not production-ready clinical infrastructure. Several runtime chains have strong smoke evidence, especially protocol-to-source closure for `VALIDATION_PROTOCOL_001` and `VALIDATION_PROTOCOL_002`, coordinator execution UX readiness, deliverable generation, governance runtime, and financial/payment lifecycle foundations. The repo contains many migrations, runtime validation artifacts, and implementation reports showing real execution work.

Execution status is **high-velocity active development with significant uncommitted work**. `git status --short` shows **281 changed paths**: **168 modified** and **113 untracked**. Recent activity clusters around Document Center generalization, protocol reader closure, coordinator execution readiness, deliverables, organization/admin hardening, financial runtime, CRM/communications, governance, contact runtime, and study creation provenance.

The honest production view: the architecture direction is coherent and site-first, but operational readiness is constrained by uncommitted scope, partially validated live Supabase behavior, integrity audit warnings, duplicated/overlapping migration numbering, and several modules that are v0 shells or derived read-models rather than fully closed production workflows.

---

## 2. System Classification

| Classification | Value |
|---|---|
| **Platform Type** | Site-first Clinical Research Execution Operating System |
| **Primary User** | Site coordinator, site operations, PI/Sub-I support |
| **Architecture Pattern** | Runtime-driven, event/projection-backed platform with coordinator-facing operational surfaces |
| **Data Layer** | Supabase/Postgres with RLS, migrations, operational events, projections, derived read models, audit/signature tables |
| **Frontend Pattern** | Next.js App Router, protected `(ops)` shell, module-specific server loaders and client workspaces |
| **Execution Philosophy** | Document/protocol inputs become reviewed runtime objects; coordinator actions happen inside study/subject/visit/source workspaces |
| **Primary Domains** | Study Operations, Protocol Intelligence, Source Runtime, Visit Runtime, Governance, Financial Intelligence, CRM/Communications, Performance/VPI, Deliverables, Pharmacy/IP Accountability, Compliance/Signatures |
| **Anti-goals repeatedly documented** | No parallel CTMS, no duplicate source truth, no sponsor surveillance platform, no AI truth engine, no separate task system unless runtime-derived |

Primary domain grouping:

- **Study Operations:** studies, subjects, visits, procedures, study workspace, setup, delegation/training.
- **Protocol Intelligence:** document intelligence, protocol intake, reconciliation, runtime generation, source generation.
- **Source Runtime:** source packages, publication, source response sets, findings, corrections, addenda, signoff.
- **Governance:** operational signatures, protocol acceptance, delegation/training signatures, closeout, compliance obligations, candidate deviation signals.
- **Financial Intelligence:** expected/executed/earned/leakage/payment lifecycle/invoice/payment runtime; ClinIQ as a related financial engine.
- **Performance/VPI:** coordinator queue, study health, subject risk queue, financial/governance/workflow signal convergence.
- **CRM/Communications:** patient CRM, business development CRM, communications mailbox/thread/task links, contact runtime.
- **Deliverables:** printable source packet, consent evidence package, CRA monitoring workbook, study data readiness review, download audit.
- **Pharmacy/IP:** access gates, blinding-aware inventory, ledger events, receipts/corrections, dispensing runtime.

---

## 3. Runtime Inventory

| Runtime | Purpose | Status | Confidence | Evidence |
|---|---|---:|---:|---|
| **Operations Shell / Auth Runtime** | Staff-only protected operations shell with organization tenancy and admin surfaces. | Active / foundational | High | `README.md`; `app/(ops)/layout.tsx`; `app/login/page.tsx`; `lib/auth`; `lib/rbac`; org/admin routes. |
| **Document Center** | Coordinator entry point for document orchestration, upload, classification, routing, and study-scoped destinations. | Active / recently generalized | High | `README.md` Document Center Phase 1; `app/(ops)/document-center/page.tsx`; `components/document-center`; recent `scripts/document-center-*`. |
| **Document Intake Compliance Runtime** | Upload, document obligations, expiration alerts, classification destinations, storage bucket support. | Active / partial production path | High | Migrations `0106`-`0109`; `app/api/document-intake/*`; `lib/document-intake/*`; smoke scripts. |
| **Document Intelligence Runtime** | Ingest, classify, search, version, active reference, quarantine/release, domain mapping. | Active / strong but still technical/admin-heavy | High | Migrations `0122`-`0128`, `0162_document_intelligence_rls_fix.sql`; `components/document-intelligence`; `app/api/document-intelligence/*`; K1 smoke. |
| **Protocol Intake Runtime** | Create protocol runtime studies/versions, extract visit/procedure candidates, run extraction pipeline. | Active / validated in key fixtures | High | `app/(ops)/protocol-intake-runtime/page.tsx`; `lib/protocol-intake-runtime`; `.runtime-validation/protocol-to-source-closure-*.md`. |
| **Protocol Reconciliation Runtime** | Human-reviewed mapping of extracted visits/procedures into approved runtime truth. | Active / validated | High | `app/api/protocol-reconciliation/*`; `.runtime-validation/protocol-to-source-closure-*.md` shows approved sessions. |
| **Protocol Runtime Generation** | Generate runtime snapshots, visits, procedures, and study blueprints from approved reconciliation. | Active / validated but procedure compression needs interpretation | High | `app/api/protocol-runtime-generation/*`; closure reports show runtime generated for PARA and MV. |
| **Runtime Source Package / Publication** | Build, review, publish, sign, and gate source packages used by visit runtime. | Active / validated | High | `app/(ops)/runtime-source-packages`; `app/(ops)/runtime-source-publication`; migrations `0112`, `0120`, `0121`; closure artifacts. |
| **Source Runtime** | Source response sets, capture, findings, addenda, corrections, history, manifest, source signing. | Active / mature path | High | `app/api/source/*`; `lib/source*`; `components/source*`; validation scripts for capture/correction/addendum/findings. |
| **Visit Runtime** | Visit/procedure instance creation, execution, completion, locking, snapshotting, published-source gating. | Active / validated | High | `app/(ops)/visit-runtime`; `app/api/visit-runtime/*`; scripts `visit-runtime-*`; coordinator UX readiness artifacts. |
| **Study Runtime / Study Workspace** | Study setup, command center, documents, regulatory binder, subject roster, visit matrix, governance, finance, deliverables. | Active / broad, still converging | High | `app/(ops)/studies/[studyId]/workspace`; `components/study-workspace`; `lib/study-workspace`. |
| **Subject Runtime** | Subject workspace/chart, consent, source template, enrollment, labs, deliverables, clinical profile. | Active / partial expansion | Medium | `app/(ops)/subjects/[subjectId]/*`; `lib/subject`; `components/subject`; lab/deliverable untracked work. |
| **Operational Signature Runtime** | Universal signature requests, signatures, credentials, policies, artifact signing, operational signoff. | Active / strong foundation | High | Migrations `0133`, `0134`, `0162_signature_engine_unification.sql`; `lib/operational-signatures`; `components/operational-signatures`. |
| **Governance Runtime** | Protocol acceptance, delegation/training acknowledgements, closeout summary, governance signal routing. | Active / v1 plus derived closeout | High | Docs `VILO-OS-GOVERNANCE-RUNTIME-REPORT.md`, `VILO-OS-GOVERNANCE-CLOSEOUT-REPORT.md`; migration `0163_governance_protocol_acceptance.sql`. |
| **Governance Fabric / Deviation Signals** | Runtime-derived governance/deviation blockers and candidate context; not formal CAPA. | Partial / signal layer | High | `docs/GOVERNANCE-RUNTIME-LIFECYCLE-G1.md`; `lib/governance-fabric`; CAPA described as placeholder. |
| **Financial Runtime** | Expected/executed/earned/leakage/payment lifecycle, invoiceable components, invoice/payment runtime. | Active / rapidly expanding | High | `lib/financial-runtime`; migrations `0168`-`0171`; docs financial reports; `financial:smoke`. |
| **ClinIQ Engine** | Separate SoA/financial engine prototype for expected billables, visit-triggered billables, leakage, Supabase-backed events. | Prototype / related but not fully integrated | High | `cliniq-engine/*`; `run_supabase.mjs`; `finance/handlers.py`; `supabase_schema.sql`. |
| **Performance / VPI Runtime** | Study health, subject risk, coordinator today inbox, signal convergence from governance/financial/workflow. | Active / coordinator-facing read model | High | `app/(ops)/performance/*`; `lib/performance`; `docs/VPI-FINANCIAL-GOVERNANCE-CONVERGENCE-G1.md`. |
| **Coordinator Queue Runtime** | Action metadata over existing risk signals: title, priority, reason, owner, linked object. | Active / heuristic read model | High | `docs/VILO-OS-COORDINATOR-WHAT-NEXT-QUEUE-REPORT.md`; `SubjectRiskQueue.tsx`; `CoordinatorTodayInbox.tsx`. |
| **CRM Runtime** | Patient CRM and business development CRM separated with role-gated access. | v0 active / not fully production | High | `docs/VILO-OS-CRM-COMMUNICATIONS-IMPLEMENTATION-REPORT.md`; migration `0164`; `app/(ops)/crm/*`; `lib/crm`. |
| **Communications Runtime** | Mailboxes, threads, messages, task links for patient/BD operations. | v0 shell / partial | High | Migration `0164`, `0165`; `app/(ops)/communications/*`; `lib/communications`. |
| **Contact Runtime** | Contact people, organizations, roles, relationships, referral relationships. | Active / newly added | Medium | Migration `0166_contact_runtime.sql`; `app/(ops)/contacts/page.tsx`; `lib/contact-runtime`. |
| **Budget Negotiation Runtime** | Budget negotiation events, export, scenario/chargemaster endpoints, study workspace ledger panel. | Active / v1 | Medium | `docs/BUDGET-NEGOTIATION-RUNTIME-G1.md`; migration `0134_study_budget_negotiation_events.sql`; `app/(ops)/negotiation`. |
| **Consent Management Runtime** | Study consent template library, subject consent records/evidence, reconsent queue, patient sessions. | Active / partial v1 | High | Docs consent implementation; migrations `0148`, `0149`; `app/(ops)/document-center/consent-management`. |
| **Deliverable Runtime** | Generate and audit printable source packet, consent evidence package, CRA monitoring workbook, readiness review. | Active / ready for human test | High | README milestone; migrations `0172`-`0174`; scripts `*-deliverable*`, `cra-monitoring-workbook-smoke.ts`. |
| **Pharmacy / IP Accountability Runtime** | Study-aware pharmacy access, blueprints, inventory, immutable IP ledger, receipts/corrections, audit. | Active / foundation built | High | README pharmacy sections; migrations `0150`-`0161`; transaction RPCs. |
| **Observability Runtime** | Runtime traces, spans, telemetry, best-effort hooks. | Partial / schema + hooks | High | Docs `RUNTIME-OBSERVABILITY-*`; `lib/observability`; Phase docs say no UI/AI. |
| **Runtime Automation** | Automation proposals and supervised coordinator application. | Active / supervised only | High | Phase 11 report; `lib/runtime-automation`; `automation:smoke`; explicit no blind apply. |
| **Runtime Integrity / Protection / Sovereignty** | Guardrails around mutations, exposure, site-first visibility, service-role audit. | Active / guardrail layer | High | `docs/RUNTIME_SOVEREIGNTY_PRINCIPLES.md`; `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`; `.runtime-validation/service-role-audit.md`. |
| **Scientific Events Runtime** | Scientific events MVP surface/data model. | v0 / newly added | Medium | `app/(ops)/scientific-events`; migration `0167_scientific_events_mvp.sql`; SOP in `directivas`. |
| **Vilo Skills Runtime Context** | Local Codex skill/context registry for Vilo OS and ecosystem knowledge. | Active context tooling | Medium | `vilo-skills/registry.json`; `vilo-skills/vilo-os-context/SKILL.md`; `install-vilo-skills.ps1`. |

---

## 4. Module Inventory

| Module | Purpose | Location | Status |
|---|---|---|---|
| Document Center | Coordinator document orchestration hub. | `app/(ops)/document-center`, `components/document-center`, `lib/document-center` | Active; recently generalized. |
| Document Intake | Upload, classify, route, obligations, expiration alerts. | `app/(ops)/document-intake`, `app/api/document-intake`, `lib/document-intake` | Active; compliance runtime partial. |
| Document Intelligence | Ingestion, classification, search, version control, active references. | `app/(ops)/document-intelligence`, `app/(ops)/admin/protocol-engineering/document-intelligence`, `components/document-intelligence`, `lib/document-intelligence` | Active; admin/technical and coordinator Copilot split. |
| Protocol Intake Runtime | Protocol version intake and extraction. | `app/(ops)/protocol-intake-runtime`, `components/protocol-intake-runtime`, `lib/protocol-intake-runtime` | Active; validated in PARA/MV paths. |
| Protocol Reconciliation | Human review and approval of extracted visits/procedures. | `app/(ops)/protocol-reconciliation`, `components/protocol-reconciliation`, `lib/protocol-reconciliation` | Active; validated. |
| Protocol Runtime Generation | Generate runtime snapshots/objects from approved protocol truth. | `app/(ops)/protocol-runtime-generation`, `components/protocol-runtime-generation`, `lib/protocol-runtime-generation` | Active; validated but needs production hardening. |
| Procedure Library | Procedure blueprint authoring/versioning/publishing. | `app/(ops)/procedure-library`, `components/procedure-library`, `lib/procedure-library` | Active. |
| Study Runtime | Compose study runtime visits/procedures. | `app/(ops)/study-runtime`, `app/api/study-runtime`, `lib/study-runtime-composition` | Active. |
| Study Workspace | Coordinator execution shell for study-level work. | `app/(ops)/studies/[studyId]/workspace`, `components/study-workspace`, `lib/study-workspace` | Active; broad convergence surface. |
| Visit Runtime | Visit/procedure instance execution, completion, locking. | `app/(ops)/visit-runtime`, `app/api/visit-runtime`, `components/visit-runtime-execution`, `lib/visit-runtime*` | Active; validated. |
| Source Runtime | Source capture, response sets, findings, corrections, addenda, manifest/history. | `app/(ops)/source`, `app/api/source`, `components/source`, `lib/source` | Active; mature. |
| Source Builder | Internal/admin source authoring/composition tooling. | `app/(ops)/source-builder`, `components/source-builder`, `lib/source-builder` | Active; demoted from coordinator nav. |
| Source Blueprint Evidence | Extract evidence for source blueprint mapping. | `app/(ops)/source-blueprint-evidence`, `components/source-blueprint-evidence`, `lib/source-blueprint-evidence` | Active. |
| Source Blueprint Drafting | Draft source blueprint suggestions. | `app/(ops)/source-blueprint-drafting`, `components/source-blueprint-drafting`, `lib/source-blueprint-drafting` | Active. |
| Source Blueprint Signoff | Signoff and audit export for source blueprints. | `app/(ops)/source-blueprint-signoff`, `components/source-blueprint-signoff`, `lib/source-blueprint-signoff` | Active; reused in governance closeout. |
| Runtime Source Package | Source package review and status handling. | `app/(ops)/runtime-source-packages`, `components/runtime-source-package`, `lib/runtime-source-package` | Active. |
| Runtime Source Publication | Source publication, signature placeholders, publish packages. | `app/(ops)/runtime-source-publication`, `components/runtime-source-publication`, `lib/runtime-source-publication` | Active. |
| Operational Review | Query/review workspace for snapshots and operational findings. | `app/(ops)/operational-review`, `app/api/operational-review`, `components/operational-review`, `lib/operational-review` | Active. |
| Operational Signatures | Universal signing engine. | `app/(ops)/operational-signatures`, `app/api/operational-signatures`, `components/operational-signatures`, `lib/operational-signatures` | Active; strong core. |
| Governance Runtime | Protocol acceptance, training/delegation, closeout summary. | `components/study-workspace/study-governance-panel.tsx`, `lib/studies/governance-runtime-actions.ts`, `lib/study-workspace/load-governance-summary.ts` | Active v1; closeout derived. |
| Governance Fabric | Runtime-derived governance/deviation signals. | `lib/governance-fabric`, `lib/governance` | Active signal layer; CAPA partial. |
| Financial Runtime | Visit/subject/study financial projections, invoiceable/invoice/payment logic. | `lib/financial-runtime`, `lib/actions/record-invoice-payment.ts`, `lib/actions/send-invoice-draft.ts` | Active; rapidly expanding. |
| Budget Negotiation | Study budget events, export, scenario/chargemaster APIs. | `app/(ops)/negotiation`, `app/api/negotiation`, `components/study-workspace/budget-negotiation-ledger-panel.tsx` | Active v1. |
| ClinIQ Engine | External/prototype SoA billables and leakage engine. | `cliniq-engine` | Prototype; not fully absorbed into app runtime. |
| Performance Runtime / VPI | Study health and coordinator risk/readiness queues. | `app/(ops)/performance`, `lib/performance` | Active. |
| Coordinator Command Center | Coordinator command views and operational queues. | `app/(ops)/coordinator-command-center`, `components/coordinator-command-center`, `lib/coordinator-command-center` | Active. |
| CRM | Patient CRM and business development CRM. | `app/(ops)/crm`, `lib/crm` | v0 active. |
| Communications | Mailbox/thread/message/follow-up support. | `app/(ops)/communications`, `lib/communications` | v0 partial; provider abstraction not fully proven. |
| Contact Runtime | Unified contacts/organizations/relationships. | `app/(ops)/contacts`, `lib/contact-runtime` | Newly active. |
| Consent Management | Consent templates, records, evidence, reconsent, patient sessions. | `app/(ops)/document-center/consent-management`, `lib/subject/consent`, consent migrations | Active partial v1. |
| Subject Runtime | Subject chart/workspace, enrollment, consent, labs, deliverables. | `app/(ops)/subjects`, `components/subject`, `lib/subject` | Active; uneven maturity across submodules. |
| Longitudinal Labs | Subject lab timeline and audit runtime. | `components/subject/labs`, `lib/subject/lab-timeline`, docs lab reports | Active v1 / recently added. |
| Deliverables | Source packet, consent evidence, CRA workbook, readiness review. | `app/(ops)/deliverables`, `components/deliverables`, `lib/deliverables`, `scripts/*workbook*` | Active; human-test ready per README. |
| Pharmacy Runtime | IP access/inventory/ledger/receipt/correction/dispensing. | `lib/pharmacy-runtime`, pharmacy migrations | Foundation active. |
| Admin / Organization | Admin shell, users, organization profile. | `app/(ops)/admin`, `components/admin`, `lib/admin` | Active; org profile hardening recent. |
| RBAC / Authorization | Role permissions, blinding/access boundaries. | `lib/rbac`, `lib/authorization`, migration `0056` and related scripts | Active. |
| Runtime Validation | Offline/live validation harness and evidence files. | `.runtime-validation`, `lib/runtime-validation`, `scripts/*smoke*` | Active; strong evidence but incomplete production proof. |
| Vilo Skills | Codex skill registry/context for Vilo ecosystem. | `vilo-skills`, `install-vilo-skills.ps1` | Active support system. |

---

## 5. Current Development Focus

### Actively being developed

Evidence from `git status`, latest files, runtime-validation artifacts, and latest migrations indicates active work in these clusters:

1. **Document Center generalization and protocol-to-source closure**
   - Recent scripts: `scripts/document-center-e2e-live.ts`, `scripts/document-center-generalization-batch.ts`, `scripts/reader-closure-live.ts`.
   - Recent validation artifacts: `.runtime-validation/reader-closure-*.md`, `.runtime-validation/protocol-to-source-closure-*.md`.
   - Modified pages: `app/(ops)/document-center/page.tsx`, document intelligence/admin protocol engineering pages.

2. **Coordinator execution UX readiness**
   - Artifacts: `.runtime-validation/coordinator-execution-ux-readiness-VALIDATION_PROTOCOL_001.md`, `.runtime-validation/coordinator-execution-ux-readiness-VALIDATION_PROTOCOL_002.md`.
   - Both show source package reviewed, visit instance created/completed, workspace loaded before/after, and no remaining blockers.

3. **Financial runtime expansion**
   - Migrations `0168_cliniq_billing_runtime.sql`, `0169_financial_closure_runtime.sql`, `0170_financial_invoice_runtime.sql`, `0171_financial_payment_runtime.sql`.
   - New/modified code: `lib/financial-runtime/invoiceable.ts`, `invoicing.ts`, `payments.ts`, payment lifecycle compute, actions to send invoice draft and record payment.

4. **Governance and signature unification**
   - Migrations `0162_signature_engine_unification.sql`, `0163_governance_protocol_acceptance.sql`, `0143_consolidate_signatures.sql`.
   - Docs report universal operational signature reuse, not a parallel governance signature subsystem.

5. **CRM, Communications, Contact Runtime**
   - New routes under `app/(ops)/crm`, `app/(ops)/communications`, `app/(ops)/contacts`.
   - Migrations `0164_crm_and_communications.sql`, `0165_communications_email_task_links.sql`, `0166_contact_runtime.sql`.
   - Docs classify CRM as v0 with patient/BD separation.

6. **Deliverables and study data readiness**
   - README latest milestone says deliverables are `READY_FOR_HUMAN_TEST`.
   - Migrations `0172_deliverable_runtime.sql`, `0173_study_data_readiness_reviews.sql`, `0174_deliverable_download_audit.sql`.
   - Scripts for printable source packets, consent evidence packages, CRA workbook, study data readiness review.

7. **Admin / organization hardening and study creation provenance**
   - New admin organization route/components.
   - Migrations `0175_organization_profile_fields.sql`, `0176_organizations_rls_update_trigger.sql`, `0177_study_creation_provenance.sql`.
   - Recent commit `fix(studies): enforce human-only study creation` and migration provenance evidence.

### Recently completed or strongly validated

- Protocol-to-source closure for `VALIDATION_PROTOCOL_001`: 19 visits extracted/reconciled/runtime/source; 259 procedures extracted/reconciled; runtime/source generated with no remaining blockers.
- Protocol-to-source closure for `VALIDATION_PROTOCOL_002`: 6 visits extracted/reconciled/runtime/source; 131 procedures extracted/reconciled; runtime/source generated with no remaining blockers.
- Coordinator execution UX readiness for PARA and MV: visit created/completed, procedure completed, workspace renderable, no remaining blockers.
- Phase 11 offline runtime E2E: pass across operational events, protocol graph blockers, safety/governance blockers, replay, financial leakage, coordinator next action, supervised automation, UI model, and projection refresh chain.
- Governance runtime smoke, governance closeout smoke, operational signature K5 smoke, VPI validation, and TypeScript were reported as passing in docs.
- Deliverable runtime foundation reported ready for human testing.

### Appears blocked or risky

- **Live Supabase proof is degraded:** `docs/VILO-OS-NEXT-VALIDATION-ADVANCE-REPORT.md` states live refresh still hits `TypeError: fetch failed`; it is warning-tolerated, not fully green.
- **Integrity audit is not clean:** Phase 11 report says static audit had no unapproved direct-mutation blockers in `lib/`, but also reports `40 findings, 28 warnings` and recommends strict integrity audit before real pilot.
- **Repo state is not release-controlled:** 281 changed paths, including 113 untracked files, means the architecture is in active construction and cannot be treated as stable release evidence.
- **Migration ordering/naming risk:** overlapping numeric prefixes exist (`0134_*`, `0162_*`, `0163_*`) and many late migrations are untracked. This needs disciplined migration reconciliation before production.
- **CRM/communications are explicitly v0:** docs say provider abstraction and dedicated CRM module were just added; not production workflow maturity.
- **ClinIQ remains separate/prototype:** `cliniq-engine` has in-memory and Supabase prototype paths, but Vilo financial runtime is the app-native layer.

---

## 6. Atlas Knowledge Seeds

### Seed 01
Project: Vilo Research OS  
Type: Architecture  
Summary: Vilo OS is a site-first clinical research execution operating system, not a sponsor dashboard, CTMS clone, or AI knowledge layer.  
Evidence: `README.md`; `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`; `docs/VILO-OS-MASTER-EXECUTION-MAP.md`.  
Confidence: High

### Seed 02
Project: Vilo Research OS  
Type: Decision  
Summary: The architecture repeatedly forbids parallel CTMS/source-of-truth/task/governance layers; new capabilities should extend the existing runtime spine.  
Evidence: `docs/VILO-OS-MASTER-EXECUTION-MAP.md`; `docs/VILO-OS-FINAL-IMPLEMENTATION-REPORT.md`.  
Confidence: High

### Seed 03
Project: Vilo Research OS  
Type: Architecture  
Summary: The canonical runtime chain is Protocol -> Canonical Reader -> Parser Extraction -> Reconciliation -> Runtime Objects -> Source Generation -> Visit Runtime -> Operational Events -> Governance/Financial/VPI Intelligence.  
Evidence: `docs/VILO-OS-MASTER-EXECUTION-MAP.md`.  
Confidence: High

### Seed 04
Project: Vilo Research OS  
Type: Runtime  
Summary: Document Center is the coordinator-facing document orchestration entry point, while Source Builder is internal/admin tooling.  
Evidence: `README.md` Document Center Navigation Phase 1; `app/(ops)/document-center`; `app/(ops)/source-builder`.  
Confidence: High

### Seed 05
Project: Vilo Research OS  
Type: Runtime  
Summary: Document Intelligence has ingestion, classification, search, version control, active references, domains, and safeguards backed by migrations.  
Evidence: Migrations `0122`-`0128`, `0162_document_intelligence_rls_fix.sql`; `app/api/document-intelligence/*`.  
Confidence: High

### Seed 06
Project: Vilo Research OS  
Type: Runtime  
Summary: Protocol-to-source closure is validated for VALIDATION_PROTOCOL_001 with extraction, reconciliation, runtime generation, and source package generation passing.  
Evidence: `.runtime-validation/protocol-to-source-closure-VALIDATION_PROTOCOL_001.md`.  
Confidence: High

### Seed 07
Project: Vilo Research OS  
Type: Runtime  
Summary: Protocol-to-source closure is validated for VALIDATION_PROTOCOL_002 with extraction, reconciliation, runtime generation, and source package generation passing.  
Evidence: `.runtime-validation/protocol-to-source-closure-VALIDATION_PROTOCOL_002.md`.  
Confidence: High

### Seed 08
Project: Vilo Research OS  
Type: Gap  
Summary: Runtime generation currently reconciles many extracted procedures into a smaller runtime/source procedure shell count, so procedure normalization/compression must be understood before claiming full semantic fidelity.  
Evidence: PARA artifact shows 259 extracted/reconciled procedures but 7 runtime/source procedure shells; MV shows 131 extracted/reconciled but 4 runtime/source procedure shells.  
Confidence: Medium

### Seed 09
Project: Vilo Research OS  
Type: Runtime  
Summary: Coordinator execution readiness has concrete smoke evidence for PARA and MV: visits created, procedures completed, visit completed, workspace renderable, no remaining blockers.  
Evidence: `.runtime-validation/coordinator-execution-ux-readiness-VALIDATION_PROTOCOL_001.md`; `.runtime-validation/coordinator-execution-ux-readiness-VALIDATION_PROTOCOL_002.md`.  
Confidence: High

### Seed 10
Project: Vilo Research OS  
Type: Runtime  
Summary: Visit Runtime includes visit/procedure instances, completion, locking, snapshots, and published-source gating.  
Evidence: `app/api/visit-runtime/*`; migrations `0113`, `0114`, `0121`; scripts `visit-runtime-*`.  
Confidence: High

### Seed 11
Project: Vilo Research OS  
Type: Runtime  
Summary: Source Runtime supports response sets, capture, findings, corrections, addenda, history, manifest, and signing.  
Evidence: `app/api/source/*`; `lib/source`; source validation scripts in `package.json`.  
Confidence: High

### Seed 12
Project: Vilo Research OS  
Type: Architecture  
Summary: Operational events and projections are the runtime intelligence spine; projections are derived caches, not mutable source of truth.  
Evidence: `docs/RUNTIME-PROJECTIONS-PHASE2.md`; `lib/projections`; Phase 11 report.  
Confidence: High

### Seed 13
Project: Vilo Research OS  
Type: Runtime  
Summary: Governance Runtime v1 reuses the universal operational signature engine for protocol acceptance, delegation, and training acknowledgements.  
Evidence: `docs/VILO-OS-GOVERNANCE-RUNTIME-REPORT.md`; `lib/operational-signatures`; migration `0163_governance_protocol_acceptance.sql`.  
Confidence: High

### Seed 14
Project: Vilo Research OS  
Type: Gap  
Summary: Governance closeout is currently derived operational intelligence; final PI signoff, source certification, and regulatory readiness still live in existing workflow surfaces rather than a fully independent closeout runtime.  
Evidence: `docs/VILO-OS-GOVERNANCE-CLOSEOUT-REPORT.md`.  
Confidence: High

### Seed 15
Project: Vilo Research OS  
Type: Gap  
Summary: CAPA is placeholder-only; Governance Runtime creates candidate signals and context but does not implement full CAPA workflow.  
Evidence: `docs/GOVERNANCE-RUNTIME-LIFECYCLE-G1.md`; `public.governance_capa_placeholders` referenced.  
Confidence: High

### Seed 16
Project: Vilo Research OS  
Type: Runtime  
Summary: Financial Runtime is native clinical execution intelligence over expected, executed, earned, leakage, invoiceable, invoice, and payment lifecycle concepts.  
Evidence: `lib/financial-runtime`; docs `FINANCIAL-RUNTIME-LIFECYCLE-G1.md`; migrations `0168`-`0171`.  
Confidence: High

### Seed 17
Project: Vilo Research OS  
Type: Decision  
Summary: VPI consumes financial/governance/workflow signals but does not create invoices, confirm deviations, close deviations, or override ClinIQ.  
Evidence: `docs/VPI-FINANCIAL-GOVERNANCE-CONVERGENCE-G1.md`.  
Confidence: High

### Seed 18
Project: Vilo Research OS  
Type: Runtime  
Summary: Coordinator “What Next” queue is a projection over existing performance/VPI signals with action metadata, not a separate task system.  
Evidence: `docs/VILO-OS-COORDINATOR-WHAT-NEXT-QUEUE-REPORT.md`; `lib/performance/scoring/risk-queue.ts`.  
Confidence: High

### Seed 19
Project: Vilo Research OS  
Type: Runtime  
Summary: Deliverable Runtime can generate printable source packets, consent evidence packages, CRA monitoring workbooks, and study data readiness reviews with audit/download tracking.  
Evidence: README latest milestone; migrations `0172`-`0174`; scripts `printable-source-packet-smoke.ts`, `consent-evidence-package-smoke.ts`, `cra-monitoring-workbook-smoke.ts`.  
Confidence: High

### Seed 20
Project: Vilo Research OS  
Type: Decision  
Summary: Deliverable Runtime status is `READY_FOR_HUMAN_TEST`, which is not the same as production-ready.  
Evidence: README “Latest Milestone — Deliverable Runtime Human Readiness”.  
Confidence: High

### Seed 21
Project: Vilo Research OS  
Type: Runtime  
Summary: Pharmacy/IP Accountability Runtime Phase 1 is a foundation with access gates, immutable ledger events, receipts/corrections, and transaction-hardened RPCs.  
Evidence: README pharmacy section; migrations `0150`-`0160`.  
Confidence: High

### Seed 22
Project: Vilo Research OS  
Type: Runtime  
Summary: Pharmacy Dispensing Runtime Phase 2 adds subject assignment, visit-linked dispensing, administration events, and review confirmations without creating a standalone pharmacy dashboard.  
Evidence: README Pharmacy Dispensing Runtime Phase 2; migration `0161_pharmacy_dispensing_runtime.sql`.  
Confidence: High

### Seed 23
Project: Vilo Research OS  
Type: Runtime  
Summary: CRM has been added as separate Patient CRM and Business Development CRM areas with role-gated data separation.  
Evidence: `docs/VILO-OS-CRM-COMMUNICATIONS-IMPLEMENTATION-REPORT.md`; migration `0164_crm_and_communications.sql`; `app/(ops)/crm/*`.  
Confidence: High

### Seed 24
Project: Vilo Research OS  
Type: Gap  
Summary: CRM and Communications are v0: short forms, server-side search/filter, initial mailbox/thread workflow, and no proven production email provider lifecycle.  
Evidence: `docs/VILO-OS-CRM-COMMUNICATIONS-IMPLEMENTATION-REPORT.md`; `app/(ops)/communications/*`; migration `0165`.  
Confidence: High

### Seed 25
Project: Vilo Research OS  
Type: Runtime  
Summary: Contact Runtime adds people, organizations, relationships, roles, and referral relationships to support CRM/communications.  
Evidence: migration `0166_contact_runtime.sql`; `app/(ops)/contacts/page.tsx`; `lib/contact-runtime`.  
Confidence: Medium

### Seed 26
Project: Vilo Research OS  
Type: Runtime  
Summary: Consent Management is aligned to Document Center, study-level consent template libraries, subject-level consent records/evidence, and reconsent queues.  
Evidence: `docs/VILO-OS-CONSENT-MANAGEMENT-IMPLEMENTATION-REPORT.md`; migrations `0148`, `0149`; `app/(ops)/document-center/consent-management`.  
Confidence: High

### Seed 27
Project: Vilo Research OS  
Type: Architecture  
Summary: Site-first runtime sovereignty is an explicit architecture constraint: no raw runtime exposure to sponsors/CROs/monitors by default.  
Evidence: `docs/RUNTIME_SOVEREIGNTY_PRINCIPLES.md`; `docs/SITE_FIRST_RUNTIME_PRINCIPLES.md`.  
Confidence: High

### Seed 28
Project: Vilo Research OS  
Type: Risk  
Summary: Live pilot validation is degraded because the live Supabase refresh path can return `TypeError: fetch failed`; this is warning-tolerated, not fully green.  
Evidence: `docs/VILO-OS-NEXT-VALIDATION-ADVANCE-REPORT.md`.  
Confidence: High

### Seed 29
Project: Vilo Research OS  
Type: Risk  
Summary: Production readiness is constrained by a large uncommitted worktree: 281 changed paths, including 168 modified and 113 untracked.  
Evidence: `git -c safe.directory=C:/dev/vilo-os status --short`.  
Confidence: High

### Seed 30
Project: Vilo Research OS  
Type: Risk  
Summary: Migration discipline needs review before production due to many late untracked migrations and overlapping numeric prefixes.  
Evidence: `supabase/migrations` includes untracked `0164`-`0176` and duplicate numeric prefixes such as `0134`, `0162`, `0163`.  
Confidence: High

### Seed 31
Project: Vilo Research OS  
Type: Runtime  
Summary: Observability exists as append-oriented traces/spans/telemetry with best-effort hooks and no behavior-changing semantics.  
Evidence: `docs/RUNTIME-OBSERVABILITY-SCHEMA-PHASE16A2.md`; `docs/RUNTIME-OBSERVABILITY-HOOKS-PHASE16A3.md`; `lib/observability`.  
Confidence: High

### Seed 32
Project: Vilo Research OS  
Type: Decision  
Summary: Runtime automation is supervised; coordinator explicit application is required and blind auto-apply is not expected.  
Evidence: `.runtime-validation/phase11-report.md`; `docs/RUNTIME-AUTOMATION-PHASE9.md`.  
Confidence: High

### Seed 33
Project: Vilo Research OS  
Type: Risk  
Summary: Integrity audit is not production-clean; Phase 11 recommends strict integrity audit and clearing blocker paths before real pilot.  
Evidence: `.runtime-validation/phase11-report.md`.  
Confidence: High

### Seed 34
Project: Vilo Research OS  
Type: Runtime  
Summary: Service-role audit found no coordinator-facing high-risk service-role paths, but service-role use exists in admin/support scripts and storage/document paths.  
Evidence: `.runtime-validation/service-role-audit.md`.  
Confidence: High

### Seed 35
Project: Vilo Research OS  
Type: Architecture  
Summary: Study Workspace is becoming the convergence surface for governance, finance, documents, source, subjects, visit matrix, regulatory, closeout, and deliverables.  
Evidence: `components/study-workspace`; `app/(ops)/studies/[studyId]/workspace/page.tsx`; governance/financial/deliverable docs.  
Confidence: High

### Seed 36
Project: Vilo Research OS  
Type: Runtime  
Summary: Admin surfaces now include organization management and protocol engineering/document intelligence separation.  
Evidence: `app/(ops)/admin/*`; `components/admin`; migrations `0175`, `0176`; README navigation notes.  
Confidence: Medium

### Seed 37
Project: Vilo Research OS  
Type: Runtime  
Summary: Study creation provenance was recently added to enforce or record human-only study creation.  
Evidence: Recent commit `fix(studies): enforce human-only study creation`; migration `0177_study_creation_provenance.sql`.  
Confidence: Medium

### Seed 38
Project: Vilo Research OS  
Type: Runtime  
Summary: ClinIQ engine is a separate SoA/expected billables/leakage prototype with in-memory and Supabase-backed paths, not the primary app-native financial runtime.  
Evidence: `cliniq-engine/example_run.py`; `cliniq-engine/run_supabase.mjs`; `cliniq-engine/finance/*`; `lib/financial-runtime`.  
Confidence: High

### Seed 39
Project: Vilo Research OS  
Type: Gap  
Summary: README still contains older MVP out-of-scope text listing visits/studies/subjects/finance/reports/AI as out of scope, which conflicts with current implemented modules and should be treated as stale documentation.  
Evidence: `README.md` “Out of scope (MVP scaffold)” vs current app routes/migrations/docs.  
Confidence: High

### Seed 40
Project: Vilo Research OS  
Type: Runtime  
Summary: Vilo Skills includes local context skills for Vilo OS, indicating Atlas/Codex operational memory support is part of the ecosystem.  
Evidence: `vilo-skills/registry.json`; `vilo-skills/vilo-os-context/SKILL.md`; `install-vilo-skills.ps1`.  
Confidence: Medium

---

## 7. Known Gaps

### Missing or incomplete implementations

- **Full CAPA Runtime:** Governance docs explicitly describe CAPA as placeholder-only.
- **Formal deviation adjudication:** Governance signals provide candidate context; human-confirmed deviations remain separate and are not auto-created.
- **Production email lifecycle:** Communications has mailbox/thread/message tables and UI, but no proven provider integration lifecycle was found in the inspected evidence.
- **CRM maturity:** CRM is v0, usable but not production-grade CRM operations.
- **ClinIQ integration boundary:** ClinIQ is separate/prototype and should not be confused with the app-native Financial Runtime.
- **External production deployment proof:** README references Cloudflare Pages deployment flow, but this inspection did not find current production deployment evidence.
- **Live Supabase reliability:** Live validation still suffers fetch failures in the current environment.

### Validation gaps

- **Strict integrity audit not cleanly closed:** Phase 11 recommends `npm run integrity:audit:strict` and clearing blockers before real pilot.
- **Live pilot is degraded:** Warning-tolerated fetch failure means not production-grade live validation.
- **Large runtime chains validated mostly through smoke scripts:** Strong evidence for execution paths, but smoke tests are not the same as regulated production qualification.
- **Untracked migration/doc/script changes:** Validation evidence is difficult to treat as final while worktree is dirty.

### Documentation gaps

- **README stale section:** “Out of scope (MVP scaffold)” conflicts with actual implemented modules.
- **No single stable production readiness ledger:** Many implementation reports exist, but status is scattered across docs, README, runtime-validation artifacts, and scripts.
- **Procedure fidelity explanation needed:** Runtime/source procedure counts are much lower than extracted/reconciled procedure counts in closure artifacts; likely normalization, but needs explicit documentation.
- **Module maturity vocabulary is inconsistent:** Terms like Healthy, Active, READY_FOR_HUMAN_TEST, v0, foundation, partial appear across docs without a single canonical maturity scale.

### Production readiness risks

- 281-path dirty worktree blocks clean release confidence.
- Migration ordering and duplicate numeric prefixes need review before database promotion.
- Supabase live connectivity and RLS policy behavior need full live green validation.
- Extensive service-role usage exists in scripts/admin/support paths; audit says no coordinator-facing high risk, but this must remain monitored.
- Many runtime modules are read-model/projection layers; they should not be sold or treated as closed workflow automation until write/closeout paths are verified.
- The system is broad enough that regression risk is high without a consolidated release gate matrix.

---

## 8. Dependency Map

Validated and expanded structure:

```text
Vilo Research OS
├── Platform Foundation
│   ├── Next.js App Router / protected ops shell
│   ├── Supabase SSR Auth
│   ├── Organization tenancy and RBAC
│   ├── Operational events
│   ├── Runtime projections
│   ├── Runtime integrity / protection / sovereignty
│   └── Runtime validation harness
├── Document + Protocol Intelligence
│   ├── Document Center
│   ├── Document Intake Compliance Runtime
│   ├── Document Intelligence Runtime
│   ├── Protocol Intake Runtime
│   ├── Protocol Reconciliation Runtime
│   ├── Protocol Runtime Generation
│   └── Procedure Library
├── Source Runtime
│   ├── Source Builder
│   ├── Source Blueprint Evidence
│   ├── Source Blueprint Drafting
│   ├── Source Blueprint Signoff
│   ├── Runtime Source Package
│   ├── Runtime Source Publication
│   └── Source Capture / Findings / Corrections / Addenda
├── Execution Runtime
│   ├── Study Runtime
│   ├── Study Workspace
│   ├── Subject Runtime
│   ├── Visit Runtime
│   ├── Visit Execution Workspace
│   ├── Consent Management Runtime
│   ├── Longitudinal Labs Runtime
│   └── Deliverable Runtime
├── Governance + Compliance Runtime
│   ├── Universal Operational Signature Engine
│   ├── Protocol PI Acceptance
│   ├── Delegation Log Runtime
│   ├── Training Log Runtime
│   ├── Governance Fabric / Deviation Signals
│   ├── Operational Review / Query Runtime
│   ├── Closeout Coverage Read Model
│   └── Site-first runtime protection / external visibility policy
├── Financial Intelligence
│   ├── Financial Runtime
│   │   ├── Expected / Executed / Earned
│   │   ├── Leakage
│   │   ├── Payment Lifecycle
│   │   ├── Invoiceable / Invoicing
│   │   └── Payments
│   ├── Budget Negotiation Runtime
│   ├── Revenue Protection / VPI signals
│   └── ClinIQ Engine
│       ├── ClinIQ Financial
│       └── ClinIQ Feasibility / SoA parser prototype
├── Coordinator Intelligence
│   ├── Performance Runtime / VPI
│   ├── Coordinator Today Inbox
│   ├── Subject Risk Queue
│   ├── Coordinator Command Center
│   ├── Runtime UI
│   ├── Runtime Replay
│   └── Runtime Automation (supervised)
├── CRM + Growth Operations
│   ├── Patient CRM
│   ├── Business Development CRM
│   ├── Contact Runtime
│   ├── Communications Runtime
│   └── Scientific Events MVP
├── Pharmacy / IP Accountability
│   ├── Pharmacy access foundation
│   ├── Pharmacy runtime blueprints
│   ├── IP inventory master data
│   ├── Immutable IP ledger events
│   ├── Receipt/correction runtime
│   └── Dispensing / administration / review runtime
└── Atlas / Vilo Operational Memory Support
    ├── vilo-skills registry
    ├── vilo-os-context skill
    └── architecture/status docs
```

Correction to the proposed map:

- **ClinIQ Financial** should be treated as related/prototype financial engine, not the primary Vilo financial runtime.
- **ClinIQ Feasibility** is not strongly evidenced as a production module in this repo; evidence is stronger for SoA parsing, billable triggering, and leakage.
- **CRM** belongs to growth/recruitment/business-development operations, not the core protocol/source execution chain.
- **Document Center** is the coordinator entry point, but **Document Intelligence** and **Protocol Intake** are separate runtime subsystems beneath it.
- **Performance Runtime / VPI** is a signal-consuming coordinator intelligence layer, not a source of operational truth.
- **Governance Runtime** must be split between universal signatures, governance signals, protocol acceptance, delegation/training, closeout read models, and placeholder CAPA.

---

## 9. Production Readiness Assessment

| Area | Score | Reasoning |
|---|---:|---|
| **Architecture** | 82 | Coherent site-first runtime architecture, clear anti-goals, strong spine from protocol/document to execution intelligence. Not 90+ because module maturity/status is scattered and migration/state discipline is not yet release-grade. |
| **Runtime** | 68 | Many runtime chains are built and smoke-validated, including protocol-to-source and visit execution. Not production-ready due to dirty worktree, broad active construction, partial modules, and live validation degradation. |
| **Data Layer** | 64 | Supabase/Postgres schema is extensive with RLS, projections, audit/signature tables, and many migrations. Risk comes from untracked migrations, duplicate numeric prefixes, and need for full live migration/RLS proof. |
| **Governance** | 72 | Universal signature engine and governance v1 are strong; closeout and protocol acceptance are aligned. Formal CAPA and deviation adjudication remain partial/placeholder. |
| **Financial Layer** | 66 | Financial Runtime is app-native and expanding into invoices/payments with ClinIQ patterns available. Still in rapid build; ClinIQ separation and production billing/AR boundaries need hardening. |
| **Compliance Layer** | 61 | Good direction: Part 11/ALCOA principles, signatures, audit events, runtime protection, consent, service-role audit. Not production-grade until strict integrity audit, live validation, migration promotion, and compliance qualification are complete. |
| **Operational Layer** | 70 | Coordinator surfaces, Study Workspace, Performance/VPI, Document Center, and deliverables are strong. Readiness is limited by UI/workflow breadth, v0 CRM/communications, and unresolved live validation risks. |

Overall production-readiness estimate: **68 / 100**.

Interpretation: **Pre-pilot / human-test capable in selected flows; not yet production clinical operations infrastructure.**

---

## 10. Atlas Conclusion

### 1. What is Vilo Research OS today?

Vilo Research OS is an advanced, site-first clinical research execution platform that turns documents and protocols into reviewed runtime objects, source packages, visit execution workflows, governance/signature evidence, financial projections, coordinator queues, and deliverables. It is already much more than a scaffold: several core runtime paths are implemented and validated with concrete evidence.

But it is not yet production-ready. It is a rapidly evolving pre-pilot operating system with strong architecture, strong selected-flow validation, and serious release-readiness work still required.

### 2. Next 3 highest-value execution priorities

1. **Stabilize release truth**  
   Clean the worktree, reconcile untracked/modified implementation scope, normalize migration ordering, and produce one release readiness ledger. Without this, nobody can honestly say what is deployed, validated, or pending.

2. **Close live validation and integrity gates**  
   Resolve live Supabase `fetch failed` degradation, run strict integrity audit, and prove core protocol-to-source-to-visit-to-governance-to-financial flows against staging with migrations applied.

3. **Canonicalize module maturity and ownership**  
   Establish a single status vocabulary for each module: prototype, v0, active, validated, human-test ready, production-ready. Update README/docs so stale MVP/out-of-scope language does not mislead future operators or Atlas memory.

### 3. What should Atlas remember permanently?

Atlas should permanently remember these truths:

- Vilo OS is **site-first Coordinator Survival OS** for clinical research execution.
- Its architecture must extend the **existing runtime spine**, not create parallel CTMS/source/governance/task systems.
- Document Center is the coordinator entry point; Protocol Intake/Reconciliation/Runtime Generation are the canonical protocol-to-runtime path.
- Source Runtime and Visit Runtime are central execution systems, not optional modules.
- Governance and Financial intelligence are derived from runtime evidence; they are not separate systems of truth.
- VPI/Performance is a coordinator attention layer that consumes runtime signals and routes action.
- ClinIQ is related financial/protocol economics intelligence, currently prototype/adjacent relative to app-native Financial Runtime.
- The system has strong evidence for selected flows but remains pre-pilot until live validation, strict integrity, migration discipline, and worktree stabilization are complete.
