-- Phase 5 — Runtime replay artifacts & operational intelligence (derived only).
-- Canonical chronology: operational_events + execution tables.

-- ---------------------------------------------------------------------------
-- Replay artifacts (rebuildable inspection-grade timelines)
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_replay_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  scope text not null check (scope in ('visit', 'subject')),
  scope_id uuid not null,
  replay_version int not null default 1,
  computed_at timestamptz not null default now(),
  timeline_document jsonb not null default '{}'::jsonb,
  causality_chain jsonb not null default '[]'::jsonb,
  explanations jsonb not null default '{}'::jsonb,
  source_event_count int not null default 0,
  unique (scope, scope_id, replay_version)
);

create index if not exists runtime_replay_artifacts_study_idx
  on public.runtime_replay_artifacts (study_id, computed_at desc);
create index if not exists runtime_replay_artifacts_scope_idx
  on public.runtime_replay_artifacts (scope, scope_id);

-- ---------------------------------------------------------------------------
-- Operational intelligence projections (runtime-emergent metrics)
-- ---------------------------------------------------------------------------

create table if not exists public.visit_operational_intelligence_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  intelligence_version int not null default 1,
  coordinator_burden jsonb not null default '{}'::jsonb,
  visit_complexity jsonb not null default '{}'::jsonb,
  protocol_friction jsonb not null default '{}'::jsonb,
  runtime_risk jsonb not null default '{}'::jsonb,
  intelligence_signals jsonb not null default '[]'::jsonb,
  burden_score int not null default 0,
  complexity_score int not null default 0,
  friction_score int not null default 0,
  risk_score int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_operational_intelligence_study_idx
  on public.visit_operational_intelligence_projections (study_id, risk_score desc);

create table if not exists public.subject_operational_intelligence_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  intelligence_version int not null default 1,
  coordinator_burden jsonb not null default '{}'::jsonb,
  visit_complexity_aggregate jsonb not null default '{}'::jsonb,
  protocol_friction jsonb not null default '{}'::jsonb,
  runtime_risk jsonb not null default '{}'::jsonb,
  intelligence_signals jsonb not null default '[]'::jsonb,
  burden_score int not null default 0,
  friction_score int not null default 0,
  risk_score int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_operational_intelligence_study_idx
  on public.subject_operational_intelligence_projections (study_id, risk_score desc);

comment on table public.runtime_replay_artifacts is
  'Phase 5 derived: inspection-grade replay timelines rebuilt from operational_events + execution.';
comment on table public.visit_operational_intelligence_projections is
  'Phase 5 derived: visit-level operational intelligence from runtime execution (not BI).';
comment on table public.subject_operational_intelligence_projections is
  'Phase 5 derived: subject-level operational intelligence aggregates.';

-- Org consistency
create or replace function public.enforce_replay_intel_row_org()
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

drop trigger if exists runtime_replay_artifacts_enforce_org on public.runtime_replay_artifacts;
create trigger runtime_replay_artifacts_enforce_org
before insert or update of organization_id, study_id on public.runtime_replay_artifacts
for each row execute function public.enforce_replay_intel_row_org();

drop trigger if exists visit_operational_intelligence_enforce_org on public.visit_operational_intelligence_projections;
create trigger visit_operational_intelligence_enforce_org
before insert or update of organization_id, study_id on public.visit_operational_intelligence_projections
for each row execute function public.enforce_replay_intel_row_org();

drop trigger if exists subject_operational_intelligence_enforce_org on public.subject_operational_intelligence_projections;
create trigger subject_operational_intelligence_enforce_org
before insert or update of organization_id, study_id on public.subject_operational_intelligence_projections
for each row execute function public.enforce_replay_intel_row_org();

alter table public.runtime_replay_artifacts enable row level security;
alter table public.visit_operational_intelligence_projections enable row level security;
alter table public.subject_operational_intelligence_projections enable row level security;

drop policy if exists runtime_replay_artifacts_select on public.runtime_replay_artifacts;
create policy runtime_replay_artifacts_select on public.runtime_replay_artifacts
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists runtime_replay_artifacts_upsert on public.runtime_replay_artifacts;
create policy runtime_replay_artifacts_upsert on public.runtime_replay_artifacts
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists visit_operational_intelligence_select on public.visit_operational_intelligence_projections;
create policy visit_operational_intelligence_select on public.visit_operational_intelligence_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_operational_intelligence_upsert on public.visit_operational_intelligence_projections;
create policy visit_operational_intelligence_upsert on public.visit_operational_intelligence_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_operational_intelligence_select on public.subject_operational_intelligence_projections;
create policy subject_operational_intelligence_select on public.subject_operational_intelligence_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_operational_intelligence_upsert on public.subject_operational_intelligence_projections;
create policy subject_operational_intelligence_upsert on public.subject_operational_intelligence_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);
