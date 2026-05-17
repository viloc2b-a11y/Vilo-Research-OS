-- Phase 4B.1: runtime capture RPCs — open_source_response_set, save_source_draft only.
-- Dependencies: 0020–0025, 0015–0016 (Phase 4A). Does not alter Phase 3C / 0026–0033 / published_*.

-- ---------------------------------------------------------------------------
-- Narrow helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_source_field_belongs_to_sdv (
  p_source_field_id uuid,
  p_source_definition_version_id uuid
) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  exists (
    select
      1
    from
      public.source_fields sf
    where
      sf.id = p_source_field_id
      and sf.source_definition_version_id = p_source_definition_version_id
  );
$$;

comment on function public.phase4b_source_field_belongs_to_sdv (uuid, uuid) is
  'True when source_field_id belongs to the given published source_definition_version.';

create or replace function public.phase4b_widget_hint_to_value_type (p_widget_hint text) returns text language plpgsql immutable security invoker
set
  search_path = public as $$
declare
  v_hint text := lower(trim(coalesce(p_widget_hint, 'text')));
begin
  case v_hint
    when 'text' then return 'text';
    when 'textarea' then return 'textarea';
    when 'integer' then return 'integer';
    when 'number', 'decimal' then return 'decimal';
    when 'boolean' then return 'boolean';
    when 'date' then return 'date';
    when 'datetime' then return 'datetime';
    when 'time' then return 'datetime';
    when 'dropdown', 'dropdown_single' then return 'dropdown_single';
    when 'dropdown_multi', 'checkbox' then return 'dropdown_multi';
    when 'radio' then return 'radio';
    when 'file_reference' then return 'file_reference';
    when 'signature_reference' then return 'signature_reference';
    when 'nested_list' then return 'nested_list';
    when 'table' then return 'table';
    when 'calculated' then return 'calculated';
    else return 'text';
  end case;
end;
$$;

comment on function public.phase4b_widget_hint_to_value_type (text) is
  'Maps Phase 4A source_fields.widget_hint to source_responses.value_type.';

create or replace function public.phase4b_resolve_originator_role (p_study_id uuid) returns text language sql stable security invoker
set
  search_path = public as $$
select
  coalesce(
    (
      select
        sm.role
      from
        public.study_members sm
      where
        sm.study_id = p_study_id
        and sm.user_id = auth.uid ()
      limit
      1
    ),
    'coordinator'
  );
$$;

comment on function public.phase4b_resolve_originator_role (uuid) is
  'Snapshot study_members.role for capture attribution; defaults to coordinator when membership row missing.';

create or replace function public.phase4b_parse_draft_response_item (p_item jsonb) returns jsonb language plpgsql immutable security invoker
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
  if p_item is null
  or jsonb_typeof (p_item) <> 'object' then
    raise exception 'INVALID_RESPONSE_ITEM: expected json object';
  end if;

  if nullif(trim(p_item ->> 'source_field_id'), '') is null then
    raise exception 'INVALID_RESPONSE_ITEM: source_field_id is required';
  end if;

  v_text := nullif(p_item ->> 'value_text', '');

  if nullif(p_item ->> 'value_number', '') is not null then
    v_number := (p_item ->> 'value_number')::numeric;
  end if;

  if p_item ? 'value_boolean' then
    if jsonb_typeof (p_item -> 'value_boolean') = 'boolean' then
      v_boolean := (p_item -> 'value_boolean')::boolean;
    elsif nullif(p_item ->> 'value_boolean', '') is not null then
      v_boolean := (p_item ->> 'value_boolean')::boolean;
    end if;
  end if;

  if nullif(p_item ->> 'value_date', '') is not null then
    v_date := (p_item ->> 'value_date')::date;
  end if;

  if nullif(p_item ->> 'value_datetime', '') is not null then
    v_datetime := (p_item ->> 'value_datetime')::timestamptz;
  end if;

  if p_item ? 'value_json'
  and p_item -> 'value_json' is not null
  and p_item -> 'value_json' <> 'null'::jsonb then
    v_json := p_item -> 'value_json';
  end if;

  v_slots := public.phase4b_response_populated_slot_count (
    v_text,
    v_number,
    v_boolean,
    v_date,
    v_datetime,
    v_json
  );

  if v_slots > 1 then
    raise exception 'VALUE_SLOT_CONFLICT: at most one value_* slot allowed per field';
  end if;

  return jsonb_build_object(
    'source_field_id',
    p_item ->> 'source_field_id',
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
    v_json,
    'has_comment',
    nullif(trim(p_item ->> 'comments'), '') is not null
  );
end;
$$;

comment on function public.phase4b_parse_draft_response_item (jsonb) is
  'Normalizes one save_source_draft array element and enforces single value slot.';

-- Supporting index (idempotent)
create index if not exists source_responses_set_field_idx on public.source_responses (response_set_id, source_field_id);

-- ---------------------------------------------------------------------------
-- open_source_response_set
-- ---------------------------------------------------------------------------

create or replace function public.open_source_response_set (
  p_organization_id uuid,
  p_study_id uuid,
  p_study_version_id uuid,
  p_study_subject_id uuid,
  p_visit_id uuid,
  p_procedure_execution_id uuid,
  p_source_definition_version_id uuid
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_pe record;
  v_sdv record;
  v_visit record;
  v_set public.source_response_sets%rowtype;
  v_created boolean := false;
  v_fields jsonb;
  v_responses jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_study_id is null
  or p_study_subject_id is null
  or p_visit_id is null
  or p_procedure_execution_id is null
  or p_source_definition_version_id is null then
    raise exception 'INVALID_INPUT: organization, study, subject, visit, procedure_execution, and source_definition_version are required';
  end if;

  if not public.user_can_manage_subject_enrollment (p_study_id) then
    raise exception 'FORBIDDEN: caller cannot capture source for this study';
  end if;

  if public.phase4b_visit_is_locked (p_visit_id) then
    raise exception 'VISIT_LOCKED: cannot open source capture on a locked visit';
  end if;

  if not exists (
    select
      1
    from
      public.studies s
    where
      s.id = p_study_id
      and s.organization_id = p_organization_id
  ) then
    raise exception 'STUDY_TENANT_MISMATCH: study not in organization';
  end if;

  select
    pe.id,
    pe.organization_id,
    pe.study_id,
    pe.visit_id,
    pe.source_definition_version_id into v_pe
  from
    public.procedure_executions pe
  where
    pe.id = p_procedure_execution_id;

  if v_pe.id is null then
    raise exception 'NOT_FOUND: procedure_execution_id %', p_procedure_execution_id;
  end if;

  if v_pe.organization_id is distinct from p_organization_id
  or v_pe.study_id is distinct from p_study_id
  or v_pe.visit_id is distinct from p_visit_id then
    raise exception 'PROCEDURE_EXECUTION_MISMATCH: procedure execution does not match organization/study/visit';
  end if;

  select
    v.id,
    v.study_subject_id,
    v.organization_id,
    v.study_id into v_visit
  from
    public.visits v
  where
    v.id = p_visit_id;

  if v_visit.id is null then
    raise exception 'NOT_FOUND: visit_id %', p_visit_id;
  end if;

  if v_visit.study_subject_id is distinct from p_study_subject_id then
    raise exception 'VISIT_SUBJECT_MISMATCH: visit does not belong to study_subject_id';
  end if;

  select
    sdv.id,
    sdv.organization_id,
    sdv.study_id,
    sdv.study_version_id,
    sdv.lifecycle_status into v_sdv
  from
    public.source_definition_versions sdv
  where
    sdv.id = p_source_definition_version_id;

  if v_sdv.id is null then
    raise exception 'NOT_FOUND: source_definition_version_id %', p_source_definition_version_id;
  end if;

  if v_sdv.lifecycle_status is distinct from 'published' then
    raise exception 'SDV_NOT_PUBLISHED: source_definition_version must be published (got %)', v_sdv.lifecycle_status;
  end if;

  if v_sdv.organization_id is distinct from p_organization_id
  or v_sdv.study_id is distinct from p_study_id then
    raise exception 'SDV_STUDY_MISMATCH: source definition version does not match organization/study';
  end if;

  if v_sdv.study_version_id is not null
  and p_study_version_id is not null
  and v_sdv.study_version_id is distinct from p_study_version_id then
    raise exception 'SDV_STUDY_VERSION_MISMATCH: source_definition_version study_version_id mismatch';
  end if;

  if v_pe.source_definition_version_id is null then
    update public.procedure_executions
    set
      source_definition_version_id = p_source_definition_version_id
    where
      id = p_procedure_execution_id;
  elsif v_pe.source_definition_version_id is distinct from p_source_definition_version_id then
    raise exception 'SDV_MISMATCH: procedure_execution is bound to a different source_definition_version_id';
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.procedure_execution_id = p_procedure_execution_id
    and srs.source_definition_version_id = p_source_definition_version_id
    and srs.status <> 'archived'
  limit
    1;

  if v_set.id is null then
    insert into public.source_response_sets (
      organization_id,
      study_id,
      study_version_id,
      study_subject_id,
      visit_id,
      procedure_execution_id,
      source_definition_version_id,
      status,
      opened_by_user_id,
      opened_at
    )
    values (
      p_organization_id,
      p_study_id,
      p_study_version_id,
      p_study_subject_id,
      p_visit_id,
      p_procedure_execution_id,
      p_source_definition_version_id,
      'draft',
      v_uid,
      now()
    )
    returning
      * into v_set;

    v_created := true;
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_field_id',
          sf.id,
          'field_key',
          sf.field_key,
          'label',
          sf.label,
          'instructions',
          sf.instructions,
          'widget_hint',
          sf.widget_hint,
          'value_type',
          public.phase4b_widget_hint_to_value_type (sf.widget_hint),
          'is_required',
          sf.is_required,
          'sort_order',
          sf.sort_order
        )
        order by
          sf.sort_order,
          sf.field_key
      ),
      '[]'::jsonb
    ) into v_fields
  from
    public.source_fields sf
  where
    sf.source_definition_version_id = p_source_definition_version_id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'response_id',
          sr.id,
          'source_field_id',
          sr.source_field_id,
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
          sr.value_json,
          'is_submitted',
          sr.is_submitted,
          'is_current',
          sr.is_current,
          'response_sequence',
          sr.response_sequence,
          'captured_at',
          sr.captured_at
        )
        order by
          sr.source_field_id
      ),
      '[]'::jsonb
    ) into v_responses
  from
    public.source_responses sr
  where
    sr.response_set_id = v_set.id
    and sr.is_current = true;

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
      'created',
      v_created,
      'status',
      v_set.status,
      'source_definition_version_id',
      v_set.source_definition_version_id,
      'procedure_execution_id',
      v_set.procedure_execution_id,
      'opened_at',
      v_set.opened_at,
      'opened_by_user_id',
      v_set.opened_by_user_id,
      'fields',
      v_fields,
      'existing_responses',
      v_responses
    )
  );
end;
$$;

comment on function public.open_source_response_set (uuid, uuid, uuid, uuid, uuid, uuid, uuid) is
  'Phase 4B.1: Open or return active source_response_set for procedure execution + published SDV.';

-- ---------------------------------------------------------------------------
-- save_source_draft
-- ---------------------------------------------------------------------------

create or replace function public.save_source_draft (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_responses jsonb
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
    raise exception 'FORBIDDEN: caller cannot save source for this study';
  end if;

  if public.phase4b_visit_is_locked (v_set.visit_id) then
    raise exception 'VISIT_LOCKED: cannot save draft on a locked visit';
  end if;

  if not public.phase4b_srs_is_mutable_status (v_set.status) then
    raise exception 'SET_NOT_MUTABLE: response set status % does not allow draft save', v_set.status;
  end if;

  v_role := public.phase4b_resolve_originator_role (v_set.study_id);

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
        v_skipped := v_skipped + 1;
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

  if v_saved > 0
  and v_set.status = 'draft' then
    update public.source_response_sets
    set
      status = 'in_progress'
    where
      id = v_set.id
      and status = 'draft';

    v_set.status := 'in_progress';
  end if;

  return jsonb_build_object(
    'ok',
    jsonb_array_length (v_errors) = 0
    or v_saved > 0,
    'code',
    case
      when v_saved > 0 then 'SUCCESS'
      when jsonb_array_length (v_errors) > 0 then 'PARTIAL_FAILURE'
      else 'SUCCESS'
    end,
    'errors',
    v_errors,
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
      'responses',
      v_summaries
    )
  );
end;
$$;

comment on function public.save_source_draft (uuid, uuid, jsonb) is
  'Phase 4B.1: Upsert draft source_responses for a mutable response set. Operational events deferred to submit (0035).';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.phase4b_source_field_belongs_to_sdv (uuid, uuid) from public;
revoke all on function public.phase4b_widget_hint_to_value_type (text) from public;
revoke all on function public.phase4b_resolve_originator_role (uuid) from public;
revoke all on function public.phase4b_parse_draft_response_item (jsonb) from public;
revoke all on function public.open_source_response_set (uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public;
revoke all on function public.save_source_draft (uuid, uuid, jsonb) from public;

grant execute on function public.phase4b_source_field_belongs_to_sdv (uuid, uuid) to authenticated;
grant execute on function public.phase4b_widget_hint_to_value_type (text) to authenticated;
grant execute on function public.phase4b_resolve_originator_role (uuid) to authenticated;
grant execute on function public.phase4b_parse_draft_response_item (jsonb) to authenticated;
grant execute on function public.open_source_response_set (uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.save_source_draft (uuid, uuid, jsonb) to authenticated;
