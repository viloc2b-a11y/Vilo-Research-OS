-- Phase: Operational Calendar scheduling foundation
-- scheduled_visits is the operational planning/calendar layer:
-- visit_definitions = protocol template
-- scheduled_visits = generated or manual operational schedule
-- visits = actual clinical execution

create table if not exists public.scheduled_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_definition_id uuid not null references public.visit_definitions (id) on delete restrict,
  visit_id uuid references public.visits (id) on delete set null,
  visit_name text not null,
  visit_number text,
  study_day integer,
  ideal_date date not null,
  window_open_date date,
  window_close_date date,
  status text not null default 'upcoming'
    check (status in (
      'upcoming',
      'today',
      'completed',
      'overdue',
      'cancelled',
      'missed',
      'rescheduled'
    )),
  modality text not null default 'onsite'
    check (modality in (
      'onsite',
      'phone',
      'remote',
      'vendor',
      'unspecified'
    )),
  assigned_user_id uuid references auth.users (id),
  generated_from_protocol boolean not null default true,
  manual_override boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, visit_definition_id)
);

create index if not exists scheduled_visits_organization_id_idx
  on public.scheduled_visits (organization_id);
create index if not exists scheduled_visits_study_id_idx
  on public.scheduled_visits (study_id);
create index if not exists scheduled_visits_subject_id_idx
  on public.scheduled_visits (subject_id);
create index if not exists scheduled_visits_ideal_date_idx
  on public.scheduled_visits (ideal_date);
create index if not exists scheduled_visits_status_idx
  on public.scheduled_visits (status);
create index if not exists scheduled_visits_assigned_user_id_idx
  on public.scheduled_visits (assigned_user_id);
create index if not exists scheduled_visits_visit_definition_id_idx
  on public.scheduled_visits (visit_definition_id);

create or replace function public.enforce_scheduled_visit_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subject_study uuid;
  subject_org uuid;
  definition_study uuid;
  definition_org uuid;
  execution_study uuid;
  execution_org uuid;
  execution_subject uuid;
begin
  select ss.study_id, ss.organization_id
    into subject_study, subject_org
  from public.study_subjects ss
  where ss.id = new.subject_id;

  if subject_study is null then
    raise exception 'scheduled_visits.subject_id does not reference an existing subject';
  end if;

  select vd.study_id, vd.organization_id
    into definition_study, definition_org
  from public.visit_definitions vd
  where vd.id = new.visit_definition_id;

  if definition_study is null then
    raise exception 'scheduled_visits.visit_definition_id does not reference an existing visit definition';
  end if;

  if definition_study is distinct from subject_study then
    raise exception 'scheduled visit definition must belong to the same study as the subject';
  end if;

  new.study_id := subject_study;
  new.organization_id := subject_org;

  if definition_org is distinct from subject_org then
    raise exception 'scheduled visit definition organization must match subject organization';
  end if;

  if new.visit_id is not null then
    select v.study_id, v.organization_id, v.study_subject_id
      into execution_study, execution_org, execution_subject
    from public.visits v
    where v.id = new.visit_id;

    if execution_study is null then
      raise exception 'scheduled_visits.visit_id does not reference an existing visit';
    end if;

    if execution_study is distinct from new.study_id
      or execution_org is distinct from new.organization_id
      or execution_subject is distinct from new.subject_id then
      raise exception 'scheduled visit execution link must match scheduled visit study, organization, and subject';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists scheduled_visits_enforce_consistency on public.scheduled_visits;
create trigger scheduled_visits_enforce_consistency
before insert or update of organization_id, study_id, subject_id, visit_definition_id, visit_id
on public.scheduled_visits
for each row execute function public.enforce_scheduled_visit_consistency();

drop trigger if exists scheduled_visits_set_updated_at on public.scheduled_visits;
create trigger scheduled_visits_set_updated_at
before update on public.scheduled_visits
for each row execute function public.generic_set_updated_at();

alter table public.scheduled_visits enable row level security;

drop policy if exists scheduled_visits_select on public.scheduled_visits;
create policy scheduled_visits_select on public.scheduled_visits
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists scheduled_visits_insert on public.scheduled_visits;
create policy scheduled_visits_insert on public.scheduled_visits
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists scheduled_visits_update on public.scheduled_visits;
create policy scheduled_visits_update on public.scheduled_visits
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists scheduled_visits_delete on public.scheduled_visits;
create policy scheduled_visits_delete on public.scheduled_visits
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);

comment on table public.scheduled_visits is
  'Operational planning/calendar layer generated from protocol visit definitions. Does not replace actual visits execution records.';
comment on column public.scheduled_visits.manual_override is
  'When true, protocol regeneration must not overwrite this row.';
comment on column public.scheduled_visits.visit_id is
  'Optional link to actual clinical execution visit once created or matched.';
