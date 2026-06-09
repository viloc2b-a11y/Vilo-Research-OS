-- Phase P3: Reconciled Protocol → Study Runtime Generation
-- Connects protocol intake + reconciliation to study runtime composition (no duplicate runtime tables).

-- ---------------------------------------------------------------------------
-- protocol_runtime_generation_runs
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_generation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  protocol_runtime_study_id uuid not null references public.protocol_runtime_studies (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  generation_status text not null default 'draft',
  generated_runtime_snapshot_id uuid null references public.study_runtime_composition_snapshots (id) on delete set null,
  generated_by uuid not null references auth.users (id) on delete restrict,
  generated_at timestamptz null,
  source_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_runtime_generation_runs_status_check check (
    generation_status in ('draft', 'validated', 'generated', 'failed', 'cancelled')
  )
);

create index if not exists protocol_runtime_generation_runs_org_idx
  on public.protocol_runtime_generation_runs (organization_id);
create index if not exists protocol_runtime_generation_runs_version_idx
  on public.protocol_runtime_generation_runs (protocol_version_id);
create index if not exists protocol_runtime_generation_runs_runtime_study_idx
  on public.protocol_runtime_generation_runs (protocol_runtime_study_id);
create index if not exists protocol_runtime_generation_runs_study_idx
  on public.protocol_runtime_generation_runs (study_id);
create index if not exists protocol_runtime_generation_runs_status_idx
  on public.protocol_runtime_generation_runs (generation_status);
create index if not exists protocol_runtime_generation_runs_snapshot_idx
  on public.protocol_runtime_generation_runs (generated_runtime_snapshot_id);

drop trigger if exists protocol_runtime_generation_runs_set_updated_at on public.protocol_runtime_generation_runs;
create trigger protocol_runtime_generation_runs_set_updated_at
before update on public.protocol_runtime_generation_runs
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- protocol_runtime_generation_events (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_generation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  generation_run_id uuid not null references public.protocol_runtime_generation_runs (id) on delete cascade,
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  event_type text not null,
  actor_id uuid null references auth.users (id) on delete set null,
  event_timestamp timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  state_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint protocol_runtime_generation_events_type_check check (
    event_type in (
      'generation_validated',
      'generation_failed',
      'runtime_visits_created',
      'study_blueprints_assigned',
      'visit_procedures_created',
      'runtime_graph_compiled',
      'generation_completed',
      'generation_cancelled'
    )
  )
);

create index if not exists protocol_runtime_generation_events_org_idx
  on public.protocol_runtime_generation_events (organization_id);
create index if not exists protocol_runtime_generation_events_run_idx
  on public.protocol_runtime_generation_events (generation_run_id);
create index if not exists protocol_runtime_generation_events_version_idx
  on public.protocol_runtime_generation_events (protocol_version_id);
create index if not exists protocol_runtime_generation_events_timestamp_idx
  on public.protocol_runtime_generation_events (event_timestamp);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.protocol_runtime_generation_runs enable row level security;
alter table public.protocol_runtime_generation_events enable row level security;

drop policy if exists protocol_runtime_generation_runs_select on public.protocol_runtime_generation_runs;
create policy protocol_runtime_generation_runs_select on public.protocol_runtime_generation_runs
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists protocol_runtime_generation_runs_insert on public.protocol_runtime_generation_runs;
create policy protocol_runtime_generation_runs_insert on public.protocol_runtime_generation_runs
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists protocol_runtime_generation_runs_update on public.protocol_runtime_generation_runs;
create policy protocol_runtime_generation_runs_update on public.protocol_runtime_generation_runs
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists protocol_runtime_generation_events_select on public.protocol_runtime_generation_events;
create policy protocol_runtime_generation_events_select on public.protocol_runtime_generation_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_generation_runs prgr
      where prgr.id = generation_run_id
        and prgr.organization_id = organization_id
        and public.user_has_study_access(prgr.study_id)
    )
  );

drop policy if exists protocol_runtime_generation_events_insert on public.protocol_runtime_generation_events;
create policy protocol_runtime_generation_events_insert on public.protocol_runtime_generation_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_generation_runs prgr
      where prgr.id = generation_run_id
        and prgr.organization_id = organization_id
        and public.user_has_study_access(prgr.study_id)
    )
  );

