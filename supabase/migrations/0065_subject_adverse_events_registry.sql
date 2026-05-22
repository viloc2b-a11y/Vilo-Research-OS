-- Subject-level adverse event registry (coordinator AE log).
-- Complements operational AE timeline (source capture, workflow, signals).

create table if not exists public.subject_adverse_events (
  ae_id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  event_term text not null,
  preferred_term text,
  severity text,
  seriousness boolean not null default false,
  relationship_to_ip text,
  lifecycle_status text not null default 'open',
  onset_date date,
  resolution_date date,
  source_attribution text,
  comments text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint subject_adverse_events_event_term_nonempty check (
    length(trim(both from event_term)) > 0
  ),
  constraint subject_adverse_events_severity_check check (
    severity is null
    or severity in ('mild', 'moderate', 'severe', 'life-threatening', 'unknown')
  ),
  constraint subject_adverse_events_relationship_check check (
    relationship_to_ip is null
    or relationship_to_ip in ('related', 'possibly_related', 'not_related', 'unlikely', 'unknown')
  ),
  constraint subject_adverse_events_lifecycle_check check (
    lifecycle_status in ('open', 'follow_up', 'resolved', 'closed')
  ),
  constraint subject_adverse_events_resolution_after_onset check (
    resolution_date is null
    or onset_date is null
    or resolution_date >= onset_date
  )
);

comment on table public.subject_adverse_events is
  'Per-subject adverse event records entered at the subject workspace. Not a formal pharmacovigilance case registry.';

create index if not exists subject_adverse_events_org_subject_idx
  on public.subject_adverse_events (organization_id, study_subject_id, lifecycle_status);

create index if not exists subject_adverse_events_visit_idx
  on public.subject_adverse_events (visit_id)
  where visit_id is not null;

create or replace function public.phase6c1_enforce_subject_adverse_events_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select ss.organization_id into v_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_adverse_events';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists subject_adverse_events_enforce_subject on public.subject_adverse_events;
create trigger subject_adverse_events_enforce_subject
  before insert or update of organization_id, study_subject_id
  on public.subject_adverse_events
  for each row execute function public.phase6c1_enforce_subject_adverse_events_row ();

drop trigger if exists subject_adverse_events_set_updated_at on public.subject_adverse_events;
create trigger subject_adverse_events_set_updated_at
  before update on public.subject_adverse_events
  for each row execute function public.generic_set_updated_at ();

alter table public.subject_adverse_events enable row level security;

drop policy if exists subject_adverse_events_select on public.subject_adverse_events;
create policy subject_adverse_events_select on public.subject_adverse_events
  for select using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

drop policy if exists subject_adverse_events_insert on public.subject_adverse_events;
create policy subject_adverse_events_insert on public.subject_adverse_events
  for insert with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_adverse_events_update on public.subject_adverse_events;
create policy subject_adverse_events_update on public.subject_adverse_events
  for update using (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  ) with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_adverse_events_delete on public.subject_adverse_events;
create policy subject_adverse_events_delete on public.subject_adverse_events
  for delete using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_is_study_admin (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

-- Extend clinical profile audit log for AE registry mutations.
alter table public.subject_clinical_profile_events
  drop constraint if exists subject_clinical_profile_events_section_check;

alter table public.subject_clinical_profile_events
  add constraint subject_clinical_profile_events_section_check check (
    section in (
      'medical_history',
      'conmeds',
      'allergies',
      'surgical_history',
      'lifestyle',
      'adverse_events'
    )
  );
