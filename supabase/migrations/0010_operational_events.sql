-- Phase 2: operational_events — append-only clinical/business event stream
-- No UPDATE/DELETE policies for authenticated roles (corrections via *_CORRECTED event types).

create or replace function public.user_can_append_operational_events(_study_id uuid)
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

revoke all on function public.user_can_append_operational_events(uuid) from public;
grant execute on function public.user_can_append_operational_events(uuid) to authenticated, anon;

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users (id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint operational_events_payload_not_excessive check (octet_length(payload::text) <= 524288)
);

create index if not exists operational_events_study_occurred_idx
  on public.operational_events (study_id, occurred_at desc);
create index if not exists operational_events_visit_idx on public.operational_events (visit_id);
create index if not exists operational_events_org_idx on public.operational_events (organization_id);

comment on table public.operational_events is
  'Append-only operational facts. Do not mirror into audit_events — audit_events remains security/compliance only per Phase 2 plan.';

-- Align organization_id / visit_id with procedure_execution or visit when present
create or replace function public.enforce_operational_events_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pe_study uuid;
  pe_org uuid;
  pe_visit uuid;
  v_study uuid;
  v_org uuid;
begin
  if new.procedure_execution_id is not null then
    select pe.study_id, pe.organization_id, pe.visit_id
      into pe_study, pe_org, pe_visit
    from public.procedure_executions pe
    where pe.id = new.procedure_execution_id;

    if pe_study is null then
      raise exception 'procedure_execution not found';
    end if;

    new.study_id := pe_study;
    new.organization_id := pe_org;
    if new.visit_id is null then
      new.visit_id := pe_visit;
    elsif new.visit_id is distinct from pe_visit then
      raise exception 'visit_id must match procedure_execution.visit_id';
    end if;
  elsif new.visit_id is not null then
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
  end if;

  -- study_id must align with study organization
  if not exists (
    select 1 from public.studies s
    where s.id = new.study_id and s.organization_id = new.organization_id
  ) then
    raise exception 'organization_id must match parent study.organization_id';
  end if;

  return new;
end;
$$;

drop trigger if exists operational_events_enforce_consistency on public.operational_events;
create trigger operational_events_enforce_consistency
before insert or update of organization_id, study_id, visit_id, procedure_execution_id
on public.operational_events
for each row execute function public.enforce_operational_events_consistency();

alter table public.operational_events enable row level security;

drop policy if exists operational_events_select on public.operational_events;
create policy operational_events_select on public.operational_events
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists operational_events_insert on public.operational_events;
create policy operational_events_insert on public.operational_events
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_append_operational_events(study_id)
);

-- Intentionally no UPDATE/DELETE policies for JWT roles (append-only).
