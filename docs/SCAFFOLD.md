# Vilo OS — Phase 1 scaffold notes

## What was created

- Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui
- `middleware.ts` — session refresh; `/login` and `/auth/callback` public only
- `lib/supabase/` — browser and server clients (Verdent `stacks/next-supabase` pattern)
- `lib/auth/session.ts` — user + organization membership helpers
- `lib/audit/log.ts` — service-role audit insert helper
- `app/(ops)/` — protected shell (dashboard placeholder)
- `app/login/` — staff sign-in
- `supabase/migrations/0001_auth_foundation.sql`, `0002_audit_foundation.sql`

## What was intentionally omitted

- `signup`, marketing, payments, analytics routes
- `messages/`, `next-intl`, locale switchers
- Clinical domain tables (studies, subjects, visits)
- Applied migrations (files are prepared only)

## Supabase Auth URLs

Add to Supabase Dashboard → Authentication → URL configuration:

- Site URL: `http://localhost:3000` (dev) or Cloudflare preview/production URL
- Redirect URLs: `http://localhost:3000/auth/callback`, preview/production equivalents

## Synthetic staging seed (after migrations)

```sql
insert into public.organizations (name) values ('Vilo Research Group (Staging)');
-- Link auth.users id and organization_id in organization_members
```

## Next step (Phase 1b)

1. Apply migrations on staging Supabase.
2. Run Verdent RLS tests (`workflows/supabase-rls-validation-workflow.md`).
3. Add migration `0003_studies.sql` per `projects/vilo-os/03_APP/recommended-structure.md` in Verdent OS repo.
4. Implement visit vertical slice only after RLS passes.

## Verdent cross-links

- Brief: `../Clinical Research Operations OS eClinPro/projects/vilo-os/00_BRIEF/brief.md`
- Decisions: `../Clinical Research Operations OS eClinPro/projects/vilo-os/10_DECISIONS/`
