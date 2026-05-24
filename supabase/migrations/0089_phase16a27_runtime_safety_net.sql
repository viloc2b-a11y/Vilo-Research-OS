-- Phase 16A-2.7 — Pilot runtime safety net (schema prep, snapshot versioning RPC, pilot feedback).

-- ---------------------------------------------------------------------------
-- 1A. Snapshot version integrity (verify; safe ALTER only if drift)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'source_response_field_snapshots'
      and column_name = 'snapshot_version'
  ) then
    alter table public.source_response_field_snapshots
      add column snapshot_version integer not null default 1 check (snapshot_version > 0);
  end if;
end
$$;

comment on column public.source_response_field_snapshots.snapshot_version is
  'Monotonic per (source_response_id, field_key, snapshot_type). Each unlock/relock cycle intentionally produces a new immutable snapshot version for audit continuity.';

-- Atomic version allocation (SELECT MAX + 1 in one transaction; no ON CONFLICT).
create or replace function public.allocate_source_field_snapshot_version(
  p_source_response_id uuid,
  p_field_key text,
  p_snapshot_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_source_response_id::text || ':' || p_field_key || ':' || p_snapshot_type)
  );

  select coalesce(max(snapshot_version), 0) + 1
  into v_next
  from public.source_response_field_snapshots
  where source_response_id = p_source_response_id
    and field_key = p_field_key
    and snapshot_type = p_snapshot_type;

  return v_next;
end;
$$;

revoke all on function public.allocate_source_field_snapshot_version(uuid, text, text) from public;
grant execute on function public.allocate_source_field_snapshot_version(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1B. Consent version tracking preparation
-- ---------------------------------------------------------------------------

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version_label text not null,
  study_id uuid not null references public.studies (id) on delete cascade,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.document_versions is
  'Stub for future consent version tracking. Full implementation deferred to future phase.';

create index if not exists document_versions_study_type_idx
  on public.document_versions (study_id, document_type);

alter table public.study_subjects
  add column if not exists consent_version_id uuid references public.document_versions (id) on delete set null;

alter table public.study_subjects
  add column if not exists consent_signed_at timestamptz;

comment on column public.study_subjects.consent_version_id is
  'Stub for future consent version tracking. Full implementation deferred to future phase.';

-- ---------------------------------------------------------------------------
-- 1C. SAE timeline preparation (subject_adverse_events)
-- ---------------------------------------------------------------------------

alter table public.subject_adverse_events
  add column if not exists sae_onset_at timestamptz;

alter table public.subject_adverse_events
  add column if not exists initial_notification_due_at timestamptz;

alter table public.subject_adverse_events
  add column if not exists followup_due_at timestamptz;

alter table public.subject_adverse_events
  add column if not exists narrative_due_at timestamptz;

comment on column public.subject_adverse_events.sae_onset_at is
  'SAE timeline prep. GCP/ICH E6(R3) default windows. Protocol-specific overrides deferred.';

-- ---------------------------------------------------------------------------
-- 1D. Workflow stale detection index
-- ---------------------------------------------------------------------------

create index if not exists workflow_activity_checkpoints_stale_detection_idx
  on public.workflow_activity_checkpoints (last_active_at)
  where status in ('active', 'stale');

-- ---------------------------------------------------------------------------
-- Temporal consistency: pending evaluation result
-- ---------------------------------------------------------------------------

alter table public.temporal_consistency_evaluations
  drop constraint if exists temporal_consistency_evaluations_evaluation_result_check;

alter table public.temporal_consistency_evaluations
  add constraint temporal_consistency_evaluations_evaluation_result_check check (
    evaluation_result in ('pass', 'fail', 'warning', 'not_applicable', 'blocked', 'pending')
  );

-- ---------------------------------------------------------------------------
-- Pilot feedback (append-only)
-- ---------------------------------------------------------------------------

create or replace function public.block_pilot_feedback_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pilot_feedback is append-only';
end;
$$;

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  current_url text not null,
  feedback_text text not null,
  runtime_context jsonb,
  created_at timestamptz not null default now(),
  constraint pilot_feedback_runtime_context_non_phi_chk check (
    runtime_context is null
    or runtime_context::text !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_|patient_name|subject_name)'
  )
);

comment on table public.pilot_feedback is
  'Internal pilot feedback intake only. Append-only; no coordinator UI in this phase.';

drop trigger if exists block_pilot_feedback_mutation on public.pilot_feedback;
create trigger block_pilot_feedback_mutation
before update or delete on public.pilot_feedback
for each row execute function public.block_pilot_feedback_mutation();

create index if not exists pilot_feedback_organization_id_idx
  on public.pilot_feedback (organization_id, created_at desc);

alter table public.pilot_feedback enable row level security;

drop policy if exists pilot_feedback_select on public.pilot_feedback;
create policy pilot_feedback_select on public.pilot_feedback
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists pilot_feedback_insert on public.pilot_feedback;
create policy pilot_feedback_insert on public.pilot_feedback
for insert with check (
  organization_id in (select public.user_organization_ids())
  and actor_id = auth.uid()
);

revoke all on table public.pilot_feedback from anon, public;
grant select, insert on table public.pilot_feedback to authenticated;

alter table public.document_versions enable row level security;

drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select on public.document_versions
for select using (
  study_id in (
    select sm.study_id from public.study_members sm where sm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.studies s
    where s.id = study_id
      and public.user_is_org_admin(s.organization_id)
  )
);
