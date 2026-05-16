# Phase 1b — Staging infrastructure runbook

## 1. Create Supabase staging project

1. [supabase.com](https://supabase.com) → New project (e.g. `vilo-os-staging`).
2. Save **Project URL**, **anon key**, **service_role key**, and **Database URI** (Settings → API / Database).
3. Authentication → URL configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

## 2. Configure `.env.local`

```bash
cp .env.example .env.local
```

Fill (staging only; synthetic users — no PHI):

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | API settings (server only) |
| `DATABASE_URL` or `DATABASE_URL_DIRECT` | Postgres URI for `npm run db:migrate` |

### Migration connection errors (`Tenant or user not found`)

This comes from Supabase **Supavisor/pooler auth**, not from SQL DDL.

1. **Prefer `DATABASE_URL_DIRECT`** for migrations:
   `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`
   (Dashboard → **Database** → Connection string → use **direct** / session host `db.*`, port **5432**.)

2. If you use the **transaction pooler** (port **6543**, `*.pooler.supabase.com`):
   - Username must be **`postgres.[PROJECT_REF]`** (project ref = subdomain before `.supabase.co`).
   - URL-encode special characters in the password.

3. The migrate script sets **`prepare: false`** on the `postgres` client — required for transaction pooler + `postgres.js`.

4. **`npm run db:migrate` does not require Auth users.** Foundation SQL only references `auth.users` as a FK target; provisioning is `npm run db:provision`.

5. Migrations are **idempotent** (`IF NOT EXISTS` tables, `DROP POLICY IF EXISTS` before policies).

## 3. Apply migrations + seed + validate

```bash
npm install
npm run db:migrate      # 0001_auth_foundation, 0002_audit_foundation
npm run db:provision    # 2 synthetic orgs + 2 staff users
npm run db:validate     # RLS + cross-org tests → docs/PHASE1B-VALIDATION-RESULTS.md
```

Or one shot: `npm run phase1b`

## 4. Manual middleware checks

```bash
npm run dev
```

| Step | Expected |
|------|----------|
| Open `/` logged out | Redirect to `/login` |
| Sign in as `synthetic.staff.a@vilo-os.staging` | Dashboard at `/` |
| Open `/login` while signed in | Redirect to `/` |
| Sign out | Back to `/login` |

Passwords: see `scripts/provision-synthetic.mjs` (staging-only).

## 5. Alternative: Supabase CLI

```bash
npx supabase link --project-ref YOUR_REF
npx supabase db push
npm run db:provision
npm run db:validate
```

## Synthetic accounts (created by provision script)

| Email | Organization | Role |
|-------|----------------|------|
| `synthetic.staff.a@vilo-os.staging` | Synthetic Site Alpha | admin |
| `synthetic.staff.b@vilo-os.staging` | Synthetic Site Beta | admin |

Do not use real PHI on staging until BAA is approved.
