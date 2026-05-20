# Deployment Readiness

Target: `os.viloresearchgroup.com`  
Audience: internal production users  
Date: 2026-05-19

## Verdict

Ready for internal deployment after the validation suite below passes against the target production environment.

This readiness pass does not add features, does not change schema, and does not touch capture, sign, or submit flows.

## Required Environment Variables

Runtime required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY` when server-side AI features are enabled

Server-only required when using privileged maintenance paths or provisioning scripts:

- `SUPABASE_SERVICE_ROLE_KEY`

Database/admin validation and migration utilities:

- `DATABASE_URL_DIRECT` or `DATABASE_URL`

Optional runtime flags:

- `VPI_SCORING_ENABLED`
- `VPI_USE_RPC`
- `SOURCE_ENGINE_DEBUG_EVENTS`
- `SOURCE_ENGINE_LOG_SNAPSHOT_GENERATED`

OpenRouter access must remain server-side only; do not expose the key through browser/client environment variables.

Dev or E2E-only:

- `E2E_API_BASE_URL`
- `MIGRATION_ALLOWED`
- `MIGRATION_SECRET`
- `VPI_SEED_ALLOW_ANY_ORG`

Production note: `/api/dev/*` is excluded from login redirects by middleware because those handlers are tooling-oriented. Do not enable migration execution in production unless `MIGRATION_ALLOWED` and `MIGRATION_SECRET` are intentionally configured and access is controlled.

## Validation Commands

Run all commands from the repository root:

```bash
npm run validate:source-engine:phase1
npm run validate:source-engine
npm run validate:source-engine:operational
node scripts/validate-operational-ux-shell.mjs
node scripts/validate-multi-tenant-isolation.mjs
npx tsc --noEmit
npm run lint
npm run build
```

Expected result: every command exits with code `0`.

Latest local pass:

- `npm run validate:source-engine:phase1` passed
- `npm run validate:source-engine` passed
- `npm run validate:source-engine:operational` passed
- `node scripts/validate-operational-ux-shell.mjs` passed
- `node scripts/validate-multi-tenant-isolation.mjs` passed
- `npx tsc --noEmit` passed
- `npm run lint` passed
- `npm run build` passed

## Protected Routes / Auth Redirects

Confirmed auth boundary:

- Public routes: `/login`, `/auth/callback`
- Source API routes: `/api/source/*` enforce auth inside handlers and return JSON envelopes instead of browser redirects.
- Dev tooling routes: `/api/dev/*` are not redirected by middleware; production safety depends on handler-level secrets and env config.
- All other app routes redirect unauthenticated users to `/login?redirectedFrom=<path>`.
- Authenticated users visiting `/login` redirect to `/`.
- `(ops)` layout also checks session server-side and redirects unauthenticated users to `/login`.

Multi-tenant boundary:

- Operational read models derive accessible organizations from `organization_members`.
- Command Center scopes by the user's organization memberships.
- Study, subject, and visit workspaces now perform explicit organization membership checks.
- Validation findings are scoped through organization-scoped `source_response_sets`.

## Production Smoke Checklist

After deploy to `os.viloresearchgroup.com`:

- Visit `/login` signed out; confirm login page renders.
- Visit `/command-center` signed out; confirm redirect to `/login`.
- Sign in as an internal user with one organization membership.
- Confirm `/command-center` loads without fake rows and without VPI hard failure if VPI data is partial.
- Open a study workspace from the command center or `/studies`.
- Open a subject workspace and confirm timeline/source/task sections render with empty states when no data exists.
- Open a visit workspace and confirm procedure/source/task navigation works.
- Open `/source/capture/<procedureExecutionId>` for a valid execution and confirm capture shell still loads.
- Submit/sign paths should remain unchanged from the existing capture runtime.
- Attempt a cross-tenant or invalid ID URL if test IDs are available; expected result is `notFound` or denied access, not leaked record detail.
- Check server logs for unexpected runtime exceptions during the above flow.

## Data / Branding Cleanliness

Confirmed for operational runtime surfaces:

- No fake rows are inserted by the Operational UX shell.
- Empty states are rendered instead of fabricated visits, subjects, tasks, blockers, or events.
- No charts or placeholder metrics are introduced by the readiness pass.
- Runtime app scan did not find exposed sponsor/protocol-specific names in operational pages, Source Engine runtime, or capture routes.

Known repository note:

- Source Builder fixtures use generic identifiers and generalized source-document references. They are not used by the operational shell or capture/sign/submit runtime.

Console noise review:

- Runtime `console.warn` / `console.error` statements are limited to failure telemetry and recoverable loader warnings.
- Validation scripts intentionally write to console.
- No dev-only production banner was found in the operational app shell.

## Documented Validators

Operational and isolation validators:

- `node scripts/validate-operational-ux-shell.mjs`
- `node scripts/validate-multi-tenant-isolation.mjs`

Source Engine validators:

- `npm run validate:source-engine:phase1`
- `npm run validate:source-engine`
- `npm run validate:source-engine:operational`

Supporting audit docs:

- `docs/OPERATIONAL-UX-SHELL-PHASE1B-QA.md`
- `docs/MULTI-TENANT-ISOLATION-AUDIT.md`

## Known Limitations

- VPI high-risk may be partial or unavailable; command center must degrade gracefully.
- Clinical profile links may exist even when no clinical profile records exist yet.
- `source_response_validation_findings` tenant scope is derived through `source_response_sets`; a direct `organization_id` on findings would simplify future audits.
- E2E tenant isolation testing is still recommended with two organizations, two users, and cross-tenant IDs.
- Internal production readiness does not equal full external enterprise validation; regulated release still needs environment-specific SOP, backup, monitoring, and access-review evidence.
