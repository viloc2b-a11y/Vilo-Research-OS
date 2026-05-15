# GitHub + Supabase sync

## GitHub

| Item | Value |
|------|-------|
| Repository | [github.com/viloc2b-a11y/Vilo-Research-OS](https://github.com/viloc2b-a11y/Vilo-Research-OS) |
| Default branch | `main` |
| Local app folder | `vilo-os` (sibling to Verdent OS workspace) |

### Clone

```bash
git clone https://github.com/viloc2b-a11y/Vilo-Research-OS.git
cd Vilo-Research-OS
```

### Push updates from local `vilo-os`

```bash
cd path/to/vilo-os
git add .
git commit -m "Describe your change"
git push origin main
```

This folder uses its **own** `.git` repository (not the parent `ANTIGRAVITY FOLDER` git root).

---

## Supabase — project «Vilo Research OS»

| Item | Where to find it |
|------|------------------|
| Project name | **Vilo Research OS** |
| Project URL | Dashboard → Settings → API → Project URL |
| Anon key | Settings → API → `anon` `public` |
| Service role | Settings → API → `service_role` (server only) |
| Database URI | Settings → Database → Connection string (for `DATABASE_URL`) |

### `.env.local` (never commit)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.[ref]:[password]@...
```

### Auth redirect URLs

In Supabase → Authentication → URL configuration:

- **Site URL:** `http://localhost:3000` (dev) or your Cloudflare Pages URL
- **Redirect URLs:** `http://localhost:3000/auth/callback`, production/preview URLs

### Link Supabase CLI (optional)

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Project ref is in the dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

### Apply migrations without CLI

```bash
npm run db:migrate
```

Requires `DATABASE_URL` in `.env.local`.

---

## Verification

```bash
npm run phase1b
npm run dev
```

Sign in with synthetic staff from `scripts/provision-synthetic.mjs` (after provision).

Results: `docs/PHASE1B-VALIDATION-RESULTS.md`.
