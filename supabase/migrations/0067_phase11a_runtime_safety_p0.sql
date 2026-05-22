-- Phase 11A: Runtime safety P0 — duplicate visits, submit idempotency, SDV freeze,
-- sign-before-submit, atomic visit closeout signatures.

-- ---------------------------------------------------------------------------
-- P0-1: One active visit per subject + visit definition (non-terminal statuses)
-- ---------------------------------------------------------------------------
-- PREFLIGHT (run before index if migration fails on duplicates):
--   SELECT study_subject_id, visit_definition_id, count(*) AS active_count,
--          array_agg(id ORDER BY created_at) AS visit_ids
--   FROM public.visits
--   WHERE visit_status NOT IN ('cancelled', 'missed', 'no_show')
--   GROUP BY study_subject_id, visit_definition_id
--   HAVING count(*) > 1;
-- Resolve duplicates manually (cancel/merge); do not auto-delete in migration.

do $phase11a_visit_uidx$
begin
  if exists (
    select 1
    from public.visits v
    where v.visit_status not in ('cancelled', 'missed', 'no_show')
    group by v.study_subject_id, v.visit_definition_id
    having count(*) > 1
  ) then
    raise warning
      'Phase 11A: visits_subject_visit_def_active_uidx skipped — duplicate active visits exist. Run preflight query in 0067 header.';
  else
    create unique index if not exists visits_subject_visit_def_active_uidx
      on public.visits (study_subject_id, visit_definition_id)
      where visit_status not in ('cancelled', 'missed', 'no_show');
  end if;
end;
$phase11a_visit_uidx$;

comment on index public.visits_subject_visit_def_active_uidx is
  'Phase 11A: prevents duplicate active visits for the same subject and visit definition.';

-- ---------------------------------------------------------------------------
-- P0-3 / P0-5 helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase11a_source_submitted_statuses ()
returns text[]
language sql
immutable
as $$
  select array[
    'submitted',
    'pending_review',
    'reviewed',
    'signed',
    'locked',
    'corrected',
    'addended'
  ]::text[];
$$;

comment on function public.phase11a_source_submitted_statuses () is
  'Statuses at or after successful source submit (Phase 11A signature gate).';

create or replace function public.phase11a_latest_response_set_status (_procedure_execution_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select srs.status
  from public.source_response_sets srs
  where srs.procedure_execution_id = _procedure_execution_id
    and srs.status <> 'archived'
  order by srs.opened_at desc
  limit 1;
$$;

create or replace function public.phase11a_procedure_source_is_submitted (_procedure_execution_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.phase11a_latest_response_set_status (_procedure_execution_id)
    = any (public.phase11a_source_submitted_statuses ());
$$;

create or replace function public.phase11a_procedure_requires_submitted_source (_procedure_execution_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.procedure_executions pe
    where pe.id = _procedure_execution_id
      and (
        pe.source_definition_version_id is not null
        or exists (
          select 1
          from public.source_response_sets srs
          where srs.procedure_execution_id = pe.id
            and srs.status <> 'archived'
        )
      )
  );
$$;

-- P0-5: freeze SDV on procedure execution after capture or sign/lock
create or replace function public.phase11a_enforce_procedure_execution_sdv_immutable ()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.source_definition_version_id is distinct from old.source_definition_version_id then
    if exists (
      select 1
      from public.source_response_sets srs
      where srs.procedure_execution_id = new.id
    ) then
      raise exception 'SDV_IMMUTABLE_AFTER_CAPTURE: cannot change source_definition_version_id after capture exists';
    end if;

    if coalesce(old.is_signed, false)
      or coalesce(old.is_locked, false)
      or old.execution_status in ('completed', 'verified') then
      raise exception 'SDV_IMMUTABLE_AFTER_SIGN: cannot change source_definition_version_id on signed or terminal procedure';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists procedure_executions_phase11a_sdv_immutable on public.procedure_executions;
create trigger procedure_executions_phase11a_sdv_immutable
before update of source_definition_version_id on public.procedure_executions
for each row execute function public.phase11a_enforce_procedure_execution_sdv_immutable ();

-- P0-3: block procedure sign without submitted source
create or replace function public.phase11a_enforce_procedure_sign_source_submitted ()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.is_signed is true
    and coalesce(old.is_signed, false) is not true
    and public.phase11a_procedure_requires_submitted_source (new.id)
    and not public.phase11a_procedure_source_is_submitted (new.id) then
    raise exception 'SOURCE_NOT_SUBMITTED: procedure cannot be signed until source capture is submitted';
  end if;

  return new;
end;
$$;

drop trigger if exists procedure_executions_phase11a_sign_source on public.procedure_executions;
create trigger procedure_executions_phase11a_sign_source
before update of is_signed on public.procedure_executions
for each row execute function public.phase11a_enforce_procedure_sign_source_submitted ();

-- ---------------------------------------------------------------------------
-- P0-4: submit_source_response_set — row lock + idempotent already-submitted
-- ---------------------------------------------------------------------------

create or replace function public.submit_source_response_set (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_submit_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_errors jsonb;
  v_error_count integer;
  v_missing_required integer;
  v_required_count integer;
  v_submitted_count integer;
  v_event_id uuid;
  v_now timestamptz := now();
  v_did_transition boolean := false;
  v_submitted_statuses text[] := public.phase11a_source_submitted_statuses ();
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_set_id is null then
    raise exception 'INVALID_INPUT: organization_id and source_response_set_id are required';
  end if;

  select srs.*
  into v_set
  from public.source_response_sets srs
  where srs.id = p_source_response_set_id
  for update;

  if v_set.id is null then
    raise exception 'NOT_FOUND: source_response_set_id %', p_source_response_set_id;
  end if;

  if v_set.organization_id is distinct from p_organization_id then
    raise exception 'ORGANIZATION_MISMATCH: response set does not belong to organization';
  end if;

  if not public.user_can_manage_subject_enrollment (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot submit source for this study';
  end if;

  if public.phase4b_visit_is_locked (v_set.visit_id) then
    raise exception 'VISIT_LOCKED: cannot submit source capture on a locked visit';
  end if;

  if v_set.status = any (v_submitted_statuses) then
    select oe.id
    into v_event_id
    from public.operational_events oe
    where oe.procedure_execution_id = v_set.procedure_execution_id
      and oe.event_type = 'SOURCE_RESPONSE_SET_SUBMITTED'
      and oe.payload ->> 'source_response_set_id' = v_set.id::text
    order by oe.created_at asc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'code', 'SUCCESS',
      'errors', '[]'::jsonb,
      'idempotent', true,
      'data', jsonb_build_object(
        'source_response_set_id', v_set.id,
        'status', v_set.status,
        'submitted_at', v_set.submitted_at,
        'submitted_by_user_id', v_set.submitted_by_user_id,
        'submitted_count', 0,
        'required_count', 0,
        'missing_required_count', 0,
        'validation_error_count', 0,
        'operational_event_id', v_event_id
      )
    );
  end if;

  if v_set.status in ('archived', 'corrected', 'addended') then
    raise exception 'SET_NOT_SUBMITTABLE: cannot submit set in status %', v_set.status;
  end if;

  v_errors := public.phase4b_source_response_set_submit_errors (p_source_response_set_id);
  v_error_count := jsonb_array_length (coalesce(v_errors, '[]'::jsonb));

  select count(*)
  into v_required_count
  from public.source_fields sf
  where sf.source_definition_version_id = v_set.source_definition_version_id
    and sf.is_required = true;

  select count(*) filter (where e ->> 'code' = 'REQUIRED_FIELD_MISSING')
  into v_missing_required
  from jsonb_array_elements (coalesce(v_errors, '[]'::jsonb)) e;

  if v_error_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'SUBMIT_VALIDATION_FAILED',
      'errors', v_errors,
      'idempotent', false,
      'data', jsonb_build_object(
        'source_response_set_id', v_set.id,
        'status', v_set.status,
        'submitted_at', null,
        'submitted_by_user_id', null,
        'submitted_count', 0,
        'required_count', v_required_count,
        'missing_required_count', coalesce(v_missing_required, 0),
        'validation_error_count', v_error_count,
        'operational_event_id', null
      )
    );
  end if;

  update public.source_responses sr
  set
    is_submitted = true,
    submitted_at = v_now
  where sr.response_set_id = v_set.id
    and sr.is_current = true
    and sr.is_submitted = false
    and public.phase4b_current_response_has_value (
      sr.value_text,
      sr.value_number,
      sr.value_boolean,
      sr.value_date,
      sr.value_datetime,
      sr.value_json
    );

  get diagnostics v_submitted_count = row_count;

  update public.source_response_sets
  set
    status = 'submitted',
    submitted_by_user_id = v_uid,
    submitted_at = v_now
  where id = v_set.id
    and status in ('draft', 'in_progress')
  returning * into v_set;

  v_did_transition := found;

  if not v_did_transition then
    select srs.*
    into v_set
    from public.source_response_sets srs
    where srs.id = p_source_response_set_id;

    if v_set.status = any (v_submitted_statuses) then
      select oe.id
      into v_event_id
      from public.operational_events oe
      where oe.procedure_execution_id = v_set.procedure_execution_id
        and oe.event_type = 'SOURCE_RESPONSE_SET_SUBMITTED'
        and oe.payload ->> 'source_response_set_id' = v_set.id::text
      order by oe.created_at asc
      limit 1;

      return jsonb_build_object(
        'ok', true,
        'code', 'SUCCESS',
        'errors', '[]'::jsonb,
        'idempotent', true,
        'data', jsonb_build_object(
          'source_response_set_id', v_set.id,
          'status', v_set.status,
          'submitted_at', v_set.submitted_at,
          'submitted_by_user_id', v_set.submitted_by_user_id,
          'submitted_count', 0,
          'required_count', v_required_count,
          'missing_required_count', 0,
          'validation_error_count', 0,
          'operational_event_id', v_event_id
        )
      );
    end if;

    raise exception 'SET_NOT_SUBMITTABLE: cannot submit set in status %', v_set.status;
  end if;

  if public.user_can_append_operational_events (v_set.study_id) then
    insert into public.operational_events (
      organization_id,
      study_id,
      visit_id,
      procedure_execution_id,
      event_type,
      payload,
      actor_user_id,
      occurred_at
    )
    values (
      v_set.organization_id,
      v_set.study_id,
      v_set.visit_id,
      v_set.procedure_execution_id,
      'SOURCE_RESPONSE_SET_SUBMITTED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'submit_source_response_set_rpc',
          'source_response_set_id', v_set.id,
          'source_definition_version_id', v_set.source_definition_version_id,
          'submitted_response_count', v_submitted_count,
          'submit_reason', nullif(trim(p_submit_reason), '')
        )
      ),
      v_uid,
      v_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'SUCCESS',
    'errors', '[]'::jsonb,
    'idempotent', false,
    'data', jsonb_build_object(
      'source_response_set_id', v_set.id,
      'status', v_set.status,
      'submitted_at', v_set.submitted_at,
      'submitted_by_user_id', v_set.submitted_by_user_id,
      'submitted_count', v_submitted_count,
      'required_count', v_required_count,
      'missing_required_count', 0,
      'validation_error_count', 0,
      'operational_event_id', v_event_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- P0-6: atomic coordinator / investigator visit closeout signatures
-- ---------------------------------------------------------------------------

create or replace function public.phase11a_visit_unsubmitted_required_sources (_visit_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.visits v
    join public.visit_def_procedure_map m
      on m.visit_definition_id = v.visit_definition_id
      and m.study_id = v.study_id
      and m.is_required is true
    join public.procedure_executions pe
      on pe.visit_id = v.id
      and pe.procedure_definition_id = m.procedure_definition_id
    where v.id = _visit_id
      and (
        pe.source_definition_version_id is not null
        or exists (
          select 1
          from public.source_response_sets srs
          where srs.procedure_execution_id = pe.id
            and srs.status <> 'archived'
        )
      )
      and not public.phase11a_procedure_source_is_submitted (pe.id)
  );
$$;

create or replace function public.sign_visit_coordinator_closeout (
  p_organization_id uuid,
  p_visit_id uuid,
  p_actor_name text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_note public.visit_progress_notes%rowtype;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required', 'idempotent', false);
  end if;

  select v.*
  into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'visit not found', 'idempotent', false);
  end if;

  if not public.user_can_manage_subject_enrollment (v_visit.study_id) then
    return jsonb_build_object('ok', false, 'error', 'insufficient study access', 'idempotent', false);
  end if;

  if v_visit.visit_review_status = 'coordinator_signed' then
    return jsonb_build_object('ok', true, 'error', null, 'idempotent', true);
  end if;

  select vpn.*
  into v_note
  from public.visit_progress_notes vpn
  where vpn.visit_id = p_visit_id
  for update;

  if v_note.id is null or nullif(trim(v_note.note_text), '') is null then
    return jsonb_build_object('ok', false, 'error', 'progress note required before coordinator sign', 'idempotent', false);
  end if;

  if exists (
    select 1
    from public.procedure_executions pe
    where pe.visit_id = p_visit_id
      and pe.validation_status = 'blocked'
  ) then
    return jsonb_build_object('ok', false, 'error', 'blocking procedure validation must be resolved', 'idempotent', false);
  end if;

  if public.phase11a_visit_unsubmitted_required_sources (p_visit_id) then
    return jsonb_build_object('ok', false, 'error', 'required source capture must be submitted before coordinator sign', 'idempotent', false);
  end if;

  update public.visit_progress_notes
  set
    coordinator_signature_status = 'signed',
    coordinator_signed_by_user_id = v_uid,
    coordinator_signed_by_name = nullif(trim(p_actor_name), ''),
    coordinator_signed_at = v_now,
    updated_by = v_uid
  where visit_id = p_visit_id;

  update public.visits
  set
    visit_review_status = 'coordinator_signed',
    coordinator_signed_by = v_uid,
    coordinator_signed_by_name = nullif(trim(p_actor_name), ''),
    coordinator_signed_at = v_now
  where id = p_visit_id;

  if public.user_can_append_operational_events (v_visit.study_id) then
    insert into public.operational_events (
      organization_id,
      study_id,
      visit_id,
      procedure_execution_id,
      event_type,
      payload,
      actor_user_id,
      occurred_at
    )
    values (
      v_visit.organization_id,
      v_visit.study_id,
      p_visit_id,
      null,
      'COORDINATOR_SIGNED',
      jsonb_build_object(
        'source', 'sign_visit_coordinator_closeout_rpc',
        'actor_name', nullif(trim(p_actor_name), ''),
        'closeout_context', 'coordinator_signed'
      ),
      v_uid,
      v_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'idempotent', false,
    'operational_event_id', v_event_id
  );
end;
$$;

create or replace function public.sign_visit_investigator_closeout (
  p_organization_id uuid,
  p_visit_id uuid,
  p_investigator_role text,
  p_actor_name text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_note public.visit_progress_notes%rowtype;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required', 'idempotent', false);
  end if;

  if p_investigator_role not in ('principal_investigator', 'sub_investigator') then
    return jsonb_build_object('ok', false, 'error', 'invalid investigator role', 'idempotent', false);
  end if;

  select v.*
  into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'visit not found', 'idempotent', false);
  end if;

  if not public.user_can_manage_subject_enrollment (v_visit.study_id) then
    return jsonb_build_object('ok', false, 'error', 'insufficient study access', 'idempotent', false);
  end if;

  if v_visit.visit_review_status = 'investigator_signed' then
    return jsonb_build_object('ok', true, 'error', null, 'idempotent', true);
  end if;

  if v_visit.visit_review_status is distinct from 'coordinator_signed' then
    return jsonb_build_object('ok', false, 'error', 'coordinator must sign before investigator sign', 'idempotent', false);
  end if;

  select vpn.*
  into v_note
  from public.visit_progress_notes vpn
  where vpn.visit_id = p_visit_id
  for update;

  if v_note.id is null
    or nullif(trim(v_note.note_text), '') is null
    or v_note.coordinator_signature_status is distinct from 'signed' then
    return jsonb_build_object('ok', false, 'error', 'coordinator progress note must be signed first', 'idempotent', false);
  end if;

  if public.phase11a_visit_unsubmitted_required_sources (p_visit_id) then
    return jsonb_build_object('ok', false, 'error', 'required source capture must be submitted before investigator sign', 'idempotent', false);
  end if;

  update public.visit_progress_notes
  set
    investigator_review_status = 'signed',
    investigator_signed_by_user_id = v_uid,
    investigator_signed_by_name = nullif(trim(p_actor_name), ''),
    investigator_role = p_investigator_role,
    investigator_signed_at = v_now
  where visit_id = p_visit_id;

  update public.visits
  set
    visit_review_status = 'investigator_signed',
    investigator_signed_by = v_uid,
    investigator_signed_by_name = nullif(trim(p_actor_name), ''),
    investigator_role = p_investigator_role,
    investigator_signed_at = v_now
  where id = p_visit_id;

  if public.user_can_append_operational_events (v_visit.study_id) then
    insert into public.operational_events (
      organization_id,
      study_id,
      visit_id,
      procedure_execution_id,
      event_type,
      payload,
      actor_user_id,
      occurred_at
    )
    values (
      v_visit.organization_id,
      v_visit.study_id,
      p_visit_id,
      null,
      'INVESTIGATOR_SIGNED',
      jsonb_build_object(
        'source', 'sign_visit_investigator_closeout_rpc',
        'actor_name', nullif(trim(p_actor_name), ''),
        'closeout_context', 'investigator_signed',
        'investigator_role', p_investigator_role
      ),
      v_uid,
      v_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'idempotent', false,
    'operational_event_id', v_event_id
  );
end;
$$;

revoke all on function public.phase11a_source_submitted_statuses () from public;
revoke all on function public.phase11a_latest_response_set_status (uuid) from public;
revoke all on function public.phase11a_procedure_source_is_submitted (uuid) from public;
revoke all on function public.phase11a_procedure_requires_submitted_source (uuid) from public;
revoke all on function public.phase11a_visit_unsubmitted_required_sources (uuid) from public;
revoke all on function public.sign_visit_coordinator_closeout (uuid, uuid, text) from public;
revoke all on function public.sign_visit_investigator_closeout (uuid, uuid, text, text) from public;

grant execute on function public.phase11a_latest_response_set_status (uuid) to authenticated;
grant execute on function public.phase11a_procedure_source_is_submitted (uuid) to authenticated;
grant execute on function public.sign_visit_coordinator_closeout (uuid, uuid, text) to authenticated;
grant execute on function public.sign_visit_investigator_closeout (uuid, uuid, text, text) to authenticated;
