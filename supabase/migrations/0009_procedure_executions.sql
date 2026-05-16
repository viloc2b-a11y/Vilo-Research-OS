-- Phase 2: procedure_executions — line-level performed work on a visit

create table if not exists public.procedure_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  procedure_definition_id uuid not null references public.procedure_definitions (id) on delete restrict,
  execution_status text not null default 'pending'
    check (execution_status in (
      'pending',
      'in_progress',
      'completed',
      'not_applicable',
      'cancelled'
    )),
  performed_at timestamptz,
  performed_by_user_id uuid references auth.users (id),
  billable_flag boolean not null default false,
  billable_override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, procedure_definition_id)
);

create index if not exists procedure_executions_visit_id_idx on public.procedure_executions (visit_id);
create index if not exists procedure_executions_study_id_idx on public.procedure_executions (study_id);

create or replace function public.enforce_procedure_execution_visit_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_study uuid;
  v_org uuid;
begin
  select v.study_id, v.organization_id into v_study, v_org
  from public.visits v
  where v.id = new.visit_id;

  if v_study is null then
    raise exception 'visit not found';
  end if;

  if new.study_id is distinct from v_study then
    new.study_id := v_study;
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  -- Procedure definition must belong to same study as visit
  if not exists (
    select 1
    from public.procedure_definitions pd
    where pd.id = new.procedure_definition_id
      and pd.study_id = new.study_id
  ) then
    raise exception 'procedure_definition does not belong to the same study as visit';
  end if;

  return new;
end;
$$;

drop trigger if exists procedure_executions_enforce_visit on public.procedure_executions;
create trigger procedure_executions_enforce_visit
before insert or update of visit_id, procedure_definition_id, study_id, organization_id
on public.procedure_executions
for each row execute function public.enforce_procedure_execution_visit_consistency();

drop trigger if exists procedure_executions_set_updated_at on public.procedure_executions;
create trigger procedure_executions_set_updated_at
before update on public.procedure_executions
for each row execute function public.generic_set_updated_at();

alter table public.procedure_executions enable row level security;

drop policy if exists procedure_executions_select on public.procedure_executions;
create policy procedure_executions_select on public.procedure_executions
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists procedure_executions_insert on public.procedure_executions;
create policy procedure_executions_insert on public.procedure_executions
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists procedure_executions_update on public.procedure_executions;
create policy procedure_executions_update on public.procedure_executions
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists procedure_executions_delete on public.procedure_executions;
create policy procedure_executions_delete on public.procedure_executions
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);
