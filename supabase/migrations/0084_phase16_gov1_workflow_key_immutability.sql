-- GOV-1 amendment: immutable workflow_key / rule_key / condition_expression.
-- Deprecate workflows with active=false — never rename keys referenced by runtime or replay.

comment on column public.workflow_decision_authorities.workflow_key is
  'Immutable once referenced by runtime projections, replay artifacts, or governance signals. Deprecate with active=false.';

comment on column public.workflow_authority_escalation_rules.workflow_key is
  'Immutable once referenced. Deprecate parent workflow or rule via active=false.';

comment on column public.workflow_authority_escalation_rules.rule_key is
  'Immutable once referenced. Insert a new rule row instead of renaming.';

comment on column public.workflow_authority_escalation_rules.condition_expression is
  'Immutable historical governance metadata once referenced by runtime traces or replay artifacts.';

-- ---------------------------------------------------------------------------
-- workflow_decision_authorities: workflow_key immutable on UPDATE
-- ---------------------------------------------------------------------------

create or replace function public.enforce_workflow_decision_authority_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.workflow_key is distinct from old.workflow_key then
    raise exception
      'workflow_key is immutable (was %, attempted %). Set active=false to deprecate.',
      old.workflow_key,
      new.workflow_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.enforce_workflow_decision_authority_immutability() is
  'GOV-1: block workflow_key renames; use active=false for deprecation.';

drop trigger if exists workflow_decision_authorities_immutability on public.workflow_decision_authorities;
create trigger workflow_decision_authorities_immutability
before update on public.workflow_decision_authorities
for each row execute function public.enforce_workflow_decision_authority_immutability();

-- ---------------------------------------------------------------------------
-- workflow_authority_escalation_rules: workflow_key, rule_key, condition_* immutable
-- ---------------------------------------------------------------------------

create or replace function public.enforce_workflow_escalation_rule_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.workflow_key is distinct from old.workflow_key then
      raise exception
        'workflow_key is immutable on escalation rules (was %, attempted %).',
        old.workflow_key,
        new.workflow_key
        using errcode = '23514';
    end if;
    if new.rule_key is distinct from old.rule_key then
      raise exception
        'rule_key is immutable (was %, attempted %). Insert a new rule instead.',
        old.rule_key,
        new.rule_key
        using errcode = '23514';
    end if;
    if new.condition_type is distinct from old.condition_type then
      raise exception
        'condition_type is immutable historical metadata for rule %.',
        old.rule_key
        using errcode = '23514';
    end if;
    if new.condition_expression is distinct from old.condition_expression then
      raise exception
        'condition_expression is immutable once stored for rule %. Insert a new rule row.',
        old.rule_key
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_workflow_escalation_rule_immutability() is
  'GOV-1: block renames and condition_expression edits; append-only rule history.';

drop trigger if exists workflow_authority_escalation_rules_immutability on public.workflow_authority_escalation_rules;
create trigger workflow_authority_escalation_rules_immutability
before update on public.workflow_authority_escalation_rules
for each row execute function public.enforce_workflow_escalation_rule_immutability();
