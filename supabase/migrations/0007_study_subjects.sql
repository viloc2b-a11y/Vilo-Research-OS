-- Phase 2: study_subjects — site enrollment registry

create or replace function public.user_can_manage_subject_enrollment(_study_id uuid)
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

revoke all on function public.user_can_manage_subject_enrollment(uuid) from public;
grant execute on function public.user_can_manage_subject_enrollment(uuid) to authenticated, anon;

create table if not exists public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete set null,
  subject_identifier text not null,
  enrollment_status text not null default 'screening'
    check (enrollment_status in (
      'screening',
      'screen_failed',
      'enrolled',
      'withdrawn',
      'completed'
    )),
  consented_at timestamptz,
  randomization_arm text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_subjects_study_id_idx on public.study_subjects (study_id);
create index if not exists study_subjects_organization_id_idx on public.study_subjects (organization_id);

create unique index if not exists study_subjects_study_subject_identifier_key
  on public.study_subjects (study_id, subject_identifier);

drop trigger if exists study_subjects_enforce_org on public.study_subjects;
create trigger study_subjects_enforce_org
before insert or update of organization_id, study_id on public.study_subjects
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists study_subjects_set_updated_at on public.study_subjects;
create trigger study_subjects_set_updated_at
before update on public.study_subjects
for each row execute function public.generic_set_updated_at();

drop trigger if exists study_subjects_enforce_study_version on public.study_subjects;
create trigger study_subjects_enforce_study_version
before insert or update of study_version_id, study_id on public.study_subjects
for each row execute function public.enforce_study_version_matches_study();

alter table public.study_subjects enable row level security;

drop policy if exists study_subjects_select on public.study_subjects;
create policy study_subjects_select on public.study_subjects
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists study_subjects_insert on public.study_subjects;
create policy study_subjects_insert on public.study_subjects
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists study_subjects_update on public.study_subjects;
create policy study_subjects_update on public.study_subjects
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists study_subjects_delete on public.study_subjects;
create policy study_subjects_delete on public.study_subjects
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);
