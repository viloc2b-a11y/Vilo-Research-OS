-- Phase 4B.1: submit_source_response_set RPC — freeze draft responses and mark set submitted.
-- Dependencies: 0020–0025, 0034. Does not alter Phase 3C / 0026–0034 published_* / correction paths.

-- ---------------------------------------------------------------------------
-- Submit validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_required_source_fields_for_sdv (p_source_definition_version_id uuid) returns setof uuid language sql stable security invoker
set
  search_path = public as $$
select
  sf.id
from
  public.source_fields sf
where
  sf.source_definition_version_id = p_source_definition_version_id
  and sf.is_required = true;
$$;

comment on function public.phase4b_required_source_fields_for_sdv (uuid) is
  'Returns required source_field ids for a published SDV manifest.';

create or replace function public.phase4b_current_response_has_value (
  p_value_text text,
  p_value_number numeric,
  p_value_boolean boolean,
  p_value_date date,
  p_value_datetime timestamptz,
  p_value_json jsonb
) returns boolean language sql immutable security invoker
set
  search_path = public as $$
select
  public.phase4b_response_populated_slot_count (
    p_value_text,
    p_value_number,
    p_value_boolean,
    p_value_date,
    p_value_datetime,
    p_value_json
  ) = 1;
$$;

comment on function public.phase4b_current_response_has_value (text, numeric, boolean, date, timestamptz, jsonb) is
  'True when exactly one value_* slot is populated (submit-ready).';

create or replace function public.phase4b_response_value_matches_widget (
  p_widget_hint text,
  p_value_type text,
  p_value_text text,
  p_value_number numeric,
  p_value_boolean boolean,
  p_value_date date,
  p_value_datetime timestamptz,
  p_value_json jsonb
) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  p_value_type = public.phase4b_widget_hint_to_value_type (p_widget_hint)
  and public.phase4b_response_value_matches_type (
    p_value_type,
    p_value_text,
    p_value_number,
    p_value_boolean,
    p_value_date,
    p_value_datetime,
    p_value_json
  );
$$;

comment on function public.phase4b_response_value_matches_widget (text, text, text, numeric, boolean, date, timestamptz, jsonb) is
  'Validates response value_type aligns with source_fields.widget_hint and typed slots.';

create or replace function public.phase4b_source_response_set_submit_errors (p_source_response_set_id uuid) returns jsonb language plpgsql stable security invoker
set
  search_path = public as $$
declare
  v_set record;
  v_sdv_lc text;
  v_errors jsonb := '[]'::jsonb;
  v_required_count integer := 0;
  v_response_count integer := 0;
  v_missing jsonb;
  v_invalid jsonb;
  v_mismatch jsonb;
begin
  select
    srs.id,
    srs.organization_id,
    srs.study_id,
    srs.visit_id,
    srs.source_definition_version_id,
    srs.status into v_set
  from
    public.source_response_sets srs
  where
    srs.id = p_source_response_set_id;

  if v_set.id is null then
    return jsonb_build_array(
      jsonb_build_object(
        'code',
        'NOT_FOUND',
        'message',
        'source_response_set not found'
      )
    );
  end if;

  select
    sdv.lifecycle_status into v_sdv_lc
  from
    public.source_definition_versions sdv
  where
    sdv.id = v_set.source_definition_version_id;

  if v_sdv_lc is distinct from 'published' then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object(
        'code',
        'SDV_NOT_PUBLISHED',
        'message',
        format('source_definition_version must be published (got %s)', coalesce(v_sdv_lc, 'missing'))
      )
    );
  end if;

  if not public.phase4b_srs_is_mutable_status (v_set.status) then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object(
        'code',
        'SET_NOT_MUTABLE',
        'message',
        format('response set status %s cannot be submitted', v_set.status)
      )
    );
  end if;

  select
    count(*) into v_required_count
  from
    public.source_fields sf
  where
    sf.source_definition_version_id = v_set.source_definition_version_id
    and sf.is_required = true;

  select
    count(*) into v_response_count
  from
    public.source_responses sr
  where
    sr.response_set_id = v_set.id
    and sr.is_current = true;

  if v_response_count = 0
  and v_required_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object(
        'code',
        'NO_RESPONSES',
        'message',
        'response set has no current responses but required fields exist'
      )
    );
  end if;

  select
    coalesce(jsonb_agg(err), '[]'::jsonb) into v_missing
  from
    (
      select
        jsonb_build_object(
          'code',
          'REQUIRED_FIELD_MISSING',
          'message',
          format('required field %s has no submit-ready current response', sf.field_key),
          'source_field_id',
          sf.id::text,
          'field_key',
          sf.field_key
        ) as err
      from
        public.source_fields sf
      where
        sf.source_definition_version_id = v_set.source_definition_version_id
        and sf.is_required = true
        and not exists (
          select
            1
          from
            public.source_responses sr
          where
            sr.response_set_id = v_set.id
            and sr.source_field_id = sf.id
            and sr.is_current = true
            and sr.is_submitted = false
            and public.phase4b_current_response_has_value (
              sr.value_text,
              sr.value_number,
              sr.value_boolean,
              sr.value_date,
              sr.value_datetime,
              sr.value_json
            )
            and public.phase4b_response_value_matches_widget (
              sf.widget_hint,
              sr.value_type,
              sr.value_text,
              sr.value_number,
              sr.value_boolean,
              sr.value_date,
              sr.value_datetime,
              sr.value_json
            )
        )
    ) q;

  select
    coalesce(jsonb_agg(err), '[]'::jsonb) into v_invalid
  from
    (
      select
        jsonb_build_object(
          'code',
          case
            when public.phase4b_response_populated_slot_count (
              sr.value_text,
              sr.value_number,
              sr.value_boolean,
              sr.value_date,
              sr.value_datetime,
              sr.value_json
            ) <> 1 then 'VALUE_SLOT_INVALID'
            else 'VALUE_TYPE_MISMATCH'
          end,
          'message',
          case
            when public.phase4b_response_populated_slot_count (
              sr.value_text,
              sr.value_number,
              sr.value_boolean,
              sr.value_date,
              sr.value_datetime,
              sr.value_json
            ) <> 1 then format('field %s must have exactly one value slot before submit', sf.field_key)
            else format('field %s value does not match widget/value_type', sf.field_key)
          end,
          'source_field_id',
          sf.id::text,
          'response_id',
          sr.id::text,
          'field_key',
          sf.field_key
        ) as err
      from
        public.source_responses sr
        join public.source_fields sf on sf.id = sr.source_field_id
      where
        sr.response_set_id = v_set.id
        and sr.is_current = true
        and sr.is_submitted = false
        and (
          public.phase4b_response_populated_slot_count (
            sr.value_text,
            sr.value_number,
            sr.value_boolean,
            sr.value_date,
            sr.value_datetime,
            sr.value_json
          ) <> 1
          or not public.phase4b_response_value_matches_widget (
            sf.widget_hint,
            sr.value_type,
            sr.value_text,
            sr.value_number,
            sr.value_boolean,
            sr.value_date,
            sr.value_datetime,
            sr.value_json
          )
        )
    ) q;

  select
    coalesce(jsonb_agg(err), '[]'::jsonb) into v_mismatch
  from
    (
      select
        jsonb_build_object(
          'code',
          'SDV_FIELD_MISMATCH',
          'message',
          'current response references a field outside the bound source_definition_version',
          'source_field_id',
          sr.source_field_id::text,
          'response_id',
          sr.id::text
        ) as err
      from
        public.source_responses sr
      where
        sr.response_set_id = v_set.id
        and sr.is_current = true
        and not public.phase4b_source_field_belongs_to_sdv (sr.source_field_id, v_set.source_definition_version_id)
    ) q;

  v_errors := v_errors || v_missing || v_invalid || v_mismatch;

  return coalesce(v_errors, '[]'::jsonb);
end;
$$;

comment on function public.phase4b_source_response_set_submit_errors (uuid) is
  'Pre-submit validation errors for a response set (read-only). Returns jsonb array of {code, message, ...}.';

-- ---------------------------------------------------------------------------
-- submit_source_response_set
-- ---------------------------------------------------------------------------

create or replace function public.submit_source_response_set (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_submit_reason text default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
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
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_set_id is null then
    raise exception 'INVALID_INPUT: organization_id and source_response_set_id are required';
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = p_source_response_set_id;

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

  if v_set.status in ('archived', 'corrected', 'addended') then
    raise exception 'SET_NOT_SUBMITTABLE: cannot submit set in status %', v_set.status;
  end if;

  v_errors := public.phase4b_source_response_set_submit_errors (p_source_response_set_id);
  v_error_count := jsonb_array_length (coalesce(v_errors, '[]'::jsonb));

  select
    count(*) into v_required_count
  from
    public.source_fields sf
  where
    sf.source_definition_version_id = v_set.source_definition_version_id
    and sf.is_required = true;

  select
    count(*) filter (
      where
        e ->> 'code' = 'REQUIRED_FIELD_MISSING'
    ) into v_missing_required
  from
    jsonb_array_elements (coalesce(v_errors, '[]'::jsonb)) e;

  if v_error_count > 0 then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SUBMIT_VALIDATION_FAILED',
      'errors',
      v_errors,
      'data',
      jsonb_build_object(
        'source_response_set_id',
        v_set.id,
        'status',
        v_set.status,
        'submitted_at',
        null,
        'submitted_by_user_id',
        null,
        'submitted_count',
        0,
        'required_count',
        v_required_count,
        'missing_required_count',
        coalesce(v_missing_required, 0),
        'validation_error_count',
        v_error_count,
        'operational_event_id',
        null
      )
    );
  end if;

  update public.source_responses sr
  set
    is_submitted = true,
    submitted_at = v_now
  where
    sr.response_set_id = v_set.id
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
  where
    id = v_set.id
  returning
    * into v_set;

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
          'source',
          'submit_source_response_set_rpc',
          'source_response_set_id',
          v_set.id,
          'source_definition_version_id',
          v_set.source_definition_version_id,
          'submitted_response_count',
          v_submitted_count,
          'submit_reason',
          nullif(trim(p_submit_reason), '')
        )
      ),
      v_uid,
      v_now
    )
    returning
      id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'SUCCESS',
    'errors',
    '[]'::jsonb,
    'data',
    jsonb_build_object(
      'source_response_set_id',
      v_set.id,
      'status',
      v_set.status,
      'submitted_at',
      v_set.submitted_at,
      'submitted_by_user_id',
      v_set.submitted_by_user_id,
      'submitted_count',
      v_submitted_count,
      'required_count',
      v_required_count,
      'missing_required_count',
      0,
      'validation_error_count',
      0,
      'operational_event_id',
      v_event_id
    )
  );
end;
$$;

comment on function public.submit_source_response_set (uuid, uuid, text) is
  'Phase 4B.1: Validate and submit a draft/in_progress source_response_set; freeze current draft responses.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.phase4b_required_source_fields_for_sdv (uuid) from public;
revoke all on function public.phase4b_current_response_has_value (text, numeric, boolean, date, timestamptz, jsonb) from public;
revoke all on function public.phase4b_response_value_matches_widget (text, text, text, numeric, boolean, date, timestamptz, jsonb) from public;
revoke all on function public.phase4b_source_response_set_submit_errors (uuid) from public;
revoke all on function public.submit_source_response_set (uuid, uuid, text) from public;

grant execute on function public.phase4b_required_source_fields_for_sdv (uuid) to authenticated;
grant execute on function public.phase4b_current_response_has_value (text, numeric, boolean, date, timestamptz, jsonb) to authenticated;
grant execute on function public.phase4b_response_value_matches_widget (text, text, text, numeric, boolean, date, timestamptz, jsonb) to authenticated;
grant execute on function public.phase4b_source_response_set_submit_errors (uuid) to authenticated;
grant execute on function public.submit_source_response_set (uuid, uuid, text) to authenticated;
