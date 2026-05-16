-- Phase 2: study_members — study-scoped RBAC bridge
-- SECURITY DEFINER helpers avoid RLS recursion on study_members (same pattern as 0001).

create table if not exists public.study_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (
    role in (
      'study_admin',
      'coordinator',
      'monitor',
      'lab',
      'finance',
      'viewer'
    )
  ),
  created_at timestamptz not null default now(),
  unique (study_id, user_id)
);

create index if not exists study_members_user_id_idx on public.study_members (user_id);
create index if not exists study_members_study_id_idx on public.study_members (study_id);
create index if not exists study_members_organization_id_idx on public.study_members (organization_id);

-- Keep denormalized organization_id aligned with parent study.
create or replace function public.enforce_study_members_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select s.organization_id into org
  from public.studies s
  where s.id = new.study_id;

  if org is null then
    raise exception 'study not found for study_id %', new.study_id;
  end if;

  if new.organization_id is distinct from org then
    new.organization_id := org;
  end if;

  return new;
end;
$$;

drop trigger if exists study_members_enforce_org on public.study_members;
create trigger study_members_enforce_org
before insert or update of organization_id, study_id on public.study_members
for each row execute function public.enforce_study_members_organization_id();

alter table public.study_members enable row level security;

-- Membership helpers (SECURITY DEFINER reads study_members without RLS re-entry)
create or replace function public.user_study_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select study_id
  from public.study_members
  where user_id = auth.uid();
$$;

create or replace function public.user_has_study_access(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.study_members sm
    where sm.study_id = _study_id
      and sm.user_id = auth.uid()
  );
$$;

create or replace function public.user_is_study_admin(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.study_members sm
    where sm.study_id = _study_id
      and sm.user_id = auth.uid()
      and sm.role = 'study_admin'
  );
$$;

create or replace function public.user_can_manage_study_roster(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin((select s.organization_id from public.studies s where s.id = _study_id))
    or public.user_is_study_admin(_study_id);
$$;

revoke all on function public.user_study_ids() from public;
revoke all on function public.user_has_study_access(uuid) from public;
revoke all on function public.user_is_study_admin(uuid) from public;
revoke all on function public.user_can_manage_study_roster(uuid) from public;
grant execute on function public.user_study_ids() to authenticated, anon;
grant execute on function public.user_has_study_access(uuid) to authenticated, anon;
grant execute on function public.user_is_study_admin(uuid) to authenticated, anon;
grant execute on function public.user_can_manage_study_roster(uuid) to authenticated, anon;

-- study_members policies (use helpers — no recursion)
drop policy if exists study_members_select on public.study_members;
create policy study_members_select on public.study_members
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists study_members_insert on public.study_members;
create policy study_members_insert on public.study_members
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_study_roster(study_id)
);

drop policy if exists study_members_update on public.study_members;
create policy study_members_update on public.study_members
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_study_roster(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_study_roster(study_id)
);

drop policy if exists study_members_delete on public.study_members;
create policy study_members_delete on public.study_members
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);

-- Tighten studies + study_versions: org + (study member OR org admin reader)
drop policy if exists studies_select_org on public.studies;
drop policy if exists studies_insert_org_admin on public.studies;
drop policy if exists studies_update_org_admin on public.studies;
drop policy if exists studies_delete_org_admin on public.studies;

create policy studies_select_study_scope on public.studies
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or id in (select public.user_study_ids())
  )
);

create policy studies_insert_org_admin on public.studies
for insert with check (
  public.user_is_org_admin(organization_id)
);

create policy studies_update_study_scope on public.studies
for update using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(id)
  )
) with check (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(id)
  )
);

create policy studies_delete_org_admin on public.studies
for delete using (
  public.user_is_org_admin(organization_id)
);

drop policy if exists study_versions_select_org on public.study_versions;
drop policy if exists study_versions_insert_org_admin on public.study_versions;

create policy study_versions_select_study_scope on public.study_versions
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

create policy study_versions_insert_study_scope on public.study_versions
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);
