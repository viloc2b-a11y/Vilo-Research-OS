-- Phase 2: visit_definitions, procedure_definitions, visit_def_procedure_map
-- Depends on studies, study_versions, study_members helpers (0005).

create or replace function public.user_can_edit_study_definitions(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin((select s.organization_id from public.studies s where s.id = _study_id))
    or exists (
      select 1
      from public.study_members sm
      where sm.study_id = _study_id
        and sm.user_id = auth.uid()
        and sm.role in ('study_admin', 'coordinator', 'lab')
    );
$$;

revoke all on function public.user_can_edit_study_definitions(uuid) from public;
grant execute on function public.user_can_edit_study_definitions(uuid) to authenticated, anon;

create or replace function public.enforce_row_study_organization_consistency()
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

create table if not exists public.visit_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete set null,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, code)
);

create table if not exists public.procedure_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete set null,
  code text not null,
  label text not null,
  is_required_default boolean not null default false,
  billable_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, code)
);

create table if not exists public.visit_def_procedure_map (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  visit_definition_id uuid not null references public.visit_definitions (id) on delete cascade,
  procedure_definition_id uuid not null references public.procedure_definitions (id) on delete cascade,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (visit_definition_id, procedure_definition_id)
);

create index if not exists visit_definitions_study_id_idx on public.visit_definitions (study_id);
create index if not exists procedure_definitions_study_id_idx on public.procedure_definitions (study_id);
create index if not exists visit_def_procedure_map_study_id_idx on public.visit_def_procedure_map (study_id);

drop trigger if exists visit_definitions_enforce_org on public.visit_definitions;
create trigger visit_definitions_enforce_org
before insert or update of organization_id, study_id on public.visit_definitions
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists procedure_definitions_enforce_org on public.procedure_definitions;
create trigger procedure_definitions_enforce_org
before insert or update of organization_id, study_id on public.procedure_definitions
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists visit_def_procedure_map_enforce_org on public.visit_def_procedure_map;
create trigger visit_def_procedure_map_enforce_org
before insert or update of organization_id, study_id on public.visit_def_procedure_map
for each row execute function public.enforce_row_study_organization_consistency();

create or replace function public.generic_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists visit_definitions_set_updated_at on public.visit_definitions;
create trigger visit_definitions_set_updated_at
before update on public.visit_definitions
for each row execute function public.generic_set_updated_at();

drop trigger if exists procedure_definitions_set_updated_at on public.procedure_definitions;
create trigger procedure_definitions_set_updated_at
before update on public.procedure_definitions
for each row execute function public.generic_set_updated_at();

-- visit_def_procedure_map: ensure visit + procedure belong to same study (and org)
create or replace function public.enforce_visit_def_procedure_map_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vd_study uuid;
  pd_study uuid;
begin
  select vd.study_id into vd_study from public.visit_definitions vd where vd.id = new.visit_definition_id;
  select pd.study_id into pd_study from public.procedure_definitions pd where pd.id = new.procedure_definition_id;

  if vd_study is distinct from pd_study then
    raise exception 'visit_definition and procedure_definition must belong to the same study';
  end if;

  if new.study_id is distinct from vd_study then
    new.study_id := vd_study;
  end if;

  select s.organization_id into new.organization_id
  from public.studies s where s.id = new.study_id;

  return new;
end;
$$;

drop trigger if exists visit_def_procedure_map_integrity on public.visit_def_procedure_map;
create trigger visit_def_procedure_map_integrity
before insert or update of visit_definition_id, procedure_definition_id, study_id, organization_id
on public.visit_def_procedure_map
for each row execute function public.enforce_visit_def_procedure_map_integrity();

-- study_version_id must belong to the same study (optional FK discipline)
create or replace function public.enforce_study_version_matches_study()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.study_version_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.study_versions sv
    where sv.id = new.study_version_id
      and sv.study_id = new.study_id
  ) then
    raise exception 'study_version_id must reference study_versions for the same study_id';
  end if;
  return new;
end;
$$;

drop trigger if exists visit_definitions_enforce_study_version on public.visit_definitions;
create trigger visit_definitions_enforce_study_version
before insert or update of study_version_id, study_id on public.visit_definitions
for each row execute function public.enforce_study_version_matches_study();

drop trigger if exists procedure_definitions_enforce_study_version on public.procedure_definitions;
create trigger procedure_definitions_enforce_study_version
before insert or update of study_version_id, study_id on public.procedure_definitions
for each row execute function public.enforce_study_version_matches_study();

alter table public.visit_definitions enable row level security;
alter table public.procedure_definitions enable row level security;
alter table public.visit_def_procedure_map enable row level security;

drop policy if exists visit_definitions_select on public.visit_definitions;
create policy visit_definitions_select on public.visit_definitions
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists visit_definitions_insert on public.visit_definitions;
create policy visit_definitions_insert on public.visit_definitions
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_definitions_update on public.visit_definitions;
create policy visit_definitions_update on public.visit_definitions
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_definitions_delete on public.visit_definitions;
create policy visit_definitions_delete on public.visit_definitions
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists procedure_definitions_select on public.procedure_definitions;
create policy procedure_definitions_select on public.procedure_definitions
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists procedure_definitions_insert on public.procedure_definitions;
create policy procedure_definitions_insert on public.procedure_definitions
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists procedure_definitions_update on public.procedure_definitions;
create policy procedure_definitions_update on public.procedure_definitions
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists procedure_definitions_delete on public.procedure_definitions;
create policy procedure_definitions_delete on public.procedure_definitions
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_def_procedure_map_select on public.visit_def_procedure_map;
create policy visit_def_procedure_map_select on public.visit_def_procedure_map
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists visit_def_procedure_map_insert on public.visit_def_procedure_map;
create policy visit_def_procedure_map_insert on public.visit_def_procedure_map
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_def_procedure_map_update on public.visit_def_procedure_map;
create policy visit_def_procedure_map_update on public.visit_def_procedure_map
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_def_procedure_map_delete on public.visit_def_procedure_map;
create policy visit_def_procedure_map_delete on public.visit_def_procedure_map
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);
