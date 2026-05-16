# Migration idempotency fixes (Vilo OS)

**Goal:** Make `npm run db:migrate` safe to rerun against an existing staging database where policies may already exist.

**Scope:** RLS policies on `studies` / `study_versions` across **`0003_studies.sql`**, **`0004_study_versions.sql`**, and **`0005_study_members.sql`**. Other migrations were already using **`DROP POLICY IF EXISTS`** before **`CREATE POLICY`**, or were confirmed as non-policy DDL.

---

## A. Files changed

| File | Change |
|------|--------|
| `supabase/migrations/0003_studies.sql` | Single **`DROP POLICY IF EXISTS`** block for **all** known `studies` policy names (org-scope from 0003 + study-scope from 0005) before recreating the four org-only policies; removed redundant per-policy drops. |
| `supabase/migrations/0004_study_versions.sql` | Same pattern for **`study_versions`** (drops `_study_scope` names from 0005 plus `_org` names) before recreating the two org-only policies. |
| `supabase/migrations/0005_study_members.sql` | Expanded **`studies`** drops to include **`studies_select_study_scope`** / **`studies_update_study_scope`**; expanded **`study_versions`** drops to include **`study_versions_select_study_scope`** / **`study_versions_insert_study_scope`** before **`CREATE POLICY`**. |

---

## B. Policies / triggers / functions made rerunnable

### Policies

- **`public.studies`:** All six logical names are dropped before 0003’s four policies are created; 0005 drops all six again before creating **`studies_select_study_scope`**, **`studies_insert_org_admin`**, **`studies_update_study_scope`**, **`studies_delete_org_admin`**. Policy **definitions** (USING / WITH CHECK) are unchanged.
- **`public.study_versions`:** All four logical names are dropped before 0004’s two policies; 0005 drops all four again before creating **`study_versions_select_study_scope`** and **`study_versions_insert_study_scope`**.

### Why this was required

On a DB that already ran **`0005`**, rerunning **`0003`** recreated **`studies_select_org`** without removing **`studies_select_study_scope`**, yielding **two permissive SELECT policies** (broader effective access). **`0005`** then failed with **“policy … already exists”** when creating **`studies_select_study_scope`** again.

### Triggers / functions

- No trigger or function bodies were modified.
- Existing migrations already use **`DROP TRIGGER IF EXISTS`** before **`CREATE TRIGGER`** in the Phase 2 clinical tables audited (`0006`–`0011`, etc.).
- **`CREATE OR REPLACE FUNCTION`** remains the pattern for function definitions.

---

## C. Migrations still potentially non-idempotent

These are **unchanged** and may still fail or behave oddly if rerun in isolation after manual edits:

| Area | Notes |
|------|--------|
| **`CREATE TRIGGER`** without **`DROP TRIGGER`** | **`0003_studies.sql`** uses **`DROP TRIGGER IF EXISTS`** before **`CREATE TRIGGER`** for **`studies_set_updated_at`** — rerunnable. Any future migration adding triggers should follow **`DROP TRIGGER IF EXISTS`**. |
| **`CREATE POLICY`** only | **`0013`** has no policies; **`0012`** has none. **`0001`**, **`0002`**, **`0006`–`0011`**, **`0014`–`0017`** already pair **`DROP POLICY IF EXISTS`** with **`CREATE POLICY`**. |
| **`ALTER TABLE … ADD CONSTRAINT`** | **`0013`** uses **`DROP CONSTRAINT IF EXISTS`** before **`ADD CONSTRAINT`** for check constraints — good pattern for reruns. Other files rely on **`CREATE TABLE IF NOT EXISTS`** / **`CREATE INDEX IF NOT EXISTS`**. |
| **Repo migrator skips `0012`** | **`scripts/apply-migrations.mjs`** does not list **`0012_complete_procedure_execution_rpc.sql`**; behavior depends on **`0013`** replacing RPCs. Not an idempotency bug of policies, but ordering matters for fresh installs. |

---

## D. Should `db:migrate` run cleanly on existing staging?

**Yes, for the reported failure mode** (“policy … already exists” on **`studies_select_study_scope`** and similar): **`0003`–`0005`** now tear down every policy name those files introduce before **`CREATE POLICY`**, without changing semantics.

Remaining requirements:

- Connection / SSL / pooler configuration must remain valid (outside this doc).
- Later migrations may still surface unrelated errors (e.g. manual drift, conflicting objects created outside migrations).

Recommended check after deploy: rerun **`npm run db:migrate`** once against staging; then run existing validators (**`db:validate-phase2`**, **`db:validate-phase3c`**, etc.) if available.
