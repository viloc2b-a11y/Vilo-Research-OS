-- Phase 16A-2.5 — Pilot compliance guardrails (temporal consistency, break-glass, delegation checks).
-- Foundations only — no UI, no automatic runtime blocking, no full condition engine.

-- ---------------------------------------------------------------------------
-- temporal_consistency_rules
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_consistency_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  rule_key text not null,
  scope text not null check (scope in ('global', 'study_version')),
  study_version_id uuid references public.study_versions (id) on delete cascade,
  event_a_type text not null,
  event_a_field text not null,
  event_b_type text not null,
  event_b_field text not null,
  constraint_type text not null check (
    constraint_type in (
      'a_before_b',
      'a_before_or_equal_b',
      'a_after_b',
      'a_after_or_equal_b',
      'a_within_window_of_b',
      'a_not_before_b',
      'a_not_after_b'
    )
  ),
  window_hours integer,
  severity text not null check (severity in ('info', 'warning', 'blocker')),
  workflow_key text,
  regulated boolean not null default true,
  audit_required boolean not null default true,
  system_blocking boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temporal_consistency_rules_scope_chk check (
    (scope = 'global' and study_version_id is null)
    or (scope = 'study_version' and study_version_id is not null)
  ),
  constraint temporal_consistency_rules_window_chk check (
    constraint_type <> 'a_within_window_of_b'
    or window_hours is not null
  ),
  constraint temporal_consistency_rules_workflow_key_chk check (
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
  constraint temporal_consistency_rules_notes_non_phi_chk check (
    notes is null
    or notes !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  )
);

create unique index if not exists temporal_consistency_rules_global_rule_key_uidx
  on public.temporal_consistency_rules (rule_key)
  where organization_id is null and scope = 'global';

create unique index if not exists temporal_consistency_rules_study_version_rule_key_uidx
  on public.temporal_consistency_rules (organization_id, study_version_id, rule_key)
  where scope = 'study_version' and study_version_id is not null;

create index if not exists temporal_consistency_rules_organization_id_idx
  on public.temporal_consistency_rules (organization_id);

create index if not exists temporal_consistency_rules_active_idx
  on public.temporal_consistency_rules (rule_key, active)
  where active = true;

comment on table public.temporal_consistency_rules is
  'Pilot guardrail: temporal ordering rules. organization_id IS NULL = global default. rule_key is immutable.';

comment on column public.temporal_consistency_rules.rule_key is
  'Immutable once created; deprecate with active=false.';

drop trigger if exists temporal_consistency_rules_set_updated_at on public.temporal_consistency_rules;
create trigger temporal_consistency_rules_set_updated_at
before update on public.temporal_consistency_rules
for each row execute function public.generic_set_updated_at();

create or replace function public.enforce_temporal_consistency_rule_key_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.rule_key is distinct from old.rule_key then
    raise exception
      'rule_key is immutable (was %, attempted %). Set active=false to deprecate.',
      old.rule_key,
      new.rule_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists temporal_consistency_rules_immutability on public.temporal_consistency_rules;
create trigger temporal_consistency_rules_immutability
before update on public.temporal_consistency_rules
for each row execute function public.enforce_temporal_consistency_rule_key_immutability();

-- ---------------------------------------------------------------------------
-- temporal_consistency_evaluations (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_consistency_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_version_id uuid references public.study_versions (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  rule_id uuid references public.temporal_consistency_rules (id) on delete set null,
  rule_key text not null,
  evaluation_result text not null check (
    evaluation_result in ('pass', 'fail', 'warning', 'not_applicable', 'blocked')
  ),
  severity text not null check (severity in ('info', 'warning', 'blocker')),
  event_a_value timestamptz,
  event_b_value timestamptz,
  evidence_refs jsonb not null default '{}'::jsonb,
  source_operational_event_id uuid references public.operational_events (id) on delete set null,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint temporal_consistency_evaluations_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint temporal_consistency_evaluations_evidence_object_chk check (jsonb_typeof(evidence_refs) = 'object')
);

create index if not exists temporal_consistency_evaluations_organization_id_idx
  on public.temporal_consistency_evaluations (organization_id, evaluated_at desc);

create index if not exists temporal_consistency_evaluations_rule_key_idx
  on public.temporal_consistency_evaluations (organization_id, rule_key, evaluated_at desc);

create index if not exists temporal_consistency_evaluations_subject_idx
  on public.temporal_consistency_evaluations (study_subject_id, evaluated_at desc)
  where study_subject_id is not null;

comment on table public.temporal_consistency_evaluations is
  'Append-only temporal rule evaluation audit records (non-PHI metadata).';

-- ---------------------------------------------------------------------------
-- break_glass_access_events
-- ---------------------------------------------------------------------------

create table if not exists public.break_glass_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
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
      'lab_safety_escalation'
    )
  ),
  base_authority_level text check (
    base_authority_level is null
    or base_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  effective_authority_level text check (
    effective_authority_level is null
    or effective_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  access_scope text not null,
  resource_type text not null,
  resource_id uuid,
  justification text not null,
  approval_mode text not null check (approval_mode in ('self_granted', 'dual_confirmed')),
  approved_by uuid references auth.users (id) on delete set null,
  notified_user_ids jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (
    status in ('active', 'expired', 'reviewed', 'rejected')
  ),
  expires_at timestamptz not null,
  closed_at timestamptz,
  post_review_required boolean not null default true,
  post_review_completed_at timestamptz,
  review_notes text,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint break_glass_notified_user_ids_array_chk check (jsonb_typeof(notified_user_ids) = 'array'),
  constraint break_glass_justification_non_phi_chk check (
    justification !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  ),
  constraint break_glass_effective_authority_pair_chk check (
    effective_authority_level is null
    or base_authority_level is not null
  )
);

create index if not exists break_glass_access_events_organization_id_idx
  on public.break_glass_access_events (organization_id, created_at desc);

create index if not exists break_glass_access_events_actor_idx
  on public.break_glass_access_events (actor_user_id, status);

comment on table public.break_glass_access_events is
  'Break-glass access requests (v0: self_granted only at API layer; schema ready for dual_confirmed).';

-- ---------------------------------------------------------------------------
-- procedure_delegation_requirements
-- ---------------------------------------------------------------------------

create table if not exists public.procedure_delegation_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete set null,
  procedure_key text not null,
  workflow_key text,
  requires_delegation boolean not null default false,
  requires_pi_delegation boolean not null default false,
  regulated boolean not null default true,
  blocking_if_missing boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedure_delegation_requirements_workflow_key_chk check (
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
  constraint procedure_delegation_requirements_notes_non_phi_chk check (
    notes is null
    or notes !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
  )
);

create unique index if not exists procedure_delegation_requirements_global_procedure_key_uidx
  on public.procedure_delegation_requirements (procedure_key)
  where organization_id is null and study_id is null;

create unique index if not exists procedure_delegation_requirements_study_procedure_key_uidx
  on public.procedure_delegation_requirements (organization_id, study_id, procedure_key)
  where study_id is not null;

create index if not exists procedure_delegation_requirements_active_idx
  on public.procedure_delegation_requirements (procedure_key, active)
  where active = true;

comment on column public.procedure_delegation_requirements.procedure_key is
  'Immutable once created; deprecate with active=false.';

drop trigger if exists procedure_delegation_requirements_set_updated_at on public.procedure_delegation_requirements;
create trigger procedure_delegation_requirements_set_updated_at
before update on public.procedure_delegation_requirements
for each row execute function public.generic_set_updated_at();

create or replace function public.enforce_procedure_delegation_procedure_key_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.procedure_key is distinct from old.procedure_key then
    raise exception
      'procedure_key is immutable (was %, attempted %). Set active=false to deprecate.',
      old.procedure_key,
      new.procedure_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_delegation_requirements_immutability on public.procedure_delegation_requirements;
create trigger procedure_delegation_requirements_immutability
before update on public.procedure_delegation_requirements
for each row execute function public.enforce_procedure_delegation_procedure_key_immutability();

-- ---------------------------------------------------------------------------
-- delegation_runtime_checks (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.delegation_runtime_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  study_version_id uuid references public.study_versions (id) on delete set null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  procedure_key text,
  workflow_key text,
  delegated boolean not null,
  check_result text not null check (check_result in ('delegated', 'not_delegated', 'unknown')),
  requires_delegation boolean not null default false,
  requires_pi_delegation boolean not null default false,
  regulated boolean not null default true,
  system_blocking boolean not null default false,
  evidence_refs jsonb not null default '{}'::jsonb,
  source_operational_event_id uuid references public.operational_events (id) on delete set null,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint delegation_runtime_checks_metadata_object_chk check (jsonb_typeof(metadata) = 'object'),
  constraint delegation_runtime_checks_evidence_object_chk check (jsonb_typeof(evidence_refs) = 'object'),
  constraint delegation_runtime_checks_workflow_key_chk check (
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

create index if not exists delegation_runtime_checks_organization_id_idx
  on public.delegation_runtime_checks (organization_id, checked_at desc);

create index if not exists delegation_runtime_checks_study_id_idx
  on public.delegation_runtime_checks (study_id, checked_at desc)
  where study_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.temporal_consistency_rules enable row level security;
alter table public.temporal_consistency_evaluations enable row level security;
alter table public.break_glass_access_events enable row level security;
alter table public.procedure_delegation_requirements enable row level security;
alter table public.delegation_runtime_checks enable row level security;

-- temporal_consistency_rules
drop policy if exists temporal_consistency_rules_select on public.temporal_consistency_rules;
create policy temporal_consistency_rules_select on public.temporal_consistency_rules
for select using (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists temporal_consistency_rules_insert on public.temporal_consistency_rules;
create policy temporal_consistency_rules_insert on public.temporal_consistency_rules
for insert with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists temporal_consistency_rules_update on public.temporal_consistency_rules;
create policy temporal_consistency_rules_update on public.temporal_consistency_rules
for update using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

-- temporal_consistency_evaluations (append-only: select + insert)
drop policy if exists temporal_consistency_evaluations_select on public.temporal_consistency_evaluations;
create policy temporal_consistency_evaluations_select on public.temporal_consistency_evaluations
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists temporal_consistency_evaluations_insert on public.temporal_consistency_evaluations;
create policy temporal_consistency_evaluations_insert on public.temporal_consistency_evaluations
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

-- break_glass_access_events
drop policy if exists break_glass_access_events_select on public.break_glass_access_events;
create policy break_glass_access_events_select on public.break_glass_access_events
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists break_glass_access_events_insert on public.break_glass_access_events;
create policy break_glass_access_events_insert on public.break_glass_access_events
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists break_glass_access_events_update on public.break_glass_access_events;
create policy break_glass_access_events_update on public.break_glass_access_events
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

-- procedure_delegation_requirements
drop policy if exists procedure_delegation_requirements_select on public.procedure_delegation_requirements;
create policy procedure_delegation_requirements_select on public.procedure_delegation_requirements
for select using (
  (organization_id is null and study_id is null)
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists procedure_delegation_requirements_insert on public.procedure_delegation_requirements;
create policy procedure_delegation_requirements_insert on public.procedure_delegation_requirements
for insert with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists procedure_delegation_requirements_update on public.procedure_delegation_requirements;
create policy procedure_delegation_requirements_update on public.procedure_delegation_requirements
for update using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

-- delegation_runtime_checks (append-only)
drop policy if exists delegation_runtime_checks_select on public.delegation_runtime_checks;
create policy delegation_runtime_checks_select on public.delegation_runtime_checks
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists delegation_runtime_checks_insert on public.delegation_runtime_checks;
create policy delegation_runtime_checks_insert on public.delegation_runtime_checks
for insert with check (
  organization_id in (select public.user_organization_ids())
  and (
    study_id is null
    or public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

revoke all on table public.temporal_consistency_rules from anon, public;
revoke all on table public.temporal_consistency_evaluations from anon, public;
revoke all on table public.break_glass_access_events from anon, public;
revoke all on table public.procedure_delegation_requirements from anon, public;
revoke all on table public.delegation_runtime_checks from anon, public;

grant select, insert, update on table public.temporal_consistency_rules to authenticated;
grant select, insert on table public.temporal_consistency_evaluations to authenticated;
grant select, insert, update on table public.break_glass_access_events to authenticated;
grant select, insert, update on table public.procedure_delegation_requirements to authenticated;
grant select, insert on table public.delegation_runtime_checks to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: global temporal_consistency_rules (organization_id IS NULL, scope=global)
-- IP-admin post-lab windows: study_version scoped only — not seeded globally.
-- ---------------------------------------------------------------------------

insert into public.temporal_consistency_rules (
  organization_id,
  rule_key,
  scope,
  study_version_id,
  event_a_type,
  event_a_field,
  event_b_type,
  event_b_field,
  constraint_type,
  window_hours,
  severity,
  workflow_key,
  regulated,
  audit_required,
  system_blocking,
  notes
) values
  (
    null,
    'consent_before_screening',
    'global',
    null,
    'consent',
    'consent_signed_at',
    'visit',
    'screening_started_at',
    'a_before_or_equal_b',
    null,
    'blocker',
    'eligibility',
    true,
    true,
    false,
    null
  ),
  (
    null,
    'screening_before_enrollment',
    'global',
    null,
    'visit',
    'screening_started_at',
    'subject',
    'enrolled_at',
    'a_before_or_equal_b',
    null,
    'blocker',
    'eligibility',
    true,
    true,
    false,
    null
  ),
  (
    null,
    'ae_onset_not_before_first_dose',
    'global',
    null,
    'adverse_event',
    'onset_at',
    'intervention',
    'first_dose_at',
    'a_after_or_equal_b',
    null,
    'warning',
    'ae_workflow',
    true,
    true,
    false,
    null
  ),
  (
    null,
    'lab_collection_before_lab_result',
    'global',
    null,
    'lab',
    'collected_at',
    'lab',
    'resulted_at',
    'a_before_or_equal_b',
    null,
    'blocker',
    'lab_safety_escalation',
    true,
    true,
    false,
    null
  ),
  (
    null,
    'source_signature_after_capture',
    'global',
    null,
    'source_signature',
    'signed_at',
    'source_capture',
    'captured_at',
    'a_after_or_equal_b',
    null,
    'blocker',
    'source_signing',
    true,
    true,
    false,
    null
  )
on conflict do nothing;
