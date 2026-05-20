-- Phase 6B.9 — Subject longitudinal operational workflow actions.
-- Lean coordinator/CRA/PI communication layer; not BPM, SDV, or sponsor workflow orchestration.

create table if not exists public.subject_workflow_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  source_response_set_id uuid references public.source_response_sets (id) on delete set null,
  action_type text not null check (
    action_type in ('action', 'query', 'signature_request', 'follow_up', 'correction')
  ),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'resolved', 'cancelled')
  ),
  priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  title text not null,
  description text,
  assigned_role text check (assigned_role in ('crc', 'cra', 'pi', 'sub_i', 'site')),
  due_date date,
  source_section_key text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  updated_at timestamptz not null default now()
);

create index if not exists subject_workflow_actions_subject_idx
  on public.subject_workflow_actions (study_subject_id, status, due_date, created_at desc);

create index if not exists subject_workflow_actions_visit_idx
  on public.subject_workflow_actions (visit_id, status, due_date, created_at desc);

create index if not exists subject_workflow_actions_procedure_idx
  on public.subject_workflow_actions (procedure_execution_id, status);

create or replace function public.phase6b9_enforce_subject_workflow_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_study uuid;
  v_subject uuid;
  v_visit uuid;
begin
  if new.procedure_execution_id is not null then
    select pe.organization_id, pe.study_id, v.study_subject_id, pe.visit_id
      into v_org, v_study, v_subject, v_visit
    from public.procedure_executions pe
    join public.visits v on v.id = pe.visit_id
    where pe.id = new.procedure_execution_id;

    if v_org is null then raise exception 'procedure_execution_id not found'; end if;

    new.organization_id := v_org;
    new.study_id := v_study;
    new.study_subject_id := v_subject;
    if new.visit_id is null then
      new.visit_id := v_visit;
    elsif new.visit_id is distinct from v_visit then
      raise exception 'visit_id must match procedure_execution.visit_id';
    end if;
  elsif new.visit_id is not null then
    select v.organization_id, v.study_id, v.study_subject_id
      into v_org, v_study, v_subject
    from public.visits v
    where v.id = new.visit_id;

    if v_org is null then raise exception 'visit_id not found'; end if;

    new.organization_id := v_org;
    new.study_id := v_study;
    new.study_subject_id := v_subject;
  else
    select ss.organization_id, ss.study_id
      into v_org, v_study
    from public.study_subjects ss
    where ss.id = new.study_subject_id;

    if v_org is null then raise exception 'study_subject_id not found'; end if;

    new.organization_id := v_org;
    new.study_id := v_study;
  end if;

  new.updated_at := now();
  if new.status in ('resolved', 'cancelled') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if new.status not in ('resolved', 'cancelled') then
    new.resolved_at := null;
    new.resolved_by := null;
    new.resolution_note := null;
  end if;

  return new;
end;
$$;

drop trigger if exists subject_workflow_actions_enforce_scope on public.subject_workflow_actions;
create trigger subject_workflow_actions_enforce_scope
before insert or update of organization_id, study_id, study_subject_id, visit_id, procedure_execution_id, status
on public.subject_workflow_actions
for each row execute function public.phase6b9_enforce_subject_workflow_scope();

alter table public.subject_workflow_actions enable row level security;

drop policy if exists subject_workflow_actions_select on public.subject_workflow_actions;
create policy subject_workflow_actions_select on public.subject_workflow_actions
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists subject_workflow_actions_insert on public.subject_workflow_actions;
create policy subject_workflow_actions_insert on public.subject_workflow_actions
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_workflow_actions_update on public.subject_workflow_actions;
create policy subject_workflow_actions_update on public.subject_workflow_actions
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

comment on table public.subject_workflow_actions is
  'Subject-longitudinal operational actions, queries, signature requests, follow-ups, and corrections.';
