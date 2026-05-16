-- Phase 2: study_versions — immutable protocol version snapshots
-- Inserts allowed for admins; no update/delete for authenticated roles (append-only).

create table if not exists public.study_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  version_label text not null,
  effective_date date,
  protocol_identifier text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists study_versions_study_version_label_key
  on public.study_versions (study_id, version_label);

create index if not exists study_versions_organization_id_idx on public.study_versions (organization_id);
create index if not exists study_versions_study_id_idx on public.study_versions (study_id);

alter table public.study_versions enable row level security;

-- Org membership read; tightened to study membership in 0005.
-- Drop tightened policy names too so migrator reruns stay a single SELECT/INSERT pair.
drop policy if exists study_versions_select_study_scope on public.study_versions;
drop policy if exists study_versions_insert_study_scope on public.study_versions;
drop policy if exists study_versions_select_org on public.study_versions;
drop policy if exists study_versions_insert_org_admin on public.study_versions;

create policy study_versions_select_org on public.study_versions
for select using (
  organization_id in (select public.user_organization_ids())
);

create policy study_versions_insert_org_admin on public.study_versions
for insert with check (
  public.user_is_org_admin(organization_id)
);

-- Intentionally no UPDATE/DELETE for JWT roles (immutability). Service role bypasses RLS for break-glass.
