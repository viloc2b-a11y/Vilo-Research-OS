-- Phase 16 — GOV-1: Workflow decision authority matrix + conditional escalation schema.
-- Static classification v1; condition evaluation and runtime escalation are out of scope.
-- Core principle: AI never modifies truth layers directly.

-- ---------------------------------------------------------------------------
-- workflow_decision_authorities
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_decision_authorities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  workflow_key text not null,
  category text not null,
  base_authority_level text not null check (
    base_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  ai_allowed boolean not null default false,
  human_confirmation_required boolean not null default false,
  system_blocking boolean not null default false,
  regulated boolean not null default false,
  phi_sensitive boolean not null default false,
  audit_required boolean not null default true,
  conditional_escalation_supported boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_decision_authorities_notes_non_phi_chk check (
    notes is null
    or (
      notes !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
    )
  )
);

create unique index if not exists workflow_decision_authorities_global_workflow_key_uidx
  on public.workflow_decision_authorities (workflow_key)
  where organization_id is null;

create unique index if not exists workflow_decision_authorities_org_workflow_key_uidx
  on public.workflow_decision_authorities (organization_id, workflow_key)
  where organization_id is not null;

create index if not exists workflow_decision_authorities_organization_id_idx
  on public.workflow_decision_authorities (organization_id);

create index if not exists workflow_decision_authorities_workflow_key_idx
  on public.workflow_decision_authorities (workflow_key);

create index if not exists workflow_decision_authorities_active_idx
  on public.workflow_decision_authorities (workflow_key, active)
  where active = true;

comment on table public.workflow_decision_authorities is
  'GOV-1: per-workflow authority classification. organization_id IS NULL = global default; org row overrides global.';

comment on column public.workflow_decision_authorities.organization_id is
  'NULL = platform global default; non-null = org-specific override.';

drop trigger if exists workflow_decision_authorities_set_updated_at on public.workflow_decision_authorities;
create trigger workflow_decision_authorities_set_updated_at
before update on public.workflow_decision_authorities
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- workflow_authority_escalation_rules
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_authority_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  workflow_key text not null,
  rule_key text not null,
  condition_type text not null check (
    condition_type in (
      'protocol_runtime_rule',
      'lab_result_rule',
      'safety_signal',
      'signature_state',
      'eligibility_state',
      'blinding_risk',
      'source_state',
      'financial_audit_state'
    )
  ),
  condition_expression jsonb not null,
  from_authority_level text not null check (
    from_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  to_authority_level text not null check (
    to_authority_level in ('assistive', 'human_required', 'system_enforced')
  ),
  requires_human_confirmation boolean not null default true,
  system_blocking boolean not null default false,
  regulated boolean not null default true,
  audit_required boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_authority_escalation_rules_notes_non_phi_chk check (
    notes is null
    or (
      notes !~* '(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)'
    )
  )
);

create unique index if not exists workflow_authority_escalation_rules_global_rule_uidx
  on public.workflow_authority_escalation_rules (workflow_key, rule_key)
  where organization_id is null;

create unique index if not exists workflow_authority_escalation_rules_org_rule_uidx
  on public.workflow_authority_escalation_rules (organization_id, workflow_key, rule_key)
  where organization_id is not null;

create index if not exists workflow_authority_escalation_rules_organization_id_idx
  on public.workflow_authority_escalation_rules (organization_id);

create index if not exists workflow_authority_escalation_rules_workflow_key_idx
  on public.workflow_authority_escalation_rules (workflow_key);

create index if not exists workflow_authority_escalation_rules_active_idx
  on public.workflow_authority_escalation_rules (workflow_key, active)
  where active = true;

comment on table public.workflow_authority_escalation_rules is
  'GOV-1: conditional escalation rules (schema v2 readiness; evaluator not implemented in v1).';

comment on column public.workflow_authority_escalation_rules.condition_expression is
  'Structured predicate JSON — non-PHI field references only; evaluated in a future phase.';

drop trigger if exists workflow_authority_escalation_rules_set_updated_at on public.workflow_authority_escalation_rules;
create trigger workflow_authority_escalation_rules_set_updated_at
before update on public.workflow_authority_escalation_rules
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workflow_decision_authorities enable row level security;
alter table public.workflow_authority_escalation_rules enable row level security;

drop policy if exists workflow_decision_authorities_select on public.workflow_decision_authorities;
create policy workflow_decision_authorities_select on public.workflow_decision_authorities
for select using (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists workflow_decision_authorities_insert on public.workflow_decision_authorities;
create policy workflow_decision_authorities_insert on public.workflow_decision_authorities
for insert with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists workflow_decision_authorities_update on public.workflow_decision_authorities;
create policy workflow_decision_authorities_update on public.workflow_decision_authorities
for update using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists workflow_decision_authorities_delete on public.workflow_decision_authorities;
create policy workflow_decision_authorities_delete on public.workflow_decision_authorities
for delete using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists workflow_authority_escalation_rules_select on public.workflow_authority_escalation_rules;
create policy workflow_authority_escalation_rules_select on public.workflow_authority_escalation_rules
for select using (
  organization_id is null
  or organization_id in (select public.user_organization_ids())
);

drop policy if exists workflow_authority_escalation_rules_insert on public.workflow_authority_escalation_rules;
create policy workflow_authority_escalation_rules_insert on public.workflow_authority_escalation_rules
for insert with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists workflow_authority_escalation_rules_update on public.workflow_authority_escalation_rules;
create policy workflow_authority_escalation_rules_update on public.workflow_authority_escalation_rules
for update using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists workflow_authority_escalation_rules_delete on public.workflow_authority_escalation_rules;
create policy workflow_authority_escalation_rules_delete on public.workflow_authority_escalation_rules
for delete using (
  organization_id is not null
  and organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

revoke all on table public.workflow_decision_authorities from anon, public;
revoke all on table public.workflow_authority_escalation_rules from anon, public;
grant select, insert, update, delete on table public.workflow_decision_authorities to authenticated;
grant select, insert, update, delete on table public.workflow_authority_escalation_rules to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: global workflow_decision_authorities (organization_id IS NULL)
-- ---------------------------------------------------------------------------

insert into public.workflow_decision_authorities (
  organization_id,
  workflow_key,
  category,
  base_authority_level,
  ai_allowed,
  human_confirmation_required,
  system_blocking,
  regulated,
  phi_sensitive,
  audit_required,
  conditional_escalation_supported,
  notes
) values
  (
    null,
    'eligibility',
    'clinical',
    'human_required',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'randomization',
    'clinical',
    'system_enforced',
    false,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'source_signing',
    'clinical',
    'system_enforced',
    false,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'visit_locking',
    'clinical',
    'human_required',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'ae_workflow',
    'clinical_safety',
    'human_required',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'protocol_deviation',
    'clinical',
    'human_required',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'financial_reconciliation',
    'financial',
    'assistive',
    true,
    false,
    false,
    false,
    false,
    true,
    true,
    'escalation reserved for audit-triggered reconciliation disputes'
  ),
  (
    null,
    'query_management',
    'data_quality',
    'assistive',
    true,
    false,
    false,
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'scheduling',
    'operational',
    'assistive',
    true,
    false,
    false,
    false,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'lab_safety_escalation',
    'clinical_safety',
    'human_required',
    true,
    true,
    false,
    true,
    true,
    true,
    true,
    null
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seed: global workflow_authority_escalation_rules (organization_id IS NULL)
-- ---------------------------------------------------------------------------

insert into public.workflow_authority_escalation_rules (
  organization_id,
  workflow_key,
  rule_key,
  condition_type,
  condition_expression,
  from_authority_level,
  to_authority_level,
  requires_human_confirmation,
  system_blocking,
  regulated,
  audit_required,
  notes
) values
  (
    null,
    'lab_safety_escalation',
    'severe_thrombocytopenia_or_hit_signal',
    'lab_result_rule',
    '{
      "any": [
        { "field": "platelet_count", "operator": "<", "value": 150000 },
        { "field": "platelet_drop_from_baseline_percent", "operator": ">=", "value": 30 },
        { "field": "thrombosis_suspected_or_confirmed", "operator": "=", "value": true },
        { "field": "anti_pf4_result", "operator": "=", "value": "positive" },
        { "field": "four_t_score_risk", "operator": "in", "value": ["intermediate", "high"] }
      ]
    }'::jsonb,
    'human_required',
    'system_enforced',
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'eligibility',
    'unresolved_required_criterion',
    'eligibility_state',
    '{
      "any": [
        { "field": "required_criterion_status", "operator": "=", "value": "missing" },
        { "field": "required_criterion_status", "operator": "=", "value": "unresolved" },
        { "field": "required_evidence_status", "operator": "=", "value": "missing" }
      ]
    }'::jsonb,
    'human_required',
    'system_enforced',
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'source_signing',
    'missing_required_signature',
    'signature_state',
    '{
      "any": [
        { "field": "coordinator_signature_status", "operator": "!=", "value": "signed" },
        {
          "field": "investigator_signature_required",
          "operator": "=",
          "value": true,
          "and": [
            { "field": "investigator_signature_status", "operator": "!=", "value": "signed" }
          ]
        }
      ]
    }'::jsonb,
    'system_enforced',
    'system_enforced',
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'randomization',
    'missing_prerequisite_evidence',
    'protocol_runtime_rule',
    '{
      "any": [
        { "field": "informed_consent_status", "operator": "!=", "value": "signed" },
        { "field": "eligibility_status", "operator": "!=", "value": "confirmed" },
        { "field": "required_labs_prior_to_randomization", "operator": "!=", "value": "complete" },
        { "field": "protocol_required_diary_compliance", "operator": "!=", "value": "met" }
      ]
    }'::jsonb,
    'system_enforced',
    'system_enforced',
    true,
    true,
    true,
    true,
    null
  ),
  (
    null,
    'financial_reconciliation',
    'audit_triggered_dispute',
    'financial_audit_state',
    '{
      "any": [
        { "field": "contract_audit_active", "operator": "=", "value": true },
        { "field": "disputed_amount_status", "operator": "=", "value": "active" },
        { "field": "sponsor_dispute_open", "operator": "=", "value": true }
      ]
    }'::jsonb,
    'assistive',
    'human_required',
    true,
    false,
    false,
    true,
    null
  )
on conflict do nothing;
