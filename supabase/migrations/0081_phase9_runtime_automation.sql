-- Phase 9 — Adaptive runtime automation (derived plans; coordinator-supervised apply).

create table if not exists public.visit_runtime_automation_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  automation_version int not null default 1,
  automation_plan jsonb not null default '{}'::jsonb,
  triggered_rules jsonb not null default '[]'::jsonb,
  proposed_actions jsonb not null default '[]'::jsonb,
  adapted_urgency jsonb not null default '{}'::jsonb,
  overload_adaptation jsonb not null default '{}'::jsonb,
  safeguards jsonb not null default '[]'::jsonb,
  pending_apply_count int not null default 0,
  applied_count int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_runtime_automation_study_idx
  on public.visit_runtime_automation_projections (study_id, computed_at desc);

create table if not exists public.subject_runtime_automation_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  automation_version int not null default 1,
  automation_plan jsonb not null default '{}'::jsonb,
  triggered_rules jsonb not null default '[]'::jsonb,
  proposed_actions jsonb not null default '[]'::jsonb,
  adapted_urgency jsonb not null default '{}'::jsonb,
  overload_adaptation jsonb not null default '{}'::jsonb,
  safeguards jsonb not null default '[]'::jsonb,
  pending_apply_count int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_runtime_automation_study_idx
  on public.subject_runtime_automation_projections (study_id, computed_at desc);

create table if not exists public.runtime_automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  rule_id text not null,
  action_id text not null,
  action_kind text not null,
  status text not null default 'applied' check (
    status in ('proposed', 'applied', 'reversed', 'overridden')
  ),
  workflow_action_id uuid references public.subject_workflow_actions (id) on delete set null,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  applied_by uuid references auth.users (id) on delete set null,
  overridden_by uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  reversed_at timestamptz,
  overridden_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists runtime_automation_executions_visit_idx
  on public.runtime_automation_executions (visit_id, status, applied_at desc);
create index if not exists runtime_automation_executions_subject_idx
  on public.runtime_automation_executions (study_subject_id, status);

comment on table public.visit_runtime_automation_projections is
  'Phase 9 derived: proposed runtime automation plan per visit (apply is explicit).';
comment on table public.runtime_automation_executions is
  'Phase 9 audit: applied/reversed/overridden automation actions linked to spine events.';

create or replace function public.enforce_runtime_automation_row_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select s.organization_id into org from public.studies s where s.id = new.study_id;
  if org is null then
    raise exception 'study not found for study_id %', new.study_id;
  end if;
  if new.organization_id is distinct from org then
    new.organization_id := org;
  end if;
  return new;
end;
$$;

drop trigger if exists visit_runtime_automation_enforce_org on public.visit_runtime_automation_projections;
create trigger visit_runtime_automation_enforce_org
before insert or update of organization_id, study_id on public.visit_runtime_automation_projections
for each row execute function public.enforce_runtime_automation_row_org();

drop trigger if exists subject_runtime_automation_enforce_org on public.subject_runtime_automation_projections;
create trigger subject_runtime_automation_enforce_org
before insert or update of organization_id, study_id on public.subject_runtime_automation_projections
for each row execute function public.enforce_runtime_automation_row_org();

alter table public.visit_runtime_automation_projections enable row level security;
alter table public.subject_runtime_automation_projections enable row level security;
alter table public.runtime_automation_executions enable row level security;

drop policy if exists visit_runtime_automation_select on public.visit_runtime_automation_projections;
create policy visit_runtime_automation_select on public.visit_runtime_automation_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_runtime_automation_upsert on public.visit_runtime_automation_projections;
create policy visit_runtime_automation_upsert on public.visit_runtime_automation_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_runtime_automation_select on public.subject_runtime_automation_projections;
create policy subject_runtime_automation_select on public.subject_runtime_automation_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_runtime_automation_upsert on public.subject_runtime_automation_projections;
create policy subject_runtime_automation_upsert on public.subject_runtime_automation_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists runtime_automation_executions_access on public.runtime_automation_executions;
create policy runtime_automation_executions_access on public.runtime_automation_executions
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);
