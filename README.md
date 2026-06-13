# Vilo OS

[![GitHub](https://img.shields.io/badge/GitHub-Vilo--Research--OS-181717)](https://github.com/viloc2b-a11y/Vilo-Research-OS)

Internal **Clinical Research Operations** platform for Vilo Research Group. Event-driven operations for clinical research sites: visit-centric workflows, eSource, compliance, and financial intelligence (modules added incrementally).

Built with Next.js, Supabase, Tailwind, and shadcn/ui. Portfolio decisions and Verdent guardrails live in the local Verdent OS workspace (`Clinical Research Operations OS eClinPro`).

## Repositories

| Repo | Purpose |
|------|---------|
| **[viloc2b-a11y/Vilo-Research-OS](https://github.com/viloc2b-a11y/Vilo-Research-OS)** | This application (vilo-os) |
| Verdent OS (local / separate) | Guardrails, modules, project briefs |

## Supabase

**Project name:** `Vilo Research OS` (staging)

1. Create or open the project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Copy API keys to `.env.local` (see `.env.example`).
3. Run Phase 1b infrastructure:

```bash
npm install
npm run db:migrate      # requires DATABASE_URL
npm run db:provision    # synthetic orgs + staff (no PHI)
npm run db:validate
```

See `docs/PHASE1B-RUNBOOK.md` and `docs/GITHUB-SUPABASE-SYNC.md`.

## Current Runtime Status

- Staff-only login (`/login`) - **no public signup**
- Protected operations shell under `app/(ops)/`
- Supabase SSR auth + `organization_id` tenancy
- Document Center is now the platform-level coordinator entry point for document orchestration at `/document-center`
- Visit, source, consent, training/delegation, and protocol runtime work is evolving incrementally
- Pharmacy Runtime Phase 1 foundation is built with DB persistence, access gates, and transaction-hardened receipt/correction commits
- Pharmacy Dispensing Runtime Phase 2 foundation is built with blueprint-derived subject assignment, visit-linked dispensing, administration events inside Visit Runtime, and Study Subject Command Center review actions

### Document Center Navigation Phase 1

Document Center Phase 1 introduces a non-breaking coordinator-facing hub at `/document-center`.
It does not replace the validated backend pipeline and does not create studies.

Ownership model:

- Studies owns study creation: `Studies -> New Study`
- Document Center owns document orchestration: upload, classify, select existing study, select destination, and route
- Study Workspace owns study execution, source workflows, generated assets, subjects, visits, procedures, regulatory, and compliance work
- Source is study-level; Source Builder remains internal/admin tooling

Navigation changes:

- Global sidebar now exposes `Document Center -> /document-center`
- Global coordinator sidebar no longer exposes `Source -> /source-builder`
- Global coordinator sidebar no longer exposes `Source Evidence -> /source-blueprint-evidence`
- Existing Source routes remain alive for deep links and internal workflows:
  - `/source-builder`
  - `/source-builder/*`
  - `/source-blueprint-evidence`
  - `/source-blueprint-drafting`
  - `/source-blueprint-signoff`
  - `/runtime-source-packages`
  - `/runtime-source-publication`
- Admin now exposes `Builder Tools / Source Builder -> /source-builder` and `Protocol Engineering -> /admin/protocol-engineering`
- Technical Document Intelligence is now accessed via Admin -> Protocol Engineering
- Coordinator-facing Document Intelligence has been replaced with `Study Copilot -> /document-intelligence`

Coordinator-facing Document Center sections:

- Upload Documents
- Recent Documents
- Needs Review
- Ready For Reconciliation
- Ready For Source Generation
- Generated Assets
- Study-scoped routing destinations: Regulatory, Source, Subjects, Financial, Training, Documents, Compliance, Study Copilot

Validation most recently run locally:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm test
```

## Latest Milestone — Deliverable Runtime Human Readiness

- Deliverable Runtime Foundation implemented
- Printable Source Packet PDF generated, stored, hashed, audited
- Consent Evidence Package generated, stored, hashed, audited
- CRA Monitoring Workbook generated with Study/Subject/Visit/Procedure data, Consent Summary, Signature Summary, Document Lineage Summary, and Version Used During Execution
- Study Data Readiness Review available from Study Workspace
- CRA Workbook Precheck blocks unsafe exports
- Download audit now records `artifact_downloaded`
- Status: `READY_FOR_HUMAN_TEST`

Validation commands:

```bash
npx tsc --noEmit
npm run lint
npx tsx scripts/deliverable-runtime-foundation-smoke.ts
npx tsx scripts/printable-source-packet-smoke.ts
npx tsx scripts/consent-evidence-package-smoke.ts
npx tsx scripts/cra-monitoring-workbook-smoke.ts
npx tsx scripts/subject-deliverables-workspace-smoke.ts
```

### Pharmacy Runtime Phase 1

Pharmacy / IP Accountability Runtime Phase 1 is implemented as a Coordinator Simplicity First foundation:

- Study-aware Pharmacy Binder access gate using study/site membership, Delegation Log assignment, optional training requirement, and study-specific blinding scope
- Document Center -> Document Reader -> Pharmacy Runtime Blueprint -> CRC Review -> Activation -> Receipt Runtime dependency chain
- Immutable `ip_ledger_events` foundation; inventory is derived from ledger events, not mutable kit status
- Receipt workflow foundation with evidence/document linkage and signed operational commit boundary
- Correction/reversal model limited to Phase 1 receipt, inventory foundation, and accountability foundation events
- Masked and unblinded inventory projections with hard blinding gates
- Transaction-hardened RPCs:
  - `commit_ip_receipt_with_signature(_payload jsonb)`
  - `commit_ip_correction_with_signature(_payload jsonb)`

Validation most recently run locally:

```bash
npx supabase db reset --local
npx tsx scripts/pharmacy-runtime-phase1-smoke.ts
npx tsx scripts/pharmacy-runtime-phase1-actions-smoke.ts
```

Full repository TypeScript still has unrelated pre-existing diagnostics; targeted pharmacy-runtime checks did not surface pharmacy-runtime errors.

### Pharmacy Dispensing Runtime Phase 2

Pharmacy Dispensing Runtime v1 is implemented as an additive Phase 2 foundation on top of Phase 1. It does not modify Receipt Runtime, Inventory Foundation, Ledger Foundation, or transaction-hardening RPCs.

Built scope:

- Subject Assignment derived from the activated Pharmacy Runtime Blueprint
- Visit-linked Dispensing from Subject -> Visit -> Procedure context
- Administration Event execution inside Visit Runtime / Procedure Runtime
- Dispensation Review Confirmation with protocol-derived execution modes:
  - `real_time_required`
  - `asynchronous_required`
  - `optional`
  - `not_required`
- Study Subject Command Center integration using action-oriented work items:
  - `Review Dispensation`
  - `Review Due Today`
  - `Review Overdue`
  - `Waiver Requires Approval`
- Dispensing audit trail via `pharmacy_dispensing_audit_events`

Coordinator Simplicity First constraints:

- No independent Pharmacy dashboard
- No separate Pharmacy Review Queue
- No standalone Administration screen
- No global `user.is_unblinded`
- Blinding remains study-aware, site-aware, delegation-aware, training-aware, and authorization-scope-aware
- Inventory remains derived from immutable `ip_ledger_events`

Validation most recently run locally:

```bash
npx supabase db reset --local
npx tsx scripts/pharmacy-dispensing-runtime-smoke.ts
```

### Runtime Source Generation Pipeline

Source Generation Pipeline is **VALIDATED**.

Complete flow: `Protocol/Reconciliation → Runtime Generation → Source Package Creation → Review → Approval → Publication → Download JSON`.

Implemented scope:
- Runtime source package creation from compiled composition snapshots (`draft`)
- Visit shell and procedure shell generation with deterministic SHA-256 hashing
- Review transition: `draft → reviewed`
- Approval transition: `reviewed → approved` (with shell-reviewed validation gate)
- Publication: `approved → published` (with versioned publications and supersede support)
- Source package download/export as JSON
- All transitions preserve `package_json`, `package_hash`, and `composition_snapshot_id` unchanged

Status: `SOURCE_GENERATION_VALIDATED`

Validation:

```bash
npx tsc --noEmit
npm run lint
npx tsx scripts/runtime-source-package-phase4-smoke.ts
```

Pre-existing E2E validation reports (`.runtime-validation/`):
- `protocol-to-source-closure-VALIDATION_PROTOCOL_001`: `source_pass = true`, `remaining_blockers = []`
- `protocol-to-source-closure-VALIDATION_PROTOCOL_002`: `source_pass = true`, `remaining_blockers = []`

> **Note:** `protocol-to-source-closure-live.ts` requires staging Supabase env vars and was skipped in this environment. Pipeline was validated by unit smoke and pre-existing E2E reports.

## Architecture (planning docs)

| Document | Topic |
|---------|--------|
| [docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md](./docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md) | Studies, visits, procedures, operational events |
| [docs/ARCHITECTURE-VERSIONED-EXPORTS.md](./docs/ARCHITECTURE-VERSIONED-EXPORTS.md) | Version-scoped tabular exports — CSV/Excel (**Phase 4D**, **no engine yet**) |
| [docs/ARCHITECTURE-VISIT-PDF-PACKET.md](./docs/ARCHITECTURE-VISIT-PDF-PACKET.md) | Visit PDF packet (**Phase 4C**, **no PDF generator yet**) |
| [docs/FDA-ESOURCE-PART11-READINESS.md](./docs/FDA-ESOURCE-PART11-READINESS.md) | FDA / Part 11 (**§§A–M**), **ALCOA+ data integrity**, guardrails |
| [docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md](./docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md) | **Phase 4A** versioned Protocol Builder (**schema planning only**) |
| [directivas/pharmacy_ip_runtime_architecture_v1.md](./directivas/pharmacy_ip_runtime_architecture_v1.md) | Pharmacy / IP Accountability Runtime frozen architecture |
| [directivas/pharmacy_runtime_phase_1_build_plan.md](./directivas/pharmacy_runtime_phase_1_build_plan.md) | Pharmacy Runtime Phase 1 build plan |

Portfolio roadmap + decisions: **`Clinical Research Operations OS eClinPro/projects/vilo-os`** (`status.md`, `10_DECISIONS/`).

## Setup

```bash
git clone https://github.com/viloc2b-a11y/Vilo-Research-OS.git
cd Vilo-Research-OS
cp .env.example .env.local
# Fill Supabase keys from project "Vilo Research OS"
npm install
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run deploy` | Build preflight + `git push` (triggers Cloudflare Pages for os.viloresearchgroup.com) |
| `npm run deploy:build` | Build only (no push) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply auth + audit migrations |
| `npm run db:provision` | Seed synthetic staging users/orgs |
| `npm run db:validate` | RLS + cross-org validation |
| `npm run db:validate-phase2` | Phase 2 schema + JWT isolation |
| `npm run db:validate-phase3b` | Phase 3B procedure-completion RPC |
| `npm run db:validate-phase3c` | Phase 3C visit complete + lock RPCs |
| `npm run phase1b` | migrate + provision + validate |
| `npx tsx scripts/pharmacy-runtime-phase1-smoke.ts` | Pharmacy Phase 1 DB-free foundation smoke |
| `npx tsx scripts/pharmacy-runtime-phase1-actions-smoke.ts` | Pharmacy Phase 1 server action smoke |
| `npx tsx scripts/pharmacy-dispensing-runtime-smoke.ts` | Pharmacy Dispensing Runtime Phase 2 smoke |
| `npx tsx scripts/runtime-source-package-phase4-smoke.ts` | Source package generation, review, approval, and download smoke |
| `npx tsx scripts/runtime-source-publication-phaseP4A-smoke.ts` | Source package publication smoke |

## Out of scope (MVP scaffold)

- Visit workspace, studies, subjects, finance, reports, AI
- Payments, analytics, Mailchimp, SEO, i18n

## License

Private — Vilo Research Group.
