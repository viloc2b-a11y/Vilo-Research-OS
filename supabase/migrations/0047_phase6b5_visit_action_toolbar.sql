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

