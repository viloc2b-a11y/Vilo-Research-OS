-- Phase 4B: narrow RLS + trigger guard for submit_source_response_set response freeze.
-- Dependencies: 0021 source_responses, 0035 submit_source_response_set.
-- Does not alter Phase 3C / 0026–0037 / published_*.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_source_response_set_allows_submit (_response_set_id uuid) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  exists (
    select
      1
    from
      public.source_response_sets srs
    where
      srs.id = _response_set_id
      and srs.status <> 'archived'
      and public.phase4b_srs_is_mutable_status (srs.status)
  );
$$;

comment on function public.phase4b_source_response_set_allows_submit (uuid) is
  'True when response set is draft/in_progress and not archived — eligible for submit freeze on child responses.';

revoke all on function public.phase4b_source_response_set_allows_submit (uuid) from public;

grant execute on function public.phase4b_source_response_set_allows_submit (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: submit transition may only flip is_submitted + submitted_at
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_guard_submit_update_shape () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if current_setting ('phase4b.internal_demotion', true) = old.id::text
  and new.is_current = false
  and old.is_current = true then
    return new;
  end if;

  if old.is_submitted = false
  and new.is_submitted = true then
    if new.submitted_at is null then
      raise exception 'submit transition requires submitted_at';
    end if;

    if not new.is_current
    or new.is_current is distinct from old.is_current then
      raise exception 'submit transition cannot change is_current';
    end if;

    if new.organization_id is distinct from old.organization_id
    or new.response_set_id is distinct from old.response_set_id
    or new.source_definition_version_id is distinct from old.source_definition_version_id
    or new.source_field_id is distinct from old.source_field_id
    or new.procedure_execution_id is distinct from old.procedure_execution_id
    or new.response_sequence is distinct from old.response_sequence
    or new.originator_user_id is distinct from old.originator_user_id
    or new.originator_role is distinct from old.originator_role
    or new.captured_at is distinct from old.captured_at
    or new.value_type is distinct from old.value_type
    or new.value_text is distinct from old.value_text
    or new.value_number is distinct from old.value_number
    or new.value_boolean is distinct from old.value_boolean
    or new.value_date is distinct from old.value_date
    or new.value_datetime is distinct from old.value_datetime
    or new.value_json is distinct from old.value_json
    or new.unit is distinct from old.unit
    or new.normalized_value is distinct from old.normalized_value
    or new.source_system is distinct from old.source_system
    or new.source_device_id is distinct from old.source_device_id
    or new.supersedes_response_id is distinct from old.supersedes_response_id
    or new.correction_chain_root_id is distinct from old.correction_chain_root_id
    or new.operational_event_id is distinct from old.operational_event_id
    or new.created_at is distinct from old.created_at then
      raise exception 'submit transition cannot mutate provenance, values, or chain metadata';
    end if;

    return new;
  end if;

  return new;
end;
$$;

comment on function public.phase4b_guard_submit_update_shape () is
  'Allows only is_submitted/submitted_at changes when freezing a draft response at submit.';

drop trigger if exists source_responses_guard_submit_update_shape on public.source_responses;

create trigger source_responses_guard_submit_update_shape before
update on public.source_responses for each row
execute function public.phase4b_guard_submit_update_shape ();

-- ---------------------------------------------------------------------------
-- Narrow RLS: draft → submitted freeze (orthogonal to draft value edit policy)
-- ---------------------------------------------------------------------------

drop policy if exists source_responses_submit_update on public.source_responses;

create policy source_responses_submit_update on public.source_responses for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and is_submitted = false
  and is_current = true
  and public.user_can_manage_subject_enrollment (
    (
      select
        srs.study_id
      from
        public.source_response_sets srs
      where
        srs.id = response_set_id
    )
  )
  and not public.phase4b_visit_is_locked (
    (
      select
        srs.visit_id
      from
        public.source_response_sets srs
      where
        srs.id = response_set_id
    )
  )
  and public.phase4b_source_response_set_allows_submit (response_set_id)
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and is_submitted = true
    and submitted_at is not null
    and is_current = true
    and public.phase4b_source_response_set_allows_submit (response_set_id)
  );

comment on policy source_responses_submit_update on public.source_responses is
  'Permits submit_source_response_set to set is_submitted=true on current draft rows only; value_* edits remain on source_responses_update (is_submitted=false).';
