-- Phase 4B: validation helpers for future db:validate-phase4b harness.
-- Dependencies: 0020–0024. Does not add capture RPCs; Phase 3C RPC bodies unchanged.

create or replace function public.phase4b_srs_is_mutable_status (_status text) returns boolean language sql immutable security invoker
set
  search_path = public as $$
select
  _status in ('draft', 'in_progress');
$$;

create or replace function public.phase4b_response_value_json_allowed (_value_type text) returns boolean language sql immutable security invoker
set
  search_path = public as $$
select
  _value_type in ('dropdown_multi', 'checkbox', 'nested_list', 'table');
$$;

create or replace function public.phase4b_assert_submitted_response_immutable () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  if old.is_submitted
  and (
    new.value_text is distinct from old.value_text
    or new.value_number is distinct from old.value_number
    or new.value_boolean is distinct from old.value_boolean
    or new.value_date is distinct from old.value_date
    or new.value_datetime is distinct from old.value_datetime
    or new.value_json is distinct from old.value_json
  ) then
    raise exception 'phase4b_assert_submitted_response_immutable: value columns are frozen after submit';
  end if;

  return new;
end;
$$;

comment on function public.phase4b_srs_is_mutable_status (text) is 'Harness helper: set metadata editable only in draft/in_progress.';

comment on function public.phase4b_response_value_json_allowed (text) is 'Harness helper: value_json allowlist per PHASE4B-ESOURCE-RUNTIME-SCHEMA §C.3.';

-- ---------------------------------------------------------------------------
-- Read-only validation views (for scripts; RLS on base tables still applies)
-- ---------------------------------------------------------------------------

create or replace view public.phase4b_violation_submitted_value_mutations
with
  (security_invoker = true) as
select
  sr.id as response_id,
  sr.response_set_id,
  sr.source_field_id
from
  public.source_responses sr
where
  sr.is_submitted = true;

comment on view public.phase4b_violation_submitted_value_mutations is
  'Placeholder listing submitted responses; harness attempts forbidden UPDATE and expects failure.';

create or replace view public.phase4b_violation_missing_correction_reason
with
  (security_invoker = true) as
select
  c.id
from
  public.source_response_corrections c
where
  length(
    trim(
      both
        from
          c.correction_reason
    )
  ) = 0;

create or replace view public.phase4b_violation_addendum_provenance
with
  (security_invoker = true) as
select
  a.id,
  a.response_set_id
from
  public.source_response_addenda a
where
  a.late_entry_reason is null
  or a.introduced_by_source_definition_version_id is null
  or a.applied_to_source_definition_version_id is null
  or a.introduced_source_field_id is null;

create or replace view public.phase4b_violation_multiple_current_responses
with
  (security_invoker = true) as
select
  sr.response_set_id,
  sr.source_field_id,
  count(*) as current_count
from
  public.source_responses sr
where
  sr.is_current = true
group by
  sr.response_set_id,
  sr.source_field_id
having
  count(*) > 1;

create or replace view public.phase4b_violation_value_json_disallowed_type
with
  (security_invoker = true) as
select
  sr.id,
  sr.value_type
from
  public.source_responses sr
where
  sr.value_json is not null
  and not public.phase4b_response_value_json_allowed (sr.value_type);

create or replace view public.phase4b_violation_submitted_empty_value
with
  (security_invoker = true) as
select
  sr.id,
  sr.response_set_id,
  sr.source_field_id
from
  public.source_responses sr
where
  sr.is_submitted = true
  and public.phase4b_response_populated_slot_count (
    sr.value_text,
    sr.value_number,
    sr.value_boolean,
    sr.value_date,
    sr.value_datetime,
    sr.value_json
  ) <> 1;

create or replace view public.phase4b_violation_draft_multi_slot
with
  (security_invoker = true) as
select
  sr.id
from
  public.source_responses sr
where
  sr.is_submitted = false
  and public.phase4b_response_populated_slot_count (
    sr.value_text,
    sr.value_number,
    sr.value_boolean,
    sr.value_date,
    sr.value_datetime,
    sr.value_json
  ) > 1;

comment on view public.phase4b_violation_submitted_empty_value is
  'Submitted rows must have exactly one typed value slot (submitted_typed_value CHECK).';

comment on view public.phase4b_violation_draft_multi_slot is
  'Draft rows may have zero slots but never more than one (scalar_slots_exclusive).';

-- Phase 4B.1 backlog (planning): source_responses.response_origin_mode enum —
-- manual | imported | derived | calculated | device | migrated

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.phase4b_srs_is_mutable_status (text) from public;

grant execute on function public.phase4b_srs_is_mutable_status (text) to authenticated;

revoke all on function public.phase4b_response_value_json_allowed (text) from public;

grant execute on function public.phase4b_response_value_json_allowed (text) to authenticated;

revoke all on function public.phase4b_assert_submitted_response_immutable () from public;

grant execute on function public.phase4b_assert_submitted_response_immutable () to authenticated;

grant select on public.phase4b_violation_submitted_value_mutations to authenticated;

grant select on public.phase4b_violation_missing_correction_reason to authenticated;

grant select on public.phase4b_violation_addendum_provenance to authenticated;

grant select on public.phase4b_violation_multiple_current_responses to authenticated;

grant select on public.phase4b_violation_value_json_disallowed_type to authenticated;

grant select on public.phase4b_violation_submitted_empty_value to authenticated;

grant select on public.phase4b_violation_draft_multi_slot to authenticated;
