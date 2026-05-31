-- Phase 6B.5 — Operational Visit Action Bar.
-- Lean coordinator runtime controls; not Part 11, SDV, CRA, or workflow orchestration.

alter table public.procedure_executions
  add column if not exists is_signed boolean not null default false,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid references auth.users (id) on delete set null,
  add column if not exists is_locked boolean not null default false,
  add column if not exists validation_status text not null default 'incomplete'
    check (validation_status in ('clean', 'warning', 'incomplete', 'blocked'));

create table if not exists public.subject_visit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  subject_visit_id uuid not null references public.visits (id) on delete cascade,
  procedure_execution_id uuid references public.procedure_executions (id) on delete cascade,
  note_text text not null check (length(trim(note_text)) > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subject_visit_notes_visit_idx
  on public.subject_visit_notes (subject_visit_id, created_at desc);

create index if not exists subject_visit_notes_procedure_idx
  on public.subject_visit_notes (procedure_execution_id, created_at desc);

create or replace function public.phase6b5_enforce_subject_visit_note_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_study uuid;
  v_proc_visit uuid;
begin
  select v.organization_id, v.study_id
    into v_org, v_study
  from public.visits v
  where v.id = new.subject_visit_id;

  if v_org is null then
    raise exception 'subject_visit_id not found';
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  if new.study_id is distinct from v_study then
    new.study_id := v_study;
  end if;

  if new.procedure_execution_id is not null then
    select pe.visit_id into v_proc_visit
    from public.procedure_executions pe
    where pe.id = new.procedure_execution_id;

    if v_proc_visit is distinct from new.subject_visit_id then
      raise exception 'procedure_execution_id must belong to subject_visit_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subject_visit_notes_enforce_scope on public.subject_visit_notes;
create trigger subject_visit_notes_enforce_scope
before insert or update of organization_id, study_id, subject_visit_id, procedure_execution_id
on public.subject_visit_notes
for each row execute function public.phase6b5_enforce_subject_visit_note_scope();

alter table public.subject_visit_notes enable row level security;

drop policy if exists subject_visit_notes_select on public.subject_visit_notes;
create policy subject_visit_notes_select on public.subject_visit_notes
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists subject_visit_notes_insert on public.subject_visit_notes;
create policy subject_visit_notes_insert on public.subject_visit_notes
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

comment on table public.subject_visit_notes is
  'Coordinator operational visit/procedure notes. Not sponsor review, SDV, or eTMF.';

-- Phase 6B.5: visit progress notes + coordinator / investigator operational signatures

alter table public.visits
  add column if not exists visit_review_status text not null default 'draft',
  add column if not exists coordinator_signed_at timestamptz,
  add column if not exists coordinator_signed_by uuid references auth.users (id),
  add column if not exists coordinator_signed_by_name text,
  add column if not exists investigator_signed_at timestamptz,
  add column if not exists investigator_signed_by uuid references auth.users (id),
  add column if not exists investigator_signed_by_name text,
  add column if not exists investigator_role text;

alter table public.visits drop constraint if exists visits_visit_review_status_check;
alter table public.visits add constraint visits_visit_review_status_check check (
  visit_review_status in ('draft', 'coordinator_signed', 'investigator_signed', 'reopened')
);

alter table public.visits drop constraint if exists visits_investigator_role_check;
alter table public.visits add constraint visits_investigator_role_check check (
  investigator_role is null
  or investigator_role in ('principal_investigator', 'sub_investigator')
);

create table if not exists public.visit_progress_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  note_text text not null default '',
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  coordinator_signed_by_user_id uuid references auth.users (id),
  coordinator_signed_by_name text,
  coordinator_signed_at timestamptz,
  coordinator_signature_status text not null default 'draft',
  investigator_signed_by_user_id uuid references auth.users (id),
  investigator_signed_by_name text,
  investigator_role text,
  investigator_signed_at timestamptz,
  investigator_review_status text not null default 'pending',
  unique (visit_id)
);

alter table public.visit_progress_notes drop constraint if exists visit_progress_notes_coordinator_signature_status_check;
alter table public.visit_progress_notes add constraint visit_progress_notes_coordinator_signature_status_check check (
  coordinator_signature_status in ('draft', 'signed')
);

alter table public.visit_progress_notes drop constraint if exists visit_progress_notes_investigator_review_status_check;
alter table public.visit_progress_notes add constraint visit_progress_notes_investigator_review_status_check check (
  investigator_review_status in ('pending', 'signed', 'reopened')
);

alter table public.visit_progress_notes drop constraint if exists visit_progress_notes_investigator_role_check;
alter table public.visit_progress_notes add constraint visit_progress_notes_investigator_role_check check (
  investigator_role is null
  or investigator_role in ('principal_investigator', 'sub_investigator')
);

create index if not exists visit_progress_notes_visit_id_idx on public.visit_progress_notes (visit_id);

create or replace function public.enforce_visit_progress_note_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select v.organization_id into v_org from public.visits v where v.id = new.visit_id;
  if v_org is null then
    raise exception 'visit not found';
  end if;
  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists visit_progress_notes_enforce_org on public.visit_progress_notes;
create trigger visit_progress_notes_enforce_org
before insert or update of visit_id, organization_id on public.visit_progress_notes
for each row execute function public.enforce_visit_progress_note_consistency();

drop trigger if exists visit_progress_notes_set_updated_at on public.visit_progress_notes;
create trigger visit_progress_notes_set_updated_at
before update on public.visit_progress_notes
for each row execute function public.generic_set_updated_at();

alter table public.visit_progress_notes enable row level security;

drop policy if exists visit_progress_notes_select on public.visit_progress_notes;
create policy visit_progress_notes_select on public.visit_progress_notes
for select using (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_progress_notes.visit_id
      and (
        public.user_is_org_admin(v.organization_id)
        or public.user_has_study_access(v.study_id)
      )
  )
);

drop policy if exists visit_progress_notes_insert on public.visit_progress_notes;
create policy visit_progress_notes_insert on public.visit_progress_notes
for insert with check (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_progress_notes.visit_id
      and public.user_can_manage_subject_enrollment(v.study_id)
  )
);

drop policy if exists visit_progress_notes_update on public.visit_progress_notes;
create policy visit_progress_notes_update on public.visit_progress_notes
for update using (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_progress_notes.visit_id
      and public.user_can_manage_subject_enrollment(v.study_id)
  )
) with check (
  organization_id in (select public.user_organization_ids())
);
