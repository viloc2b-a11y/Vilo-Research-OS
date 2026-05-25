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

## Phase 1 (current)

- Staff-only login (`/login`) — **no public signup**
- Protected operations shell under `app/(ops)/`
- Supabase SSR auth + `organization_id` tenancy
- Migrations: `0001_auth_foundation`, `0002_audit_foundation` (prepared under `supabase/migrations/`)

## Architecture (planning docs)

| Document | Topic |
|---------|--------|
| [docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md](./docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md) | Studies, visits, procedures, operational events |
| [docs/ARCHITECTURE-VERSIONED-EXPORTS.md](./docs/ARCHITECTURE-VERSIONED-EXPORTS.md) | Version-scoped tabular exports — CSV/Excel (**Phase 4D**, **no engine yet**) |
| [docs/ARCHITECTURE-VISIT-PDF-PACKET.md](./docs/ARCHITECTURE-VISIT-PDF-PACKET.md) | Visit PDF packet (**Phase 4C**, **no PDF generator yet**) |
| [docs/FDA-ESOURCE-PART11-READINESS.md](./docs/FDA-ESOURCE-PART11-READINESS.md) | FDA / Part 11 (**§§A–M**), **ALCOA+ data integrity**, guardrails |
| [docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md](./docs/PHASE4A-VERSIONED-PROTOCOL-BUILDER-SCHEMA.md) | **Phase 4A** versioned Protocol Builder (**schema planning only**) |

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

## Out of scope (MVP scaffold)

- Visit workspace, studies, subjects, finance, reports, AI
- Payments, analytics, Mailchimp, SEO, i18n

## License

Private — Vilo Research Group.
