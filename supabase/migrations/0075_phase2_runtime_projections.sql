-- Phase 2 — Runtime state projections (derived caches only; not source of truth).

create table if not exists public.visit_readiness_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  projection_version int not null default 1,
  readiness_status text not null default 'unknown'
    check (readiness_status in ('ready', 'attention', 'blocked', 'terminal', 'unknown')),
  pending_procedure_count int not null default 0,
  unsigned_procedure_count int not null default 0,
  unresolved_finding_count int not null default 0,
  missing_source_count int not null default 0,
  safety_blocker_count int not null default 0,
  visit_completion_ready boolean not null default false,
  coordinator_sign_ready boolean not null default false,
  investigator_sign_ready boolean not null default false,
  blocker_count int not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_readiness_projections_study_idx
  on public.visit_readiness_projections (study_id, computed_at desc);
create index if not exists visit_readiness_projections_subject_idx
  on public.visit_readiness_projections (study_subject_id);

create table if not exists public.subject_runtime_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  projection_version int not null default 1,
  longitudinal_state text not null default 'unknown'
    check (longitudinal_state in ('screening', 'active', 'follow_up', 'terminal', 'unknown')),
  operational_health text not null default 'unknown'
    check (operational_health in ('healthy', 'attention', 'critical', 'unknown')),
  unresolved_safety_count int not null default 0,
  missed_visit_count int not null default 0,
  pending_workflow_count int not null default 0,
  incomplete_source_count int not null default 0,
  open_visit_count int not null default 0,
  blocker_count int not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_runtime_projections_study_idx
  on public.subject_runtime_projections (study_id, computed_at desc);

create table if not exists public.study_execution_projections (
  study_id uuid primary key references public.studies (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  computed_at timestamptz not null default now(),
  projection_version int not null default 1,
  operational_risk_level text not null default 'unknown'
    check (operational_risk_level in ('low', 'moderate', 'elevated', 'critical', 'unknown')),
  enrolled_subject_count int not null default 0,
  active_subject_count int not null default 0,
  incomplete_source_count int not null default 0,
  open_workflow_count int not null default 0,
  open_query_count int not null default 0,
  missed_visit_count int not null default 0,
  unresolved_safety_count int not null default 0,
  protocol_execution_burden_score int not null default 0,
  source_completion_burden_score int not null default 0,
  blocker_count int not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists study_execution_projections_org_idx
  on public.study_execution_projections (organization_id);

create table if not exists public.runtime_projection_refresh_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  scope text not null check (scope in ('visit', 'subject', 'study', 'organization')),
  scope_id uuid not null,
  projection_kind text not null
    check (projection_kind in ('visit_readiness', 'subject_runtime', 'study_execution', 'all')),
  refresh_mode text not null check (refresh_mode in ('targeted', 'cascade', 'rebuild')),
  projection_version int not null,
  rows_affected int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create index if not exists runtime_projection_refresh_log_scope_idx
  on public.runtime_projection_refresh_log (scope, scope_id, started_at desc);

comment on table public.visit_readiness_projections is
  'Derived visit execution readiness. Rebuild from visits/procedures/source — never authoritative.';
comment on table public.subject_runtime_projections is
  'Derived subject longitudinal runtime state. Rebuild from execution tables — never authoritative.';
comment on table public.study_execution_projections is
  'Derived study-level operational burden. Rebuild from subject/visit aggregates — never authoritative.';

-- RLS: read like study data; write via refresh (coordinators+)
alter table public.visit_readiness_projections enable row level security;
alter table public.subject_runtime_projections enable row level security;
alter table public.study_execution_projections enable row level security;
alter table public.runtime_projection_refresh_log enable row level security;

drop policy if exists visit_readiness_projections_select on public.visit_readiness_projections;
create policy visit_readiness_projections_select on public.visit_readiness_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_readiness_projections_upsert on public.visit_readiness_projections;
create policy visit_readiness_projections_upsert on public.visit_readiness_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
)
with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_runtime_projections_select on public.subject_runtime_projections;
create policy subject_runtime_projections_select on public.subject_runtime_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_runtime_projections_upsert on public.subject_runtime_projections;
create policy subject_runtime_projections_upsert on public.subject_runtime_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
)
with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists study_execution_projections_select on public.study_execution_projections;
create policy study_execution_projections_select on public.study_execution_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists study_execution_projections_upsert on public.study_execution_projections;
create policy study_execution_projections_upsert on public.study_execution_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
)
with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists runtime_projection_refresh_log_select on public.runtime_projection_refresh_log;
create policy runtime_projection_refresh_log_select on public.runtime_projection_refresh_log
for select using (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists runtime_projection_refresh_log_insert on public.runtime_projection_refresh_log;
create policy runtime_projection_refresh_log_insert on public.runtime_projection_refresh_log
for insert with check (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);
