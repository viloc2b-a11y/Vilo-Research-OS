-- Phase 2: visits — scheduled/performed visit instances

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_definition_id uuid not null references public.visit_definitions (id) on delete restrict,
  scheduled_date date not null,
  scheduled_window_end timestamptz,
  visit_status text not null default 'scheduled'
    check (visit_status in (
      'scheduled',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    )),
  occurred_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visits_study_id_idx on public.visits (study_id);
create index if not exists visits_subject_id_idx on public.visits (study_subject_id);
create index if not exists visits_scheduled_date_idx on public.visits (scheduled_date);

-- Visit organization/study must match subject
create or replace function public.enforce_visit_subject_study_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_study uuid;
  sub_org uuid;
begin
  select ss.study_id, ss.organization_id into sub_study, sub_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if sub_study is null then
    raise exception 'study_subject not found';
  end if;

  if new.study_id is distinct from sub_study then
    new.study_id := sub_study;
  end if;

  if new.organization_id is distinct from sub_org then
    new.organization_id := sub_org;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_visit_definition_matches_study()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  def_study uuid;
begin
  select vd.study_id into def_study
  from public.visit_definitions vd
  where vd.id = new.visit_definition_id;

  if def_study is null then
    raise exception 'visit_definition not found';
  end if;

  if def_study is distinct from new.study_id then
    raise exception 'visit_definition must belong to the same study as the visit';
  end if;

  return new;
end;
$$;

drop trigger if exists visits_match_definition_study on public.visits;
create trigger visits_match_definition_study
before insert or update of visit_definition_id, study_id on public.visits
for each row execute function public.enforce_visit_definition_matches_study();

drop trigger if exists visits_enforce_subject on public.visits;
create trigger visits_enforce_subject
before insert or update of study_subject_id, study_id, organization_id on public.visits
for each row execute function public.enforce_visit_subject_study_consistency();

drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at
before update on public.visits
for each row execute function public.generic_set_updated_at();

alter table public.visits enable row level security;

drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists visits_delete on public.visits;
create policy visits_delete on public.visits
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);
