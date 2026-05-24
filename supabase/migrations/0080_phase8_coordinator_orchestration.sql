-- Phase 8 — Coordinator orchestration engine (derived from runtime; not a task manager).

create table if not exists public.visit_coordinator_orchestration_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  orchestration_version int not null default 1,
  next_actions jsonb not null default '[]'::jsonb,
  priority_scores jsonb not null default '{}'::jsonb,
  urgency jsonb not null default '{}'::jsonb,
  blocker_chains jsonb not null default '[]'::jsonb,
  work_queue jsonb not null default '{}'::jsonb,
  visit_execution jsonb not null default '{}'::jsonb,
  top_priority_score int not null default 0,
  action_now_count int not null default 0,
  escalation_count int not null default 0,
  pi_review_count int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_coordinator_orch_study_idx
  on public.visit_coordinator_orchestration_projections (study_id, top_priority_score desc);
create index if not exists visit_coordinator_orch_subject_idx
  on public.visit_coordinator_orchestration_projections (study_subject_id);

create table if not exists public.subject_coordinator_orchestration_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  orchestration_version int not null default 1,
  next_actions jsonb not null default '[]'::jsonb,
  priority_scores jsonb not null default '{}'::jsonb,
  urgency jsonb not null default '{}'::jsonb,
  blocker_chains jsonb not null default '[]'::jsonb,
  work_queue jsonb not null default '{}'::jsonb,
  subject_escalation jsonb not null default '{}'::jsonb,
  top_priority_score int not null default 0,
  action_now_count int not null default 0,
  escalation_count int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_coordinator_orch_study_idx
  on public.subject_coordinator_orchestration_projections (study_id, top_priority_score desc);

comment on table public.visit_coordinator_orchestration_projections is
  'Phase 8 derived: coordinator next-actions, priority, urgency, and work queue per visit.';
comment on table public.subject_coordinator_orchestration_projections is
  'Phase 8 derived: subject-level coordinator orchestration rollup.';

create or replace function public.enforce_coordinator_orchestration_row_org()
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

drop trigger if exists visit_coordinator_orch_enforce_org on public.visit_coordinator_orchestration_projections;
create trigger visit_coordinator_orch_enforce_org
before insert or update of organization_id, study_id on public.visit_coordinator_orchestration_projections
for each row execute function public.enforce_coordinator_orchestration_row_org();

drop trigger if exists subject_coordinator_orch_enforce_org on public.subject_coordinator_orchestration_projections;
create trigger subject_coordinator_orch_enforce_org
before insert or update of organization_id, study_id on public.subject_coordinator_orchestration_projections
for each row execute function public.enforce_coordinator_orchestration_row_org();

alter table public.visit_coordinator_orchestration_projections enable row level security;
alter table public.subject_coordinator_orchestration_projections enable row level security;

drop policy if exists visit_coordinator_orch_select on public.visit_coordinator_orchestration_projections;
create policy visit_coordinator_orch_select on public.visit_coordinator_orchestration_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_coordinator_orch_upsert on public.visit_coordinator_orchestration_projections;
create policy visit_coordinator_orch_upsert on public.visit_coordinator_orchestration_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_coordinator_orch_select on public.subject_coordinator_orchestration_projections;
create policy subject_coordinator_orch_select on public.subject_coordinator_orchestration_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_coordinator_orch_upsert on public.subject_coordinator_orchestration_projections;
create policy subject_coordinator_orch_upsert on public.subject_coordinator_orchestration_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);
