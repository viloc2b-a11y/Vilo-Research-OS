-- Phase 4B.1: correct_source_response + add_source_addendum RPCs (post-submit change control).
-- Dependencies: 0020–0025, 0034–0035. Does not alter Phase 3C / 0026–0035 published_*.

-- ---------------------------------------------------------------------------
-- Value payload helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_parse_value_payload (p_value jsonb) returns jsonb language plpgsql immutable security invoker
set
  search_path = public as $$
declare
  v_text text;
  v_number numeric;
  v_boolean boolean;
  v_date date;
  v_datetime timestamptz;
  v_json jsonb;
  v_slots integer;
begin
  if p_value is null
  or jsonb_typeof (p_value) <> 'object' then
    raise exception 'INVALID_VALUE_PAYLOAD: expected json object';
  end if;

  v_text := nullif(p_value ->> 'value_text', '');

  if nullif(p_value ->> 'value_number', '') is not null then
    v_number := (p_value ->> 'value_number')::numeric;
  end if;

  if p_value ? 'value_boolean' then
    if jsonb_typeof (p_value -> 'value_boolean') = 'boolean' then
      v_boolean := (p_value -> 'value_boolean')::boolean;
    elsif nullif(p_value ->> 'value_boolean', '') is not null then
      v_boolean := (p_value ->> 'value_boolean')::boolean;
    end if;
  end if;

  if nullif(p_value ->> 'value_date', '') is not null then
    v_date := (p_value ->> 'value_date')::date;
  end if;

  if nullif(p_value ->> 'value_datetime', '') is not null then
    v_datetime := (p_value ->> 'value_datetime')::timestamptz;
  end if;

  if p_value ? 'value_json'
  and p_value -> 'value_json' is not null
  and p_value -> 'value_json' <> 'null'::jsonb then
    v_json := p_value -> 'value_json';
  end if;

  v_slots := public.phase4b_response_populated_slot_count (
    v_text,
    v_number,
    v_boolean,
    v_date,
    v_datetime,
    v_json
  );

  if v_slots <> 1 then
    raise exception 'VALUE_SLOT_INVALID: exactly one value_* slot required (got %)', v_slots;
  end if;

  return jsonb_build_object(
    'value_text',
    v_text,
    'value_number',
    v_number,
    'value_boolean',
    v_boolean,
    'value_date',
    v_date,
    'value_datetime',
    v_datetime,
    'value_json',
    v_json
  );
end;
$$;

comment on function public.phase4b_parse_value_payload (jsonb) is
  'Parse correction/addendum value jsonb; enforce single populated value slot.';

create or replace function public.phase4b_json_value_slot_count (p_value jsonb) returns integer language plpgsql immutable security invoker
set
  search_path = public as $$
declare
  v_parsed jsonb;
begin
  v_parsed := public.phase4b_parse_value_payload (p_value);
  return public.phase4b_response_populated_slot_count (
    v_parsed ->> 'value_text',
    (v_parsed ->> 'value_number')::numeric,
    (v_parsed ->> 'value_boolean')::boolean,
    (v_parsed ->> 'value_date')::date,
    (v_parsed ->> 'value_datetime')::timestamptz,
    case
      when v_parsed -> 'value_json' is null
      or v_parsed -> 'value_json' = 'null'::jsonb then null
      else v_parsed -> 'value_json'
    end
  );
exception
  when others then
    return -1;
end;
$$;

comment on function public.phase4b_json_value_slot_count (jsonb) is
  'Returns populated slot count for value payload, or -1 when payload invalid.';

create or replace function public.phase4b_prior_value_reference_from_response (p_response_id uuid) returns text language sql stable security invoker
set
  search_path = public as $$
select
  left(
    jsonb_strip_nulls(
      jsonb_build_object(
        'response_id',
        sr.id,
        'value_type',
        sr.value_type,
        'value_text',
        sr.value_text,
        'value_number',
        sr.value_number,
        'value_boolean',
        sr.value_boolean,
        'value_date',
        sr.value_date,
        'value_datetime',
        sr.value_datetime,
        'value_json',
        sr.value_json
      )
    )::text,
    4000
  )
from
  public.source_responses sr
where
  sr.id = p_response_id;
$$;

comment on function public.phase4b_prior_value_reference_from_response (uuid) is
  'Compact prior-value snapshot for source_response_corrections.prior_value_reference.';

create or replace function public.phase4b_srs_allows_post_submit_change (p_status text) returns boolean language sql immutable security invoker
set
  search_path = public as $$
select
  p_status in (
    'submitted',
    'pending_review',
    'reviewed',
    'signed',
    'locked',
    'corrected',
    'addended'
  );
$$;

comment on function public.phase4b_srs_allows_post_submit_change (text) is
  'True when response set status permits correction or addendum RPCs.';

-- ---------------------------------------------------------------------------
-- correct_source_response
-- ---------------------------------------------------------------------------

create or replace function public.correct_source_response (
  p_organization_id uuid,
  p_source_response_id uuid,
  p_corrected_value jsonb,
  p_reason text
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_prior public.source_responses%rowtype;
  v_set public.source_response_sets%rowtype;
  v_field record;
  v_parsed jsonb;
  v_value_type text;
  v_new_id uuid;
  v_correction_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
  v_role text;
  v_seq integer;
  v_correction_type text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_id is null then
    raise exception 'INVALID_INPUT: organization_id and source_response_id are required';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED: correction reason is required';
  end if;

  if p_corrected_value is null
  or jsonb_typeof (p_corrected_value) <> 'object' then
    raise exception 'INVALID_VALUE_PAYLOAD: corrected_value must be a json object';
  end if;

  select
    sr.* into v_prior
  from
    public.source_responses sr
  where
    sr.id = p_source_response_id;

  if v_prior.id is null then
    raise exception 'NOT_FOUND: source_response_id %', p_source_response_id;
  end if;

  if v_prior.organization_id is distinct from p_organization_id then
    raise exception 'ORGANIZATION_MISMATCH: response does not belong to organization';
  end if;

  if not v_prior.is_submitted then
    raise exception 'RESPONSE_NOT_SUBMITTED: only submitted responses may be corrected';
  end if;

  if not v_prior.is_current then
    raise exception 'RESPONSE_NOT_CURRENT: only the current submitted value may be corrected';
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = v_prior.response_set_id;

  if not public.phase4b_user_can_correct_source (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot correct source for this study';
  end if;

  if not public.phase4b_srs_allows_post_submit_change (v_set.status) then
    raise exception 'SET_NOT_CORRECTABLE: response set status % does not allow correction', v_set.status;
  end if;

  if not public.phase4b_source_field_belongs_to_sdv (v_prior.source_field_id, v_set.source_definition_version_id) then
    raise exception 'SDV_FIELD_MISMATCH: field does not belong to bound source_definition_version';
  end if;

  select
    sf.id,
    sf.widget_hint into v_field
  from
    public.source_fields sf
  where
    sf.id = v_prior.source_field_id;

  v_parsed := public.phase4b_parse_value_payload (p_corrected_value);
  v_value_type := public.phase4b_widget_hint_to_value_type (v_field.widget_hint);

  if not public.phase4b_response_value_matches_widget (
    v_field.widget_hint,
    v_value_type,
    v_parsed ->> 'value_text',
    (v_parsed ->> 'value_number')::numeric,
    (v_parsed ->> 'value_boolean')::boolean,
    (v_parsed ->> 'value_date')::date,
    (v_parsed ->> 'value_datetime')::timestamptz,
    case
      when v_parsed -> 'value_json' is null
      or v_parsed -> 'value_json' = 'null'::jsonb then null
      else v_parsed -> 'value_json'
    end
  ) then
    raise exception 'VALUE_TYPE_MISMATCH: corrected value does not match field widget/value_type';
  end if;

  v_role := public.phase4b_resolve_originator_role (v_set.study_id);
  v_correction_type := case
    when length(trim(p_reason)) >= 10 then 'other'
    else 'data_entry_error'
  end;

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
      'SOURCE_RESPONSE_CORRECTED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'correct_source_response_rpc',
          'response_set_id',
          v_set.id,
          'prior_response_id',
          v_prior.id,
          'source_field_id',
          v_prior.source_field_id,
          'reason',
          trim(p_reason)
        )
      ),
      v_uid,
      v_now
    )
    returning
      id into v_event_id;
  else
    raise exception 'FORBIDDEN: cannot append operational event for correction';
  end if;

  insert into public.source_responses (
    response_set_id,
    source_definition_version_id,
    source_field_id,
    procedure_execution_id,
    response_sequence,
    is_current,
    originator_user_id,
    originator_role,
    captured_at,
    value_type,
    value_text,
    value_number,
    value_boolean,
    value_date,
    value_datetime,
    value_json,
    is_submitted,
    submitted_at,
    supersedes_response_id,
    correction_chain_root_id
  )
  values (
    v_prior.response_set_id,
    v_prior.source_definition_version_id,
    v_prior.source_field_id,
    v_prior.procedure_execution_id,
    1,
    true,
    v_uid,
    v_role,
    v_now,
    v_value_type,
    v_parsed ->> 'value_text',
    (v_parsed ->> 'value_number')::numeric,
    (v_parsed ->> 'value_boolean')::boolean,
    (v_parsed ->> 'value_date')::date,
    (v_parsed ->> 'value_datetime')::timestamptz,
    case
      when v_parsed -> 'value_json' is null
      or v_parsed -> 'value_json' = 'null'::jsonb then null
      else v_parsed -> 'value_json'
    end,
    true,
    v_now,
    v_prior.id,
    coalesce(v_prior.correction_chain_root_id, v_prior.id)
  )
  returning
    id,
    response_sequence into v_new_id,
    v_seq;

  insert into public.source_response_corrections (
    organization_id,
    response_id,
    superseded_response_id,
    correction_type,
    correction_reason,
    prior_value_reference,
    corrected_by_user_id,
    corrected_at,
    operational_event_id
  )
  values (
    p_organization_id,
    v_new_id,
    v_prior.id,
    v_correction_type,
    trim(p_reason),
    coalesce(
      public.phase4b_prior_value_reference_from_response (v_prior.id),
      format('response_id:%s', v_prior.id)
    ),
    v_uid,
    v_now,
    v_event_id
  )
  returning
    id into v_correction_id;

  if v_set.status in ('submitted', 'pending_review', 'reviewed', 'signed', 'locked', 'addended') then
    update public.source_response_sets
    set
      status = 'corrected'
    where
      id = v_set.id
      and status <> 'corrected';
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
      'prior_response_id',
      v_prior.id,
      'corrected_response_id',
      v_new_id,
      'response_set_id',
      v_prior.response_set_id,
      'source_field_id',
      v_prior.source_field_id,
      'correction_id',
      v_correction_id,
      'operational_event_id',
      v_event_id,
      'response_sequence',
      v_seq
    )
  );
end;
$$;

comment on function public.correct_source_response (uuid, uuid, jsonb, text) is
  'Phase 4B.1: Append-only correction — new submitted response row + source_response_corrections metadata.';

-- ---------------------------------------------------------------------------
-- add_source_addendum
-- ---------------------------------------------------------------------------

create or replace function public.add_source_addendum (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_source_field_id uuid,
  p_value jsonb,
  p_reason text,
  p_introduced_by_source_definition_version_id uuid default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_field record;
  v_applied_field record;
  v_intro_sdv_id uuid;
  v_intro_lc text;
  v_parsed jsonb;
  v_value_type text;
  v_new_id uuid;
  v_addendum_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
  v_role text;
  v_seq integer := 1;
  v_existing_current uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_set_id is null
  or p_source_field_id is null then
    raise exception 'INVALID_INPUT: organization_id, source_response_set_id, and source_field_id are required';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED: addendum reason is required';
  end if;

  if p_value is null
  or jsonb_typeof (p_value) <> 'object' then
    raise exception 'INVALID_VALUE_PAYLOAD: value must be a json object';
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

  if not public.phase4b_user_can_correct_source (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot add addendum for this study';
  end if;

  if not public.phase4b_srs_allows_post_submit_change (v_set.status) then
    raise exception 'SET_NOT_ADDENDABLE: response set status % does not allow addendum', v_set.status;
  end if;

  select
    sf.id,
    sf.widget_hint,
    sf.source_definition_version_id into v_field
  from
    public.source_fields sf
  where
    sf.id = p_source_field_id;

  if v_field.id is null then
    raise exception 'NOT_FOUND: source_field_id %', p_source_field_id;
  end if;

  v_intro_sdv_id := coalesce(p_introduced_by_source_definition_version_id, v_field.source_definition_version_id);

  select
    sdv.lifecycle_status into v_intro_lc
  from
    public.source_definition_versions sdv
  where
    sdv.id = v_intro_sdv_id;

  if v_intro_lc is distinct from 'published' then
    raise exception 'SDV_NOT_PUBLISHED: introduced_by source_definition_version must be published';
  end if;

  if not public.phase4b_source_field_belongs_to_sdv (p_source_field_id, v_intro_sdv_id) then
    raise exception 'SDV_FIELD_MISMATCH: source_field_id must belong to introduced_by SDV';
  end if;

  if v_intro_sdv_id = v_set.source_definition_version_id then
    select
      sf.id,
      sf.widget_hint into v_applied_field
    from
      public.source_fields sf
    where
      sf.id = p_source_field_id;
  else
    select
      af.id,
      af.widget_hint into v_applied_field
    from
      public.source_fields nf
      join public.source_fields af on af.field_key = nf.field_key
      and af.source_definition_version_id = v_set.source_definition_version_id
    where
      nf.id = p_source_field_id;
  end if;

  if v_applied_field.id is null then
    raise exception 'ADDENDUM_FIELD_NOT_ON_APPLIED_MANIFEST: no matching field_key on bound source_definition_version';
  end if;

  select
    sr.id into v_existing_current
  from
    public.source_responses sr
  where
    sr.response_set_id = v_set.id
    and sr.source_field_id = v_applied_field.id
    and sr.is_current = true
  limit
    1;

  if v_existing_current is not null then
    raise exception 'FIELD_ALREADY_CAPTURED: use correct_source_response to change an existing field value';
  end if;

  v_parsed := public.phase4b_parse_value_payload (p_value);
  v_value_type := public.phase4b_widget_hint_to_value_type (v_applied_field.widget_hint);

  if not public.phase4b_response_value_matches_widget (
    v_applied_field.widget_hint,
    v_value_type,
    v_parsed ->> 'value_text',
    (v_parsed ->> 'value_number')::numeric,
    (v_parsed ->> 'value_boolean')::boolean,
    (v_parsed ->> 'value_date')::date,
    (v_parsed ->> 'value_datetime')::timestamptz,
    case
      when v_parsed -> 'value_json' is null
      or v_parsed -> 'value_json' = 'null'::jsonb then null
      else v_parsed -> 'value_json'
    end
  ) then
    raise exception 'VALUE_TYPE_MISMATCH: addendum value does not match field widget/value_type';
  end if;

  select
    coalesce(max(sr.response_sequence), 0) + 1 into v_seq
  from
    public.source_responses sr
  where
    sr.response_set_id = v_set.id
    and sr.source_field_id = v_applied_field.id;

  v_role := public.phase4b_resolve_originator_role (v_set.study_id);

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
      'SOURCE_RESPONSE_ADDENDUM_ADDED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'add_source_addendum_rpc',
          'response_set_id',
          v_set.id,
          'source_field_id',
          v_applied_field.id,
          'introduced_source_field_id',
          p_source_field_id,
          'introduced_by_source_definition_version_id',
          v_intro_sdv_id,
          'applied_to_source_definition_version_id',
          v_set.source_definition_version_id,
          'reason',
          trim(p_reason)
        )
      ),
      v_uid,
      v_now
    )
    returning
      id into v_event_id;
  else
    raise exception 'FORBIDDEN: cannot append operational event for addendum';
  end if;

  insert into public.source_responses (
    response_set_id,
    source_definition_version_id,
    source_field_id,
    procedure_execution_id,
    response_sequence,
    is_current,
    originator_user_id,
    originator_role,
    captured_at,
    value_type,
    value_text,
    value_number,
    value_boolean,
    value_date,
    value_datetime,
    value_json,
    is_submitted,
    submitted_at
  )
  values (
    v_set.id,
    v_set.source_definition_version_id,
    v_applied_field.id,
    v_set.procedure_execution_id,
    v_seq,
    true,
    v_uid,
    v_role,
    v_now,
    v_value_type,
    v_parsed ->> 'value_text',
    (v_parsed ->> 'value_number')::numeric,
    (v_parsed ->> 'value_boolean')::boolean,
    (v_parsed ->> 'value_date')::date,
    (v_parsed ->> 'value_datetime')::timestamptz,
    case
      when v_parsed -> 'value_json' is null
      or v_parsed -> 'value_json' = 'null'::jsonb then null
      else v_parsed -> 'value_json'
    end,
    true,
    v_now
  )
  returning
    id into v_new_id;

  -- response row uses v_applied_field.id (bound manifest); addendum metadata keeps introduced field id

  insert into public.source_response_addenda (
    organization_id,
    response_set_id,
    introduced_by_source_definition_version_id,
    applied_to_source_definition_version_id,
    introduced_source_field_id,
    late_entry_reason,
    added_by_user_id,
    added_at,
    response_id,
    operational_event_id
  )
  values (
    p_organization_id,
    v_set.id,
    v_intro_sdv_id,
    v_set.source_definition_version_id,
    p_source_field_id,
    trim(p_reason),
    v_uid,
    v_now,
    v_new_id,
    v_event_id
  )
  returning
    id into v_addendum_id;

  update public.source_response_sets
  set
    status = 'addended'
  where
    id = v_set.id
    and status <> 'addended';

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'SUCCESS',
    'errors',
    '[]'::jsonb,
    'data',
    jsonb_build_object(
      'addendum_id',
      v_addendum_id,
      'response_id',
      v_new_id,
      'response_set_id',
      v_set.id,
      'source_field_id',
      v_applied_field.id,
      'introduced_source_field_id',
      p_source_field_id,
      'introduced_by_source_definition_version_id',
      v_intro_sdv_id,
      'applied_to_source_definition_version_id',
      v_set.source_definition_version_id,
      'operational_event_id',
      v_event_id,
      'response_sequence',
      v_seq
    )
  );
end;
$$;

comment on function public.add_source_addendum (uuid, uuid, uuid, jsonb, text, uuid) is
  'Phase 4B.1: Late-entry addendum — new submitted response + source_response_addenda provenance.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.phase4b_parse_value_payload (jsonb) from public;
revoke all on function public.phase4b_json_value_slot_count (jsonb) from public;
revoke all on function public.phase4b_prior_value_reference_from_response (uuid) from public;
revoke all on function public.phase4b_srs_allows_post_submit_change (text) from public;
revoke all on function public.correct_source_response (uuid, uuid, jsonb, text) from public;
revoke all on function public.add_source_addendum (uuid, uuid, uuid, jsonb, text, uuid) from public;

grant execute on function public.phase4b_parse_value_payload (jsonb) to authenticated;
grant execute on function public.phase4b_json_value_slot_count (jsonb) to authenticated;
grant execute on function public.phase4b_prior_value_reference_from_response (uuid) to authenticated;
grant execute on function public.phase4b_srs_allows_post_submit_change (text) to authenticated;
grant execute on function public.correct_source_response (uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.add_source_addendum (uuid, uuid, uuid, jsonb, text, uuid) to authenticated;
