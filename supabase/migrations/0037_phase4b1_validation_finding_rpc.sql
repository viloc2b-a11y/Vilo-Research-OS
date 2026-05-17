-- Phase 4B.1: validation finding lifecycle RPCs (create / acknowledge / resolve / waive).
-- Dependencies: 0020–0025, 0034–0036. Does not alter Phase 3C / 0026–0033 / published_*.

-- ---------------------------------------------------------------------------
-- Permission helpers + narrow RLS (monitor acknowledge; monitor resolve/waive)
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_user_can_resolve_validation_finding (_study_id uuid) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  public.phase4b_user_can_correct_source (_study_id)
  or public.user_is_study_admin (_study_id)
  or exists (
    select
      1
    from
      public.study_members sm
    where
      sm.study_id = _study_id
      and sm.user_id = auth.uid ()
      and sm.role = 'monitor'
  );
$$;

comment on function public.phase4b_user_can_resolve_validation_finding (uuid) is
  'study_admin/coordinator/org admin (correction path) or monitor may resolve/waive DQ findings.';

revoke all on function public.phase4b_user_can_resolve_validation_finding (uuid) from public;

grant execute on function public.phase4b_user_can_resolve_validation_finding (uuid) to authenticated;

drop policy if exists source_response_validation_findings_acknowledge on public.source_response_validation_findings;

create policy source_response_validation_findings_acknowledge on public.source_response_validation_findings for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_has_study_access (
    (
      select
        srs.study_id
      from
        public.source_response_sets srs
      where
        srs.id = response_set_id
    )
  )
  and status = 'open'
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and status = 'acknowledged'
  );

drop policy if exists source_response_validation_findings_resolve_waive on public.source_response_validation_findings;

create policy source_response_validation_findings_resolve_waive on public.source_response_validation_findings for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.phase4b_user_can_resolve_validation_finding (
    (
      select
        srs.study_id
      from
        public.source_response_sets srs
      where
        srs.id = response_set_id
    )
  )
  and status in ('open', 'acknowledged')
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and status in ('resolved', 'waived')
    and resolved_by_user_id is not null
    and resolved_at is not null
    and resolution_reason is not null
    and length(
      trim(
        both
        from
          resolution_reason
      )
    ) > 0
  );

-- ---------------------------------------------------------------------------
-- create_source_validation_finding
-- ---------------------------------------------------------------------------

create or replace function public.create_source_validation_finding (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_finding_type text,
  p_severity text,
  p_message text,
  p_source_response_id uuid default null,
  p_source_field_id uuid default null,
  p_rule_reference text default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_response public.source_responses%rowtype;
  v_finding_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
  v_rule_code text;
  v_field_id uuid;
  v_errors jsonb := '[]'::jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_source_response_set_id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'organization_id and source_response_set_id are required')
      ),
      'data',
      null
    );
  end if;

  if nullif(trim(p_finding_type), '') is null then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'FINDING_TYPE_REQUIRED', 'message', 'finding_type is required')
    );
  elsif p_finding_type not in ('range', 'required', 'consistency', 'format', 'custom') then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'FINDING_TYPE_INVALID', 'message', 'finding_type is not allowed')
    );
  end if;

  if nullif(trim(p_severity), '') is null then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'SEVERITY_REQUIRED', 'message', 'severity is required')
    );
  elsif p_severity not in ('info', 'warning', 'error') then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'SEVERITY_INVALID', 'message', 'severity must be info, warning, or error')
    );
  end if;

  if nullif(trim(p_message), '') is null then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'MESSAGE_REQUIRED', 'message', 'message is required')
    );
  end if;

  v_rule_code := coalesce(nullif(trim(p_rule_reference), ''), 'MANUAL');

  if jsonb_array_length (v_errors) > 0 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION_FAILED', 'errors', v_errors, 'data', null);
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = p_source_response_set_id;

  if v_set.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NOT_FOUND',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'NOT_FOUND', 'message', 'source_response_set_id not found')
      ),
      'data',
      null
    );
  end if;

  if v_set.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'ORGANIZATION_MISMATCH', 'message', 'response set does not belong to organization')
      ),
      'data',
      null
    );
  end if;

  if not public.user_can_manage_subject_enrollment (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot create validation findings for this study';
  end if;

  if v_set.status = 'archived' then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SET_ARCHIVED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'SET_ARCHIVED', 'message', 'cannot create findings on archived response set')
      ),
      'data',
      jsonb_build_object(
        'finding_id',
        null,
        'status',
        v_set.status,
        'source_response_set_id',
        v_set.id,
        'source_response_id',
        p_source_response_id,
        'source_field_id',
        p_source_field_id,
        'operational_event_id',
        null
      )
    );
  end if;

  v_field_id := p_source_field_id;

  if p_source_response_id is not null then
    select
      sr.* into v_response
    from
      public.source_responses sr
    where
      sr.id = p_source_response_id;

    if v_response.id is null then
      return jsonb_build_object(
        'ok',
        false,
        'code',
        'NOT_FOUND',
        'errors',
        jsonb_build_array(
          jsonb_build_object('code', 'RESPONSE_NOT_FOUND', 'message', 'source_response_id not found')
        ),
        'data',
        null
      );
    end if;

    if v_response.response_set_id is distinct from v_set.id then
      return jsonb_build_object(
        'ok',
        false,
        'code',
        'RESPONSE_SET_MISMATCH',
        'errors',
        jsonb_build_array(
          jsonb_build_object(
            'code',
            'RESPONSE_SET_MISMATCH',
            'message',
            'source_response_id does not belong to source_response_set_id'
          )
        ),
        'data',
        null
      );
    end if;

    if v_field_id is not null
    and v_field_id is distinct from v_response.source_field_id then
      return jsonb_build_object(
        'ok',
        false,
        'code',
        'FIELD_RESPONSE_MISMATCH',
        'errors',
        jsonb_build_array(
          jsonb_build_object(
            'code',
            'FIELD_RESPONSE_MISMATCH',
            'message',
            'source_field_id does not match source_response_id'
          )
        ),
        'data',
        null
      );
    end if;

    v_field_id := coalesce(v_field_id, v_response.source_field_id);
  end if;

  if v_field_id is not null
  and not public.phase4b_source_field_belongs_to_sdv (v_field_id, v_set.source_definition_version_id) then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SDV_FIELD_MISMATCH',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'SDV_FIELD_MISMATCH', 'message', 'source_field_id does not belong to bound source_definition_version')
      ),
      'data',
      null
    );
  end if;

  insert into public.source_response_validation_findings (
    organization_id,
    response_set_id,
    response_id,
    finding_type,
    severity,
    rule_code,
    message,
    status
  )
  values (
    p_organization_id,
    v_set.id,
    p_source_response_id,
    trim(p_finding_type),
    trim(p_severity),
    v_rule_code,
    trim(p_message),
    'open'
  )
  returning
    id into v_finding_id;

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
      'SOURCE_VALIDATION_FINDING_CREATED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'create_source_validation_finding_rpc',
          'finding_id',
          v_finding_id,
          'response_set_id',
          v_set.id,
          'response_id',
          p_source_response_id,
          'source_field_id',
          v_field_id,
          'finding_type',
          trim(p_finding_type),
          'severity',
          trim(p_severity),
          'rule_code',
          v_rule_code
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
      'finding_id',
      v_finding_id,
      'status',
      'open',
      'source_response_set_id',
      v_set.id,
      'source_response_id',
      p_source_response_id,
      'source_field_id',
      v_field_id,
      'operational_event_id',
      v_event_id
    )
  );
end;
$$;

comment on function public.create_source_validation_finding (
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text
) is
  'Insert open DQ/validation finding; does not mutate source_responses. Required args before optional (PG). p_rule_reference → rule_code.';

-- ---------------------------------------------------------------------------
-- acknowledge_source_validation_finding
-- ---------------------------------------------------------------------------

create or replace function public.acknowledge_source_validation_finding (
  p_organization_id uuid,
  p_finding_id uuid,
  p_comment text default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_finding public.source_response_validation_findings%rowtype;
  v_set public.source_response_sets%rowtype;
  v_field_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_finding_id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'organization_id and finding_id are required')
      ),
      'data',
      null
    );
  end if;

  select
    f.* into v_finding
  from
    public.source_response_validation_findings f
  where
    f.id = p_finding_id;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NOT_FOUND',
      'errors',
      jsonb_build_array(jsonb_build_object('code', 'NOT_FOUND', 'message', 'finding_id not found')),
      'data',
      null
    );
  end if;

  if v_finding.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'ORGANIZATION_MISMATCH', 'message', 'finding does not belong to organization')
      ),
      'data',
      null
    );
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = v_finding.response_set_id;

  if not public.user_has_study_access (v_set.study_id) then
    raise exception 'FORBIDDEN: caller lacks study access to acknowledge finding';
  end if;

  if v_finding.status in ('resolved', 'waived') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'FINDING_TERMINAL',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'FINDING_TERMINAL', 'message', 'cannot acknowledge terminal finding')
      ),
      'data',
      jsonb_build_object(
        'finding_id',
        v_finding.id,
        'status',
        v_finding.status,
        'source_response_set_id',
        v_finding.response_set_id,
        'source_response_id',
        v_finding.response_id,
        'source_field_id',
        null,
        'operational_event_id',
        null
      )
    );
  end if;

  if v_finding.status <> 'open' then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_STATUS_TRANSITION',
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_STATUS_TRANSITION',
          'message',
          format('acknowledge requires open status (current: %s)', v_finding.status)
        )
      ),
      'data',
      jsonb_build_object(
        'finding_id',
        v_finding.id,
        'status',
        v_finding.status,
        'source_response_set_id',
        v_finding.response_set_id,
        'source_response_id',
        v_finding.response_id,
        'source_field_id',
        null,
        'operational_event_id',
        null
      )
    );
  end if;

  if v_set.status = 'archived' then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SET_ARCHIVED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'SET_ARCHIVED', 'message', 'cannot acknowledge finding on archived response set')
      ),
      'data',
      null
    );
  end if;

  update public.source_response_validation_findings
  set
    status = 'acknowledged'
  where
    id = v_finding.id
    and status = 'open'
  returning
    * into v_finding;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'UPDATE_FAILED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'UPDATE_FAILED', 'message', 'finding status changed concurrently')
      ),
      'data',
      null
    );
  end if;

  if v_finding.response_id is not null then
    select
      sr.source_field_id into v_field_id
    from
      public.source_responses sr
    where
      sr.id = v_finding.response_id;
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
      'SOURCE_VALIDATION_FINDING_ACKNOWLEDGED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'acknowledge_source_validation_finding_rpc',
          'finding_id',
          v_finding.id,
          'response_set_id',
          v_finding.response_set_id,
          'response_id',
          v_finding.response_id,
          'comment',
          nullif(trim(p_comment), '')
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
      'finding_id',
      v_finding.id,
      'status',
      v_finding.status,
      'source_response_set_id',
      v_finding.response_set_id,
      'source_response_id',
      v_finding.response_id,
      'source_field_id',
      v_field_id,
      'operational_event_id',
      v_event_id
    )
  );
end;
$$;

comment on function public.acknowledge_source_validation_finding (uuid, uuid, text) is
  'Transition open → acknowledged; comment stored on operational event only.';

-- ---------------------------------------------------------------------------
-- resolve_source_validation_finding
-- ---------------------------------------------------------------------------

create or replace function public.resolve_source_validation_finding (
  p_organization_id uuid,
  p_finding_id uuid,
  p_resolution_comment text
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_finding public.source_response_validation_findings%rowtype;
  v_set public.source_response_sets%rowtype;
  v_field_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_finding_id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'organization_id and finding_id are required')
      ),
      'data',
      null
    );
  end if;

  if nullif(trim(p_resolution_comment), '') is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'RESOLUTION_COMMENT_REQUIRED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'RESOLUTION_COMMENT_REQUIRED', 'message', 'resolution_comment is required')
      ),
      'data',
      null
    );
  end if;

  select
    f.* into v_finding
  from
    public.source_response_validation_findings f
  where
    f.id = p_finding_id;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NOT_FOUND',
      'errors',
      jsonb_build_array(jsonb_build_object('code', 'NOT_FOUND', 'message', 'finding_id not found')),
      'data',
      null
    );
  end if;

  if v_finding.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'ORGANIZATION_MISMATCH', 'message', 'finding does not belong to organization')
      ),
      'data',
      null
    );
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = v_finding.response_set_id;

  if not public.phase4b_user_can_resolve_validation_finding (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot resolve validation findings for this study';
  end if;

  if v_finding.status in ('resolved', 'waived') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'FINDING_TERMINAL',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'FINDING_TERMINAL', 'message', 'finding is already terminal')
      ),
      'data',
      jsonb_build_object(
        'finding_id',
        v_finding.id,
        'status',
        v_finding.status,
        'source_response_set_id',
        v_finding.response_set_id,
        'source_response_id',
        v_finding.response_id,
        'source_field_id',
        null,
        'operational_event_id',
        null
      )
    );
  end if;

  if v_finding.status not in ('open', 'acknowledged') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_STATUS_TRANSITION',
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_STATUS_TRANSITION',
          'message',
          format('resolve requires open or acknowledged (current: %s)', v_finding.status)
        )
      ),
      'data',
      null
    );
  end if;

  if v_set.status = 'archived' then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SET_ARCHIVED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'SET_ARCHIVED', 'message', 'cannot resolve finding on archived response set')
      ),
      'data',
      null
    );
  end if;

  update public.source_response_validation_findings
  set
    status = 'resolved',
    resolved_by_user_id = v_uid,
    resolved_at = v_now,
    resolution_reason = trim(p_resolution_comment)
  where
    id = v_finding.id
    and status in ('open', 'acknowledged')
  returning
    * into v_finding;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'UPDATE_FAILED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'UPDATE_FAILED', 'message', 'finding status changed concurrently')
      ),
      'data',
      null
    );
  end if;

  if v_finding.response_id is not null then
    select
      sr.source_field_id into v_field_id
    from
      public.source_responses sr
    where
      sr.id = v_finding.response_id;
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
      'SOURCE_VALIDATION_FINDING_RESOLVED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'resolve_source_validation_finding_rpc',
          'finding_id',
          v_finding.id,
          'response_set_id',
          v_finding.response_set_id,
          'response_id',
          v_finding.response_id,
          'resolution_comment',
          trim(p_resolution_comment)
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
      'finding_id',
      v_finding.id,
      'status',
      v_finding.status,
      'source_response_set_id',
      v_finding.response_set_id,
      'source_response_id',
      v_finding.response_id,
      'source_field_id',
      v_field_id,
      'operational_event_id',
      v_event_id
    )
  );
end;
$$;

comment on function public.resolve_source_validation_finding (uuid, uuid, text) is
  'Transition open/acknowledged → resolved with attribution; does not mutate source_responses.';

-- ---------------------------------------------------------------------------
-- waive_source_validation_finding
-- ---------------------------------------------------------------------------

create or replace function public.waive_source_validation_finding (
  p_organization_id uuid,
  p_finding_id uuid,
  p_waiver_reason text
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_finding public.source_response_validation_findings%rowtype;
  v_set public.source_response_sets%rowtype;
  v_field_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null
  or p_finding_id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'organization_id and finding_id are required')
      ),
      'data',
      null
    );
  end if;

  if nullif(trim(p_waiver_reason), '') is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'WAIVER_REASON_REQUIRED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'WAIVER_REASON_REQUIRED', 'message', 'waiver_reason is required')
      ),
      'data',
      null
    );
  end if;

  select
    f.* into v_finding
  from
    public.source_response_validation_findings f
  where
    f.id = p_finding_id;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NOT_FOUND',
      'errors',
      jsonb_build_array(jsonb_build_object('code', 'NOT_FOUND', 'message', 'finding_id not found')),
      'data',
      null
    );
  end if;

  if v_finding.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'ORGANIZATION_MISMATCH', 'message', 'finding does not belong to organization')
      ),
      'data',
      null
    );
  end if;

  select
    srs.* into v_set
  from
    public.source_response_sets srs
  where
    srs.id = v_finding.response_set_id;

  if not public.phase4b_user_can_resolve_validation_finding (v_set.study_id) then
    raise exception 'FORBIDDEN: caller cannot waive validation findings for this study';
  end if;

  if v_finding.status in ('resolved', 'waived') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'FINDING_TERMINAL',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'FINDING_TERMINAL', 'message', 'finding is already terminal')
      ),
      'data',
      jsonb_build_object(
        'finding_id',
        v_finding.id,
        'status',
        v_finding.status,
        'source_response_set_id',
        v_finding.response_set_id,
        'source_response_id',
        v_finding.response_id,
        'source_field_id',
        null,
        'operational_event_id',
        null
      )
    );
  end if;

  if v_finding.status not in ('open', 'acknowledged') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_STATUS_TRANSITION',
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_STATUS_TRANSITION',
          'message',
          format('waive requires open or acknowledged (current: %s)', v_finding.status)
        )
      ),
      'data',
      null
    );
  end if;

  if v_set.status = 'archived' then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SET_ARCHIVED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'SET_ARCHIVED', 'message', 'cannot waive finding on archived response set')
      ),
      'data',
      null
    );
  end if;

  update public.source_response_validation_findings
  set
    status = 'waived',
    resolved_by_user_id = v_uid,
    resolved_at = v_now,
    resolution_reason = trim(p_waiver_reason)
  where
    id = v_finding.id
    and status in ('open', 'acknowledged')
  returning
    * into v_finding;

  if v_finding.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'UPDATE_FAILED',
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'UPDATE_FAILED', 'message', 'finding status changed concurrently')
      ),
      'data',
      null
    );
  end if;

  if v_finding.response_id is not null then
    select
      sr.source_field_id into v_field_id
    from
      public.source_responses sr
    where
      sr.id = v_finding.response_id;
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
      'SOURCE_VALIDATION_FINDING_WAIVED',
      jsonb_strip_nulls(
        jsonb_build_object(
          'source',
          'waive_source_validation_finding_rpc',
          'finding_id',
          v_finding.id,
          'response_set_id',
          v_finding.response_set_id,
          'response_id',
          v_finding.response_id,
          'waiver_reason',
          trim(p_waiver_reason)
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
      'finding_id',
      v_finding.id,
      'status',
      v_finding.status,
      'source_response_set_id',
      v_finding.response_set_id,
      'source_response_id',
      v_finding.response_id,
      'source_field_id',
      v_field_id,
      'operational_event_id',
      v_event_id
    )
  );
end;
$$;

comment on function public.waive_source_validation_finding (uuid, uuid, text) is
  'Transition open/acknowledged → waived with reason; does not mutate source_responses.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_source_validation_finding (
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text
) from public;

revoke all on function public.acknowledge_source_validation_finding (uuid, uuid, text) from public;

revoke all on function public.resolve_source_validation_finding (uuid, uuid, text) from public;

revoke all on function public.waive_source_validation_finding (uuid, uuid, text) from public;

grant execute on function public.create_source_validation_finding (
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text
) to authenticated;

grant execute on function public.acknowledge_source_validation_finding (uuid, uuid, text) to authenticated;

grant execute on function public.resolve_source_validation_finding (uuid, uuid, text) to authenticated;

grant execute on function public.waive_source_validation_finding (uuid, uuid, text) to authenticated;
