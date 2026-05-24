-- Phase 16A-2.6 Step 1 — GOV-1 registry extension (audit integrity pilot workflows + escalation rules).

-- ---------------------------------------------------------------------------
-- Seed: workflow_decision_authorities (global)
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
)
select
  v.organization_id,
  v.workflow_key,
  v.category,
  v.base_authority_level,
  v.ai_allowed,
  v.human_confirmation_required,
  v.system_blocking,
  v.regulated,
  v.phi_sensitive,
  v.audit_required,
  v.conditional_escalation_supported,
  v.notes
from (
  values
    (
      null::uuid,
      'source_integrity_snapshot'::text,
      'data_quality'::text,
      'system_enforced'::text,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      'Routine hash snapshot at submit/sign/lock/monitoring_review. Non-blocking pilot audit snapshot workflow.'::text
    ),
    (
      null::uuid,
      'source_integrity_violation'::text,
      'data_quality'::text,
      'system_enforced'::text,
      false,
      false,
      false,
      true,
      true,
      true,
      false,
      'Triggered when stored hash does not match recalculated hash. Critical audit signal for pilot visibility. Not blocking during Phase 16A-2.6.'::text
    ),
    (
      null::uuid,
      'workflow_abandonment_review'::text,
      'operational'::text,
      'human_required'::text,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      'Generated when workflow is stale beyond threshold.'::text
    ),
    (
      null::uuid,
      'role_conflict_resolution'::text,
      'data_quality'::text,
      'human_required'::text,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'Blocking by default. Small-site exemption possible with documented justification.'::text
    )
) as v(
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
)
where not exists (
  select 1
  from public.workflow_decision_authorities wda
  where wda.organization_id is null
    and wda.workflow_key = v.workflow_key
);

-- ---------------------------------------------------------------------------
-- Seed: workflow_authority_escalation_rules (global)
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
)
select
  v.organization_id,
  v.workflow_key,
  v.rule_key,
  v.condition_type,
  v.condition_expression,
  v.from_authority_level,
  v.to_authority_level,
  v.requires_human_confirmation,
  v.system_blocking,
  v.regulated,
  v.audit_required,
  v.notes
from (
  values
    (
      null::uuid,
      'source_integrity_snapshot'::text,
      'hash_mismatch_detected'::text,
      'source_state'::text,
      '{"field":"stored_hash_matches_recalculated","operator":"=","value":false}'::jsonb,
      'system_enforced'::text,
      'system_enforced'::text,
      false,
      false,
      true,
      true,
      'Escalates to source_integrity_violation audit signal when hash mismatch detected.'::text
    ),
    (
      null::uuid,
      'workflow_abandonment_review'::text,
      'stale_workflow_unresolved_past_escalation_threshold'::text,
      'protocol_runtime_rule'::text,
      '{"field":"stale_age_hours","operator":">","value_ref":"escalation_threshold_hours"}'::jsonb,
      'human_required'::text,
      'human_required'::text,
      true,
      false,
      true,
      true,
      'Stale workflow unresolved past escalation threshold — human review required.'::text
    ),
    (
      null::uuid,
      'role_conflict_resolution'::text,
      'single_staff_site_exemption'::text,
      'protocol_runtime_rule'::text,
      '{"field":"site_active_staff_count","operator":"=","value":1}'::jsonb,
      'human_required'::text,
      'human_required'::text,
      true,
      false,
      true,
      true,
      'Small-site exemption: documented justification required; system_blocking relaxed.'::text
    )
) as v(
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
)
where not exists (
  select 1
  from public.workflow_authority_escalation_rules r
  where r.organization_id is null
    and r.workflow_key = v.workflow_key
    and r.rule_key = v.rule_key
);

-- ---------------------------------------------------------------------------
-- Widen GOV-1 workflow_key CHECK constraints (OBS + compliance tables)
-- ---------------------------------------------------------------------------

alter table public.runtime_traces
  drop constraint if exists runtime_traces_workflow_key_gov1_chk;

alter table public.runtime_traces
  add constraint runtime_traces_workflow_key_gov1_chk check (
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
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  );

alter table public.workflow_telemetry_events
  drop constraint if exists workflow_telemetry_events_workflow_key_gov1_chk;

alter table public.workflow_telemetry_events
  add constraint workflow_telemetry_events_workflow_key_gov1_chk check (
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
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  );

alter table public.temporal_consistency_rules
  drop constraint if exists temporal_consistency_rules_workflow_key_chk;

alter table public.temporal_consistency_rules
  add constraint temporal_consistency_rules_workflow_key_chk check (
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
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  );

alter table public.break_glass_access_events
  drop constraint if exists break_glass_access_events_workflow_key_check;

alter table public.break_glass_access_events
  add constraint break_glass_access_events_workflow_key_check check (
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
  );

alter table public.procedure_delegation_requirements
  drop constraint if exists procedure_delegation_requirements_workflow_key_chk;

alter table public.procedure_delegation_requirements
  add constraint procedure_delegation_requirements_workflow_key_chk check (
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
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  );

alter table public.delegation_runtime_checks
  drop constraint if exists delegation_runtime_checks_workflow_key_chk;

alter table public.delegation_runtime_checks
  add constraint delegation_runtime_checks_workflow_key_chk check (
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
      'lab_safety_escalation',
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  );
