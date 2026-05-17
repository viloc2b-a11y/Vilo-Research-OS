-- Phase 5.1C — Canonical read RPCs for source response sets (reconstruction layer).
-- Does NOT alter 0036/0037/0040 write or history RPC bodies.

-- ---------------------------------------------------------------------------
-- Helpers — typed value payload for read models (no business rules)
-- ---------------------------------------------------------------------------

create or replace function public.phase51c_source_response_value_json (
  _value_type text,
  _value_text text,
  _value_number numeric,
  _value_boolean boolean,
  _value_date date,
  _value_datetime timestamptz,
  _value_json jsonb
) returns jsonb language sql immutable security invoker
set
  search_path = public as $$
  select
    jsonb_strip_nulls(
      jsonb_build_object(
        'value_type',
        _value_type,
        'value_text',
        _value_text,
        'value_number',
        _value_number,
        'value_boolean',
        _value_boolean,
        'value_date',
        _value_date,
        'value_datetime',
        _value_datetime,
        'value_json',
        _value_json
      )
    );
$$;

comment on function public.phase51c_source_response_value_json (text, text, numeric, boolean, date, timestamptz, jsonb) is
  'Read-model helper: expose captured slots without route-layer shaping.';

revoke all on function public.phase51c_source_response_value_json (text, text, numeric, boolean, date, timestamptz, jsonb) from public;

grant execute on function public.phase51c_source_response_value_json (text, text, numeric, boolean, date, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- get_source_response_set — full canonical reconstruction
-- ---------------------------------------------------------------------------

create or replace function public.get_source_response_set (
  p_organization_id uuid,
  p_source_response_set_id uuid
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_fields jsonb;
  v_corrections jsonb;
  v_addenda jsonb;
  v_findings_summary jsonb;
  v_now timestamptz := now();
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_INPUT',
          'message',
          'organization_id and source_response_set_id are required'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set', 'timestamp', v_now)
    );
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'NOT_FOUND', 'message', 'source_response_set_id not found')
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set', 'timestamp', v_now)
    );
  end if;

  if v_set.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'ORGANIZATION_MISMATCH',
          'message',
          'response set does not belong to organization'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set', 'timestamp', v_now)
    );
  end if;

  if not public.user_has_study_access (v_set.study_id)
  and not public.user_is_org_admin (v_set.organization_id) then
    raise exception 'FORBIDDEN: caller lacks access to this response set';
  end if;

  with
    response_history as (
      select
        sr.source_field_id,
        jsonb_agg(
          jsonb_build_object(
            'response_id',
            sr.id,
            'response_sequence',
            sr.response_sequence,
            'is_current',
            sr.is_current,
            'is_submitted',
            sr.is_submitted,
            'captured_at',
            sr.captured_at,
            'submitted_at',
            sr.submitted_at,
            'originator_user_id',
            sr.originator_user_id,
            'originator_role',
            sr.originator_role,
            'supersedes_response_id',
            sr.supersedes_response_id,
            'correction_chain_root_id',
            sr.correction_chain_root_id,
            'raw_value',
            public.phase51c_source_response_value_json (
              sr.value_type,
              sr.value_text,
              sr.value_number,
              sr.value_boolean,
              sr.value_date,
              sr.value_datetime,
              sr.value_json
            )
          )
          order by
            sr.response_sequence
        ) as history
      from
        public.source_responses sr
      where
        sr.response_set_id = v_set.id
      group by
        sr.source_field_id
    )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_field_id',
          sf.id,
          'field_key',
          sf.field_key,
          'widget_hint',
          sf.widget_hint,
          'is_required',
          sf.is_required,
          'current_effective',
          (
            select
              jsonb_build_object(
                'response_id',
                cur.id,
                'response_sequence',
                cur.response_sequence,
                'is_submitted',
                cur.is_submitted,
                'captured_at',
                cur.captured_at,
                'submitted_at',
                cur.submitted_at,
                'originator_user_id',
                cur.originator_user_id,
                'originator_role',
                cur.originator_role,
                'supersedes_response_id',
                cur.supersedes_response_id,
                'value',
                public.phase51c_source_response_value_json (
                  cur.value_type,
                  cur.value_text,
                  cur.value_number,
                  cur.value_boolean,
                  cur.value_date,
                  cur.value_datetime,
                  cur.value_json
                )
              )
            from
              public.source_responses cur
            where
              cur.response_set_id = v_set.id
              and cur.source_field_id = sf.id
              and cur.is_current = true
            limit
              1
          ),
          'history',
          coalesce(rh.history, '[]'::jsonb)
        )
        order by
          sf.field_key
      ),
      '[]'::jsonb
    ) into v_fields
  from
    public.source_fields sf
    left join response_history rh on rh.source_field_id = sf.id
  where
    sf.source_definition_version_id = v_set.source_definition_version_id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'correction_id',
          c.id,
          'correction_type',
          c.correction_type,
          'correction_reason',
          c.correction_reason,
          'prior_value_reference',
          c.prior_value_reference,
          'corrected_at',
          c.corrected_at,
          'corrected_by_user_id',
          c.corrected_by_user_id,
          'superseded_response_id',
          c.superseded_response_id,
          'replacement_response_id',
          c.response_id,
          'source_field_id',
          old_sr.source_field_id,
          'prior_value',
          public.phase51c_source_response_value_json (
            old_sr.value_type,
            old_sr.value_text,
            old_sr.value_number,
            old_sr.value_boolean,
            old_sr.value_date,
            old_sr.value_datetime,
            old_sr.value_json
          ),
          'corrected_value',
          public.phase51c_source_response_value_json (
            new_sr.value_type,
            new_sr.value_text,
            new_sr.value_number,
            new_sr.value_boolean,
            new_sr.value_date,
            new_sr.value_datetime,
            new_sr.value_json
          ),
          'operational_event_id',
          c.operational_event_id
        )
        order by
          c.corrected_at
      ),
      '[]'::jsonb
    ) into v_corrections
  from
    public.source_response_corrections c
    join public.source_responses old_sr on old_sr.id = c.superseded_response_id
    join public.source_responses new_sr on new_sr.id = c.response_id
  where
    old_sr.response_set_id = v_set.id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'addendum_id',
          a.id,
          'introduced_source_field_id',
          a.introduced_source_field_id,
          'field_key',
          sf.field_key,
          'late_entry_reason',
          a.late_entry_reason,
          'added_at',
          a.added_at,
          'added_by_user_id',
          a.added_by_user_id,
          'introduced_by_source_definition_version_id',
          a.introduced_by_source_definition_version_id,
          'applied_to_source_definition_version_id',
          a.applied_to_source_definition_version_id,
          'response_id',
          a.response_id,
          'structured_payload',
          case
            when resp.id is null then null
            else public.phase51c_source_response_value_json (
              resp.value_type,
              resp.value_text,
              resp.value_number,
              resp.value_boolean,
              resp.value_date,
              resp.value_datetime,
              resp.value_json
            )
          end,
          'operational_event_id',
          a.operational_event_id
        )
        order by
          a.added_at
      ),
      '[]'::jsonb
    ) into v_addenda
  from
    public.source_response_addenda a
    join public.source_fields sf on sf.id = a.introduced_source_field_id
    left join public.source_responses resp on resp.id = a.response_id
  where
    a.response_set_id = v_set.id;

  select
    jsonb_build_object(
      'active',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'finding_id',
                f.id,
                'finding_type',
                f.finding_type,
                'severity',
                f.severity,
                'rule_code',
                f.rule_code,
                'message',
                f.message,
                'status',
                f.status,
                'response_id',
                f.response_id,
                'created_at',
                f.created_at
              )
              order by
                f.created_at desc
            )
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status in ('open', 'acknowledged')
        ),
        '[]'::jsonb
      ),
      'counts',
      jsonb_build_object(
        'total',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
        ),
        'open',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status = 'open'
        ),
        'acknowledged',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status = 'acknowledged'
        ),
        'resolved',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status = 'resolved'
        ),
        'waived',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status = 'waived'
        ),
        'severity',
        jsonb_build_object(
          'info',
          (
            select
              count(*)::int
            from
              public.source_response_validation_findings f
            where
              f.response_set_id = v_set.id
              and f.severity = 'info'
          ),
          'warning',
          (
            select
              count(*)::int
            from
              public.source_response_validation_findings f
            where
              f.response_set_id = v_set.id
              and f.severity = 'warning'
          ),
          'error',
          (
            select
              count(*)::int
            from
              public.source_response_validation_findings f
            where
              f.response_set_id = v_set.id
              and f.severity = 'error'
          )
        )
      )
    ) into v_findings_summary;

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'SUCCESS',
    'data',
    jsonb_build_object(
      'response_set',
      jsonb_build_object(
        'id',
        v_set.id,
        'organization_id',
        v_set.organization_id,
        'study_id',
        v_set.study_id,
        'study_version_id',
        v_set.study_version_id,
        'study_subject_id',
        v_set.study_subject_id,
        'visit_id',
        v_set.visit_id,
        'procedure_execution_id',
        v_set.procedure_execution_id,
        'source_definition_version_id',
        v_set.source_definition_version_id,
        'status',
        v_set.status,
        'source_origin',
        v_set.source_origin,
        'opened_by_user_id',
        v_set.opened_by_user_id,
        'opened_at',
        v_set.opened_at,
        'submitted_by_user_id',
        v_set.submitted_by_user_id,
        'submitted_at',
        v_set.submitted_at,
        'reviewed_by_user_id',
        v_set.reviewed_by_user_id,
        'reviewed_at',
        v_set.reviewed_at,
        'signed_by_user_id',
        v_set.signed_by_user_id,
        'signed_at',
        v_set.signed_at,
        'locked_by_user_id',
        v_set.locked_by_user_id,
        'locked_at',
        v_set.locked_at,
        'created_at',
        v_set.created_at,
        'updated_at',
        v_set.updated_at
      ),
      'fields',
      v_fields,
      'corrections',
      v_corrections,
      'addenda',
      v_addenda,
      'findings_summary',
      v_findings_summary,
      'placeholders',
      jsonb_build_object(
        'signatures',
        null,
        'reviews',
        null,
        'sdv',
        jsonb_build_object('status', 'not_implemented', 'message', 'SDV lane reserved for Phase 4E+'),
        'verification',
        jsonb_build_object('status', 'not_implemented', 'message', 'Field verification reserved for future release')
      ),
      'lineage',
      jsonb_build_object(
        'immutable_append_only',
        true,
        'history_rpc',
        'get_source_response_set_history',
        'chronology_ref',
        jsonb_build_object(
          'organization_id',
          v_set.organization_id,
          'source_response_set_id',
          v_set.id
        )
      )
    ),
    'errors',
    '[]'::jsonb,
    'warnings',
    '[]'::jsonb,
    'meta',
    jsonb_build_object(
      'source',
      'rpc',
      'rpc',
      'get_source_response_set',
      'timestamp',
      v_now,
      'actor_user_id',
      v_uid
    )
  );
end;
$$;

comment on function public.get_source_response_set (uuid, uuid) is
  'Canonical read reconstruction for a source_response_set (metadata, per-field history, corrections, addenda, findings summary).';

-- ---------------------------------------------------------------------------
-- get_source_response_set_manifest — lightweight operational status
-- ---------------------------------------------------------------------------

create or replace function public.get_source_response_set_manifest (
  p_organization_id uuid,
  p_source_response_set_id uuid
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_required_total int;
  v_required_captured int;
  v_latest_at timestamptz;
  v_latest_kind text;
  v_now timestamptz := now();
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_INPUT',
          'message',
          'organization_id and source_response_set_id are required'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_manifest', 'timestamp', v_now)
    );
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'NOT_FOUND', 'message', 'source_response_set_id not found')
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_manifest', 'timestamp', v_now)
    );
  end if;

  if v_set.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'ORGANIZATION_MISMATCH',
          'message',
          'response set does not belong to organization'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_manifest', 'timestamp', v_now)
    );
  end if;

  if not public.user_has_study_access (v_set.study_id)
  and not public.user_is_org_admin (v_set.organization_id) then
    raise exception 'FORBIDDEN: caller lacks access to this response set manifest';
  end if;

  select
    count(*)::int into v_required_total
  from
    public.source_fields sf
  where
    sf.source_definition_version_id = v_set.source_definition_version_id
    and sf.is_required = true;

  select
    count(distinct sr.source_field_id)::int into v_required_captured
  from
    public.source_responses sr
    join public.source_fields sf on sf.id = sr.source_field_id
  where
    sr.response_set_id = v_set.id
    and sr.is_current = true
    and sr.is_submitted = true
    and sf.is_required = true
    and public.phase4b_response_populated_slot_count (
      sr.value_text,
      sr.value_number,
      sr.value_boolean,
      sr.value_date,
      sr.value_datetime,
      sr.value_json
    ) = 1;

  select
    x.occurred_at,
    x.event_kind into v_latest_at,
    v_latest_kind
  from
    (
      select
        v_set.updated_at as occurred_at,
        'response_set_updated'::text as event_kind
      union all
      select
        v_set.submitted_at,
        'response_set_submitted'
      where
        v_set.submitted_at is not null
      union all
      select
        c.corrected_at,
        'correction'
      from
        public.source_response_corrections c
        join public.source_responses sr on sr.id = c.superseded_response_id
      where
        sr.response_set_id = v_set.id
      union all
      select
        a.added_at,
        'addendum'
      from
        public.source_response_addenda a
      where
        a.response_set_id = v_set.id
      union all
      select
        f.created_at,
        'finding_created'
      from
        public.source_response_validation_findings f
      where
        f.response_set_id = v_set.id
    ) x
  where
    x.occurred_at is not null
  order by
    x.occurred_at desc
  limit
    1;

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'SUCCESS',
    'data',
    jsonb_build_object(
      'source_response_set_id',
      v_set.id,
      'organization_id',
      v_set.organization_id,
      'study_id',
      v_set.study_id,
      'status',
      v_set.status,
      'timestamps',
      jsonb_build_object(
        'opened_at',
        v_set.opened_at,
        'submitted_at',
        v_set.submitted_at,
        'reviewed_at',
        v_set.reviewed_at,
        'signed_at',
        v_set.signed_at,
        'locked_at',
        v_set.locked_at,
        'updated_at',
        v_set.updated_at
      ),
      'completeness',
      jsonb_build_object(
        'required_fields_total',
        v_required_total,
        'required_fields_captured_current',
        v_required_captured,
        'is_submitted',
        v_set.status in ('submitted', 'pending_review', 'reviewed', 'signed', 'locked', 'corrected', 'addended')
      ),
      'counts',
      jsonb_build_object(
        'responses_current',
        (
          select
            count(*)::int
          from
            public.source_responses sr
          where
            sr.response_set_id = v_set.id
            and sr.is_current = true
        ),
        'responses_total',
        (
          select
            count(*)::int
          from
            public.source_responses sr
          where
            sr.response_set_id = v_set.id
        ),
        'corrections',
        (
          select
            count(*)::int
          from
            public.source_response_corrections c
          join public.source_responses sr on sr.id = c.superseded_response_id
          where
            sr.response_set_id = v_set.id
        ),
        'addenda',
        (
          select
            count(*)::int
          from
            public.source_response_addenda a
          where
            a.response_set_id = v_set.id
        ),
        'findings_total',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
        ),
        'findings_active',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status in ('open', 'acknowledged')
        ),
        'findings_open',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f
          where
            f.response_set_id = v_set.id
            and f.status = 'open'
        )
      ),
      'latest_activity',
      jsonb_build_object(
        'occurred_at',
        v_latest_at,
        'event_kind',
        v_latest_kind
      ),
      'lineage_refs',
      jsonb_build_object(
        'source_definition_version_id',
        v_set.source_definition_version_id,
        'procedure_execution_id',
        v_set.procedure_execution_id,
        'visit_id',
        v_set.visit_id,
        'study_subject_id',
        v_set.study_subject_id,
        'history_rpc',
        'get_source_response_set_history',
        'detail_rpc',
        'get_source_response_set'
      ),
      'chronology_checksum',
      null
    ),
    'errors',
    '[]'::jsonb,
    'warnings',
    '[]'::jsonb,
    'meta',
    jsonb_build_object(
      'source',
      'rpc',
      'rpc',
      'get_source_response_set_manifest',
      'timestamp',
      v_now,
      'actor_user_id',
      v_uid
    )
  );
end;
$$;

comment on function public.get_source_response_set_manifest (uuid, uuid) is
  'Lightweight operational manifest for a source_response_set (no full field payloads).';

-- ---------------------------------------------------------------------------
-- list_source_response_set_findings — operational findings review
-- ---------------------------------------------------------------------------

create or replace function public.list_source_response_set_findings (
  p_organization_id uuid,
  p_source_response_set_id uuid,
  p_active_only boolean default null,
  p_status text default null,
  p_severity text default null
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_findings jsonb;
  v_now timestamptz := now();
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'INVALID_INPUT',
          'message',
          'organization_id and source_response_set_id are required'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'list_source_response_set_findings', 'timestamp', v_now)
    );
  end if;

  if p_status is not null
  and p_status not in ('open', 'acknowledged', 'resolved', 'waived') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'invalid status filter')
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'list_source_response_set_findings', 'timestamp', v_now)
    );
  end if;

  if p_severity is not null
  and p_severity not in ('info', 'warning', 'error') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'INVALID_INPUT',
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'INVALID_INPUT', 'message', 'invalid severity filter')
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'list_source_response_set_findings', 'timestamp', v_now)
    );
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
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object('code', 'NOT_FOUND', 'message', 'source_response_set_id not found')
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'list_source_response_set_findings', 'timestamp', v_now)
    );
  end if;

  if v_set.organization_id is distinct from p_organization_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'ORGANIZATION_MISMATCH',
      'data',
      null,
      'errors',
      jsonb_build_array(
        jsonb_build_object(
          'code',
          'ORGANIZATION_MISMATCH',
          'message',
          'response set does not belong to organization'
        )
      ),
      'warnings',
      '[]'::jsonb,
      'meta',
      jsonb_build_object('source', 'rpc', 'rpc', 'list_source_response_set_findings', 'timestamp', v_now)
    );
  end if;

  if not public.user_has_study_access (v_set.study_id)
  and not public.user_is_org_admin (v_set.organization_id) then
    raise exception 'FORBIDDEN: caller lacks access to this response set findings';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'finding_id',
          f.id,
          'finding_type',
          f.finding_type,
          'severity',
          f.severity,
          'rule_code',
          f.rule_code,
          'message',
          f.message,
          'status',
          f.status,
          'response_id',
          f.response_id,
          'source_field_id',
          (
            select
              sr.source_field_id
            from
              public.source_responses sr
            where
              sr.id = f.response_id
          ),
          'created_at',
          f.created_at,
          'resolved_by_user_id',
          f.resolved_by_user_id,
          'resolved_at',
          f.resolved_at,
          'resolution_reason',
          f.resolution_reason,
          'lifecycle_events',
          coalesce(
            (
              select
                jsonb_agg(
                  jsonb_build_object(
                    'event_id',
                    e.id,
                    'prior_status',
                    e.prior_status,
                    'new_status',
                    e.new_status,
                    'actor_user_id',
                    e.actor_user_id,
                    'reason',
                    e.reason,
                    'occurred_at',
                    e.occurred_at,
                    'operational_event_id',
                    e.operational_event_id
                  )
                  order by
                    e.occurred_at
                )
              from
                public.source_response_validation_finding_events e
              where
                e.finding_id = f.id
            ),
            '[]'::jsonb
          )
        )
        order by
          f.created_at desc
      ),
      '[]'::jsonb
    ) into v_findings
  from
    public.source_response_validation_findings f
  where
    f.response_set_id = v_set.id
    and (
      p_status is null
      or f.status = p_status
    )
    and (
      p_severity is null
      or f.severity = p_severity
    )
    and (
      coalesce(p_active_only, false) = false
      or f.status in ('open', 'acknowledged')
    );

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'SUCCESS',
    'data',
    jsonb_build_object(
      'source_response_set_id',
      v_set.id,
      'organization_id',
      v_set.organization_id,
      'filters_applied',
      jsonb_build_object(
        'active_only',
        coalesce(p_active_only, false),
        'status',
        p_status,
        'severity',
        p_severity
      ),
      'findings',
      v_findings,
      'counts',
      jsonb_build_object(
        'returned',
        jsonb_array_length(v_findings),
        'total_in_set',
        (
          select
            count(*)::int
          from
            public.source_response_validation_findings f2
          where
            f2.response_set_id = v_set.id
        )
      )
    ),
    'errors',
    '[]'::jsonb,
    'warnings',
    '[]'::jsonb,
    'meta',
    jsonb_build_object(
      'source',
      'rpc',
      'rpc',
      'list_source_response_set_findings',
      'timestamp',
      v_now,
      'actor_user_id',
      v_uid
    )
  );
end;
$$;

comment on function public.list_source_response_set_findings (uuid, uuid, boolean, text, text) is
  'List validation findings for a response set with optional status/severity filters and lifecycle events.';

revoke all on function public.get_source_response_set (uuid, uuid) from public;

revoke all on function public.get_source_response_set_manifest (uuid, uuid) from public;

revoke all on function public.list_source_response_set_findings (uuid, uuid, boolean, text, text) from public;

grant execute on function public.get_source_response_set (uuid, uuid) to authenticated;

grant execute on function public.get_source_response_set_manifest (uuid, uuid) to authenticated;

grant execute on function public.list_source_response_set_findings (uuid, uuid, boolean, text, text) to authenticated;
