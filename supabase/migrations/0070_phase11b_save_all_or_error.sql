-- Phase 11B-CLOSE: save_source_draft transactional all-or-error (no partial field persistence).

create or replace function public.save_source_draft (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_responses jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_item jsonb;
  v_parsed jsonb;
  v_field_id uuid;
  v_field record;
  v_existing_id uuid;
  v_response_id uuid;
  v_role text;
  v_saved integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_summaries jsonb := '[]'::jsonb;
  v_value_type text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_set_id is null then
    raise exception 'INVALID_INPUT: organization_id and source_response_set_id are required';
  end if;

  if p_responses is null
  or jsonb_typeof (p_responses) <> 'array' then
    raise exception 'INVALID_INPUT: p_responses must be a json array';
  end if;

  select srs.* into v_set
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
    raise exception 'FORBIDDEN: caller cannot save source for this study';
  end if;

  if public.phase4b_visit_is_locked (v_set.visit_id) then
    raise exception 'VISIT_LOCKED: cannot save draft on a locked visit';
  end if;

  if p_expected_updated_at is not null
    and v_set.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_WRITE: response set changed on server; refresh and retry';
  end if;

  if not public.phase4b_srs_is_mutable_status (v_set.status) then
    raise exception 'SET_NOT_MUTABLE: response set status % does not allow draft save', v_set.status;
  end if;

  v_role := public.phase4b_resolve_originator_role (v_set.study_id);

  -- Pass 1: validate entire batch before any draft response writes.
  for v_item in
  select
    value
  from
    jsonb_array_elements (p_responses) loop
    begin
      v_parsed := public.phase4b_parse_draft_response_item (v_item);
      v_field_id := (v_parsed ->> 'source_field_id')::uuid;

      if not public.phase4b_source_field_belongs_to_sdv (v_field_id, v_set.source_definition_version_id) then
        raise exception 'SDV_FIELD_MISMATCH: source_field_id does not belong to bound source_definition_version';
      end if;

      select
        sf.id,
        sf.widget_hint,
        sf.is_required into v_field
      from
        public.source_fields sf
      where
        sf.id = v_field_id;

      if v_field.id is null then
        raise exception 'NOT_FOUND: source_field_id %', v_field_id;
      end if;

      v_value_type := public.phase4b_widget_hint_to_value_type (v_field.widget_hint);

      if coalesce((v_parsed ->> 'has_comment')::boolean, false) then
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'source_field_id',
            v_field_id::text,
            'code',
            'COMMENTS_DEFERRED',
            'message',
            'comments are not persisted in Phase 4B.1 (0034); deferred to a later migration'
          )
        );
      end if;

      if public.phase4b_response_populated_slot_count (
        (v_parsed ->> 'value_text'),
        (v_parsed ->> 'value_number')::numeric,
        (v_parsed ->> 'value_boolean')::boolean,
        (v_parsed ->> 'value_date')::date,
        (v_parsed ->> 'value_datetime')::timestamptz,
        case
          when v_parsed -> 'value_json' is null
          or v_parsed -> 'value_json' = 'null'::jsonb then null
          else v_parsed -> 'value_json'
        end
      ) > 0
      and not public.phase4b_response_value_matches_widget (
        v_field.widget_hint,
        v_value_type,
        (v_parsed ->> 'value_text'),
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
        raise exception 'populated value does not match value_type %', v_value_type;
      end if;
    exception
      when others then
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'source_field_id',
            coalesce(v_item ->> 'source_field_id', ''),
            'code',
            'SAVE_FIELD_FAILED',
            'message',
            sqlerrm
          )
        );
    end;
  end loop;

  if jsonb_array_length (v_errors) > 0 then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'BATCH_SAVE_FAILED',
      'errors',
      v_errors,
      'data',
      jsonb_build_object(
        'source_response_set_id',
        v_set.id,
        'status',
        v_set.status,
        'saved_count',
        0,
        'skipped_count',
        0,
        'response_set_updated_at',
        v_set.updated_at,
        'responses',
        '[]'::jsonb
      )
    );
  end if;

  -- Pass 2: apply writes only when the full batch validated.
  for v_item in
  select
    value
  from
    jsonb_array_elements (p_responses) loop
    v_parsed := public.phase4b_parse_draft_response_item (v_item);
    v_field_id := (v_parsed ->> 'source_field_id')::uuid;

    select
      sf.id,
      sf.widget_hint,
      sf.is_required into v_field
    from
      public.source_fields sf
    where
      sf.id = v_field_id;

    v_value_type := public.phase4b_widget_hint_to_value_type (v_field.widget_hint);

    if coalesce((v_parsed ->> 'has_comment')::boolean, false) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select
      sr.id into v_existing_id
    from
      public.source_responses sr
    where
      sr.response_set_id = v_set.id
      and sr.source_field_id = v_field_id
      and sr.is_current = true
      and sr.is_submitted = false
    limit
      1;

    if v_existing_id is not null then
      update public.source_responses
      set
        value_text = (v_parsed ->> 'value_text'),
        value_number = (v_parsed ->> 'value_number')::numeric,
        value_boolean = (v_parsed ->> 'value_boolean')::boolean,
        value_date = (v_parsed ->> 'value_date')::date,
        value_datetime = (v_parsed ->> 'value_datetime')::timestamptz,
        value_json = case
          when v_parsed -> 'value_json' is null
          or v_parsed -> 'value_json' = 'null'::jsonb then null
          else v_parsed -> 'value_json'
        end,
        captured_at = now(),
        originator_user_id = v_uid,
        originator_role = v_role
      where
        id = v_existing_id
      returning
        id into v_response_id;
    else
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
        is_submitted
      )
      values (
        v_set.id,
        v_set.source_definition_version_id,
        v_field_id,
        v_set.procedure_execution_id,
        1,
        true,
        v_uid,
        v_role,
        now(),
        v_value_type,
        (v_parsed ->> 'value_text'),
        (v_parsed ->> 'value_number')::numeric,
        (v_parsed ->> 'value_boolean')::boolean,
        (v_parsed ->> 'value_date')::date,
        (v_parsed ->> 'value_datetime')::timestamptz,
        case
          when v_parsed -> 'value_json' is null
          or v_parsed -> 'value_json' = 'null'::jsonb then null
          else v_parsed -> 'value_json'
        end,
        false
      )
      returning
        id into v_response_id;
    end if;

    if public.phase4b_response_populated_slot_count (
      (v_parsed ->> 'value_text'),
      (v_parsed ->> 'value_number')::numeric,
      (v_parsed ->> 'value_boolean')::boolean,
      (v_parsed ->> 'value_date')::date,
      (v_parsed ->> 'value_datetime')::timestamptz,
      case
        when v_parsed -> 'value_json' is null
        or v_parsed -> 'value_json' = 'null'::jsonb then null
        else v_parsed -> 'value_json'
      end
    ) = 0 then
      v_skipped := v_skipped + 1;
    else
      v_saved := v_saved + 1;
    end if;

    v_summaries := v_summaries || jsonb_build_array(
      jsonb_build_object(
        'source_field_id',
        v_field_id::text,
        'response_id',
        v_response_id::text,
        'saved',
        true
      )
    );
  end loop;

  if v_saved > 0 then
    update public.source_response_sets
    set
      status = case when status = 'draft' then 'in_progress' else status end,
      updated_at = clock_timestamp()
    where id = v_set.id
    returning status, updated_at into v_set.status, v_set.updated_at;
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
      'saved_count',
      v_saved,
      'skipped_count',
      v_skipped,
      'response_set_updated_at', v_set.updated_at,
      'responses',
      v_summaries
    )
  );
end;
$$;

comment on function public.save_source_draft (uuid, uuid, jsonb, timestamptz) is
  'Phase 11B-CLOSE: draft save all-or-error — validate full batch before any field write.';
