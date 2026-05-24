-- Phase 16A-2 — OBS-1 runtime observability schema foundation.
-- Append-oriented traces/spans/telemetry; no runtime hooks or AI execution in this phase.
-- Authority fields align with GOV-1 WORKFLOW_AUTHORITY_LEVEL enums (no FK to workflow_decision_authorities).

-- ---------------------------------------------------------------------------
-- runtime_traces
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_traces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  workflow_key text,
  base_authority_level text,
  effective_authority_level text,
  trace_type text not null check (
    trace_type in (
      'workflow_execution',
      'coordinator_action',
      'automation_run',
      'replay_inspection',
      'governance_signal',
      'projection_refresh',
      'mutation_gateway'
    )
  ),
  status text not null check (
    status in ('started', 'in_progress', 'completed', 'failed', 'cancelled', 'degraded')
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  source_operational_event_id uuid references public.operational_events (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint runtime_traces_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint runtime_traces_workflow_key_gov1_chk check (
    workflow_key is null
    or workflow_key in (
      'eligibility',
      'randomization',
      'source_signing',
      'visit_locking',
      'ae_workflow',
      'protocol_deviation',
      'financial_reconciliation',
      'query_management',
      'scheduling',
      'lab_safety_escalation'
    )
  ),
  constraint runtime_traces_base_authority_level_chk check (
    base_authority_level is null
    or base_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  constraint runtime_traces_effective_authority_level_chk check (
    effective_authority_level is null
    or effective_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  constraint runtime_traces_authority_pair_chk check (
    effective_authority_level is null
    or base_authority_level is not null
  )
);

create index if not exists runtime_traces_organization_id_idx
  on public.runtime_traces (organization_id);

create index if not exists runtime_traces_study_id_idx
  on public.runtime_traces (study_id, started_at desc)
  where study_id is not null;

create index if not exists runtime_traces_visit_id_idx
  on public.runtime_traces (visit_id, started_at desc)
  where visit_id is not null;

create index if not exists runtime_traces_workflow_key_idx
  on public.runtime_traces (organization_id, workflow_key, started_at desc)
  where workflow_key is not null;

create index if not exists runtime_traces_status_idx
  on public.runtime_traces (organization_id, status, started_at desc);

create index if not exists runtime_traces_source_operational_event_id_idx
  on public.runtime_traces (source_operational_event_id)
  where source_operational_event_id is not null;

comment on table public.runtime_traces is
  'OBS-1: top-level runtime trace records. workflow_key + base/effective_authority_level per GOV-1/OBS-2 contract.';

comment on column public.runtime_traces.metadata is
  'Non-PHI diagnostic context only — redact before insert.';

comment on column public.runtime_traces.effective_authority_level is
  'GOV-1 enum only; requires base_authority_level when set. Never free-text labels.';

-- ---------------------------------------------------------------------------
-- execution_spans
-- ---------------------------------------------------------------------------

create table if not exists public.execution_spans (
  id uuid primary key default gen_random_uuid(),
  runtime_trace_id uuid references public.runtime_traces (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  span_type text not null check (
    span_type in (
      'orchestration',
      'projection_compute',
      'mutation_gateway',
      'capture',
      'automation_eval',
      'replay_segment',
      'governance_check',
      'financial_eval'
    )
  ),
  status text not null check (
    status in ('started', 'in_progress', 'completed', 'failed', 'cancelled', 'degraded')
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  dependency_refs jsonb not null default '[]'::jsonb,
  blocker_refs jsonb not null default '[]'::jsonb,
  warning_refs jsonb not null default '[]'::jsonb,
  ai_participation boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint execution_spans_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint execution_spans_dependency_refs_array_chk check (jsonb_typeof(dependency_refs) = 'array'),
  constraint execution_spans_blocker_refs_array_chk check (jsonb_typeof(blocker_refs) = 'array'),
  constraint execution_spans_warning_refs_array_chk check (jsonb_typeof(warning_refs) = 'array')
);

create index if not exists execution_spans_runtime_trace_id_idx
  on public.execution_spans (runtime_trace_id, started_at asc)
  where runtime_trace_id is not null;

create index if not exists execution_spans_organization_id_idx
  on public.execution_spans (organization_id);

create index if not exists execution_spans_study_id_idx
  on public.execution_spans (study_id, started_at desc)
  where study_id is not null;

create index if not exists execution_spans_visit_id_idx
  on public.execution_spans (visit_id, started_at desc)
  where visit_id is not null;

comment on table public.execution_spans is
  'OBS-1: nested execution spans under runtime_traces (or standalone when trace_id null).';

comment on column public.execution_spans.dependency_refs is
  'JSON array of non-PHI dependency reference objects.';

-- ---------------------------------------------------------------------------
-- workflow_telemetry_events
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  runtime_trace_id uuid references public.runtime_traces (id) on delete set null,
  workflow_key text,
  telemetry_type text not null check (
    telemetry_type in (
      'trace_opened',
      'trace_closed',
      'span_opened',
      'span_closed',
      'authority_resolved',
      'blocker_recorded',
      'warning_recorded',
      'automation_signal',
      'replay_marker',
      'governance_signal'
    )
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint workflow_telemetry_events_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint workflow_telemetry_events_workflow_key_gov1_chk check (
    workflow_key is null
    or workflow_key in (
      'eligibility',
      'randomization',
      'source_signing',
      'visit_locking',
      'ae_workflow',
      'protocol_deviation',
      'financial_reconciliation',
      'query_management',
      'scheduling',
      'lab_safety_escalation'
    )
  )
);

create index if not exists workflow_telemetry_events_organization_id_idx
  on public.workflow_telemetry_events (organization_id);

create index if not exists workflow_telemetry_events_runtime_trace_id_idx
  on public.workflow_telemetry_events (runtime_trace_id, created_at asc)
  where runtime_trace_id is not null;

create index if not exists workflow_telemetry_events_workflow_key_idx
  on public.workflow_telemetry_events (organization_id, workflow_key, created_at desc)
  where workflow_key is not null;

create index if not exists workflow_telemetry_events_telemetry_type_idx
  on public.workflow_telemetry_events (organization_id, telemetry_type, created_at desc);

comment on table public.workflow_telemetry_events is
  'OBS-1: point-in-time workflow telemetry (non-PHI metadata only).';

-- ---------------------------------------------------------------------------
-- RLS (org-scoped read; study-scoped read when study_id present)
-- ---------------------------------------------------------------------------

alter table public.runtime_traces enable row level security;
alter table public.execution_spans enable row level security;
alter table public.workflow_telemetry_events enable row level security;

drop policy if exists runtime_traces_select on public.runtime_traces;
create policy runtime_traces_select on public.runtime_traces
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists runtime_traces_insert on public.runtime_traces;
create policy runtime_traces_insert on public.runtime_traces
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists runtime_traces_update on public.runtime_traces;
create policy runtime_traces_update on public.runtime_traces
for update using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
) with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists execution_spans_select on public.execution_spans;
create policy execution_spans_select on public.execution_spans
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists execution_spans_insert on public.execution_spans;
create policy execution_spans_insert on public.execution_spans
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists execution_spans_update on public.execution_spans;
create policy execution_spans_update on public.execution_spans
for update using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
) with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists workflow_telemetry_events_select on public.workflow_telemetry_events;
create policy workflow_telemetry_events_select on public.workflow_telemetry_events
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists workflow_telemetry_events_insert on public.workflow_telemetry_events;
create policy workflow_telemetry_events_insert on public.workflow_telemetry_events
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

revoke all on table public.runtime_traces from anon, public;
revoke all on table public.execution_spans from anon, public;
revoke all on table public.workflow_telemetry_events from anon, public;
grant select, insert, update on table public.runtime_traces to authenticated;
grant select, insert, update on table public.execution_spans to authenticated;
grant select, insert on table public.workflow_telemetry_events to authenticated;
