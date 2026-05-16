-- Phase 2: studies — protocol shell per organization
-- After 0001_auth_foundation. RLS uses organization_members helpers from 0001.
-- Study-scoped policies are tightened in 0005 after study_members exists.

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists studies_organization_slug_key
  on public.studies (organization_id, slug)
  where slug is not null and length(trim(slug)) > 0;

create index if not exists studies_organization_id_idx on public.studies (organization_id);
create index if not exists studies_status_idx on public.studies (status);

drop trigger if exists studies_set_updated_at on public.studies;
create or replace function public.studies_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger studies_set_updated_at
before update on public.studies
for each row execute function public.studies_set_updated_at();

alter table public.studies enable row level security;

-- Org-only scope until 0005 adds study_members isolation.
drop policy if exists studies_select_org on public.studies;
create policy studies_select_org on public.studies
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists studies_insert_org_admin on public.studies;
create policy studies_insert_org_admin on public.studies
for insert with check (
  public.user_is_org_admin(organization_id)
);

drop policy if exists studies_update_org_admin on public.studies;
create policy studies_update_org_admin on public.studies
for update using (
  public.user_is_org_admin(organization_id)
) with check (
  public.user_is_org_admin(organization_id)
);

drop policy if exists studies_delete_org_admin on public.studies;
create policy studies_delete_org_admin on public.studies
for delete using (
  public.user_is_org_admin(organization_id)
);
