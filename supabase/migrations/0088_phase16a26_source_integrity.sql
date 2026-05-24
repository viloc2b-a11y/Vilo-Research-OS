-- Phase 16A-2.6 Steps 2–4 — Source integrity snapshots, workflow abandonment, role conflicts.
-- Explicit runtime helpers only — NO auto_snapshot triggers on source_responses.

-- ---------------------------------------------------------------------------
-- Immutability guard (snapshots only)
-- ---------------------------------------------------------------------------

create or replace function public.block_source_snapshot_updates()
returns trigger
language plpgsql
as $$
begin
  raise exception 'source_response_field_snapshots are immutable';
end;
$$;

revoke all on function public.block_source_snapshot_updates() from public;
grant execute on function public.block_source_snapshot_updates() to authenticated;

-- ---------------------------------------------------------------------------
-- source_response_field_snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.source_response_field_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  source_response_set_id uuid not null references public.source_response_sets (id) on delete cascade,
  source_response_id uuid not null references public.source_responses (id) on delete cascade,
  field_key text not null,
  field_value_hash text not null,
  snapshot_type text not null check (
    snapshot_type in ('submit', 'sign', 'lock', 'monitoring_review')
  ),
  snapshot_version integer not null default 1 check (snapshot_version > 0),
  captured_by uuid not null references auth.users (id) on delete restrict,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint source_response_field_snapshots_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint source_response_field_snapshots_metadata_non_phi_chk check (
    metadata::text !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  ),
  constraint source_response_field_snapshots_field_key_chk check (
    field_key ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint source_response_field_snapshots_hash_format_chk check (
    field_value_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint source_response_field_snapshots_unique_version_uidx unique (
    source_response_id,
    field_key,
    snapshot_type,
    snapshot_version
  )
);

create index if not exists source_response_field_snapshots_org_captured_idx
  on public.source_response_field_snapshots (organization_id, captured_at desc);

create index if not exists source_response_field_snapshots_response_set_idx
  on public.source_response_field_snapshots (source_response_set_id, snapshot_type, snapshot_version desc);

create index if not exists source_response_field_snapshots_response_field_idx
  on public.source_response_field_snapshots (source_response_id, field_key, snapshot_type);

comment on table public.source_response_field_snapshots is
  'Pilot audit: SHA256 hashes of normalized field values — never raw PHI values. Immutable after insert.';

drop trigger if exists block_source_snapshot_updates on public.source_response_field_snapshots;
create trigger block_source_snapshot_updates
before update or delete on public.source_response_field_snapshots
for each row execute function public.block_source_snapshot_updates();

-- ---------------------------------------------------------------------------
-- workflow_activity_checkpoints
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_activity_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  workflow_key text not null check (
    workflow_key in (
      'eligibility',
      'randomization',
      'source_signing',
      'visit_locking',
      'ae_workflow',
      'protocol_deviation',
      'financial_reconciliation',
      'query_management',
      'scheduling',
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  ),
  last_active_at timestamptz not null default now(),
  last_actor_id uuid references auth.users (id) on delete set null,
  completion_percent numeric,
  stale_threshold_hours integer not null default 24,
  stale_alert_sent_at timestamptz,
  stale_escalated_at timestamptz,
  status text not null default 'active' check (
    status in ('active', 'completed', 'stale', 'escalated')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_activity_checkpoints_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint workflow_activity_checkpoints_metadata_non_phi_chk check (
    metadata::text !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  )
);

create index if not exists workflow_activity_checkpoints_org_status_idx
  on public.workflow_activity_checkpoints (organization_id, status, last_active_at desc);

create unique index if not exists workflow_activity_checkpoints_scope_uidx
  on public.workflow_activity_checkpoints (
    organization_id,
    workflow_key,
    coalesce(study_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(study_subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(visit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(procedure_execution_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

drop trigger if exists workflow_activity_checkpoints_set_updated_at on public.workflow_activity_checkpoints;
create trigger workflow_activity_checkpoints_set_updated_at
before update on public.workflow_activity_checkpoints
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- workflow_stale_events
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_stale_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_checkpoint_id uuid not null references public.workflow_activity_checkpoints (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  workflow_key text not null,
  stale_age_hours numeric not null,
  threshold_hours integer not null,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workflow_stale_events_checkpoint_idx
  on public.workflow_stale_events (workflow_checkpoint_id, created_at desc);

-- ---------------------------------------------------------------------------
-- role_conflict_policies
-- ---------------------------------------------------------------------------

create table if not exists public.role_conflict_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  workflow_key text not null check (
    workflow_key in (
      'eligibility',
      'randomization',
      'source_signing',
      'visit_locking',
      'ae_workflow',
      'protocol_deviation',
      'financial_reconciliation',
      'query_management',
      'scheduling',
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  ),
  conflict_type text not null check (
    conflict_type in ('self_review', 'self_sign', 'dual_role_violation')
  ),
  resolution text not null check (
    resolution in ('blocked', 'allowed_with_justification', 'escalated')
  ),
  justification_required boolean not null default true,
  regulated boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_conflict_policies_notes_non_phi_chk check (
    notes is null
    or notes !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  )
);

create unique index if not exists role_conflict_policies_global_uidx
  on public.role_conflict_policies (workflow_key, conflict_type)
  where organization_id is null;

create unique index if not exists role_conflict_policies_org_uidx
  on public.role_conflict_policies (organization_id, workflow_key, conflict_type)
  where organization_id is not null;

drop trigger if exists role_conflict_policies_set_updated_at on public.role_conflict_policies;
create trigger role_conflict_policies_set_updated_at
before update on public.role_conflict_policies
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- role_conflict_events
-- ---------------------------------------------------------------------------

create table if not exists public.role_conflict_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  workflow_key text not null,
  action_attempted text not null,
  conflicting_role text,
  conflict_type text not null,
  resolution text not null,
  justification text,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint role_conflict_events_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint role_conflict_events_metadata_non_phi_chk check (
    metadata::text !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  ),
  constraint role_conflict_events_justification_non_phi_chk check (
    justification is null
    or justification !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  )
);

create index if not exists role_conflict_events_organization_id_idx
  on public.role_conflict_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.source_response_field_snapshots enable row level security;
alter table public.workflow_activity_checkpoints enable row level security;
alter table public.workflow_stale_events enable row level security;
alter table public.role_conflict_policies enable row level security;
alter table public.role_conflict_events enable row level security;

drop policy if exists source_response_field_snapshots_select on public.source_response_field_snapshots;
create policy source_response_field_snapshots_select on public.source_response_field_snapshots
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists source_response_field_snapshots_insert on public.source_response_field_snapshots;
create policy source_response_field_snapshots_insert on public.source_response_field_snapshots
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists workflow_activity_checkpoints_select on public.workflow_activity_checkpoints;
create policy workflow_activity_checkpoints_select on public.workflow_activity_checkpoints
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists workflow_activity_checkpoints_insert on public.workflow_activity_checkpoints;
create policy workflow_activity_checkpoints_insert on public.workflow_activity_checkpoints
for insert with check (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists workflow_activity_checkpoints_update on public.workflow_activity_checkpoints;
create policy workflow_activity_checkpoints_update on public.workflow_activity_checkpoints
for update using (
  organization_id in (select public.user_organization_ids())
) with check (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists workflow_stale_events_select on public.workflow_stale_events;
create policy workflow_stale_events_select on public.workflow_stale_events
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists workflow_stale_events_insert on public.workflow_stale_events;
create policy workflow_stale_events_insert on public.workflow_stale_events
for insert with check (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists role_conflict_policies_select on public.role_conflict_policies;
create policy role_conflict_policies_select on public.role_conflict_policies
for select using (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists role_conflict_policies_insert on public.role_conflict_policies;
create policy role_conflict_policies_insert on public.role_conflict_policies
for insert with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists role_conflict_policies_update on public.role_conflict_policies;
create policy role_conflict_policies_update on public.role_conflict_policies
for update using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists role_conflict_events_select on public.role_conflict_events;
create policy role_conflict_events_select on public.role_conflict_events
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists role_conflict_events_insert on public.role_conflict_events;
create policy role_conflict_events_insert on public.role_conflict_events
for insert with check (
  organization_id in (select public.user_organization_ids())
);

revoke all on table public.source_response_field_snapshots from anon, public;
revoke all on table public.workflow_activity_checkpoints from anon, public;
revoke all on table public.workflow_stale_events from anon, public;
revoke all on table public.role_conflict_policies from anon, public;
revoke all on table public.role_conflict_events from anon, public;

grant select, insert on table public.source_response_field_snapshots to authenticated;
grant select, insert, update on table public.workflow_activity_checkpoints to authenticated;
grant select, insert on table public.workflow_stale_events to authenticated;
grant select, insert, update on table public.role_conflict_policies to authenticated;
grant select, insert on table public.role_conflict_events to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: global role_conflict_policies
-- ---------------------------------------------------------------------------

insert into public.role_conflict_policies (
  organization_id,
  workflow_key,
  conflict_type,
  resolution,
  justification_required,
  regulated,
  active,
  notes
)
select v.organization_id, v.workflow_key, v.conflict_type, v.resolution, v.justification_required, v.regulated, v.active, v.notes
from (
  values
    (null::uuid, 'source_signing'::text, 'self_sign'::text, 'blocked'::text, true, true, true, null::text),
    (null::uuid, 'source_signing'::text, 'self_review'::text, 'allowed_with_justification'::text, true, true, true, null::text),
    (null::uuid, 'query_management'::text, 'self_review'::text, 'allowed_with_justification'::text, true, true, true, null::text),
    (null::uuid, 'protocol_deviation'::text, 'self_review'::text, 'escalated'::text, true, true, true, null::text),
    (null::uuid, 'ae_workflow'::text, 'self_review'::text, 'escalated'::text, true, true, true, null::text)
) as v(organization_id, workflow_key, conflict_type, resolution, justification_required, regulated, active, notes)
where not exists (
  select 1
  from public.role_conflict_policies p
  where p.organization_id is null
    and p.workflow_key = v.workflow_key
    and p.conflict_type = v.conflict_type
);
