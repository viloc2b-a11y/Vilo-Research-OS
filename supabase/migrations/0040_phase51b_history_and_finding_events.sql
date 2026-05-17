-- Phase 5.1B Step 1 — Immutable history reconstruction + append-only finding lifecycle events.
-- Does NOT replace or rewrite 0036/0037 RPC bodies (correct, addendum, findings remain GREEN).
-- Adds: source_response_validation_finding_events, get_source_response_set_history.

-- ---------------------------------------------------------------------------
-- Append-only finding lifecycle events (supplements in-place status on findings row)
-- ---------------------------------------------------------------------------

create table if not exists public.source_response_validation_finding_events (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  finding_id uuid not null references public.source_response_validation_findings (id) on delete cascade,
  response_set_id uuid not null references public.source_response_sets (id) on delete cascade,
  prior_status text,
  new_status text not null check (
    new_status in ('open', 'acknowledged', 'resolved', 'waived')
  ),
  actor_user_id uuid not null references auth.users (id),
  reason text,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint source_response_validation_finding_events_reason_on_terminal check (
    new_status in ('open', 'acknowledged')
    or (
      reason is not null
      and length(
        trim(
          both
          from
            reason
        )
      ) > 0
    )
  )
);

comment on table public.source_response_validation_finding_events is
  'Append-only finding state transitions for audit replay. Current status remains on source_response_validation_findings.';

create index if not exists source_response_validation_finding_events_set_occurred_idx on public.source_response_validation_finding_events (response_set_id, occurred_at);

create index if not exists source_response_validation_finding_events_finding_idx on public.source_response_validation_finding_events (finding_id, occurred_at);

create or replace function public.phase4b_log_validation_finding_lifecycle_event () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'AUTH_REQUIRED: authenticated user required for finding lifecycle event';
  end if;

  if tg_op = 'INSERT' then
    insert into public.source_response_validation_finding_events (
      organization_id,
      finding_id,
      response_set_id,
      prior_status,
      new_status,
      actor_user_id,
      reason
    )
    values (
      new.organization_id,
      new.id,
      new.response_set_id,
      null,
      new.status,
      v_actor,
      trim(new.message)
    );
    return new;
  end if;

  if tg_op = 'UPDATE'
  and old.status is distinct from new.status then
    insert into public.source_response_validation_finding_events (
      organization_id,
      finding_id,
      response_set_id,
      prior_status,
      new_status,
      actor_user_id,
      reason
    )
    values (
      new.organization_id,
      new.id,
      new.response_set_id,
      old.status,
      new.status,
      v_actor,
      coalesce(
        nullif(trim(new.resolution_reason), ''),
        nullif(trim(new.message), '')
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists source_response_validation_findings_lifecycle_log on public.source_response_validation_findings;

create trigger source_response_validation_findings_lifecycle_log
after insert
or
update of status,
resolution_reason on public.source_response_validation_findings for each row
execute function public.phase4b_log_validation_finding_lifecycle_event ();

alter table public.source_response_validation_finding_events enable row level security;

drop policy if exists source_response_validation_finding_events_select on public.source_response_validation_finding_events;

create policy source_response_validation_finding_events_select on public.source_response_validation_finding_events for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (
          select
            srs.study_id
          from
            public.source_response_sets srs
          where
            srs.id = response_set_id
        )
      )
    )
  );

-- INSERT only via trigger (SECURITY DEFINER). No UPDATE/DELETE policies.

-- ---------------------------------------------------------------------------
-- get_source_response_set_history — chronological immutable reconstruction (read)
-- ---------------------------------------------------------------------------

create or replace function public.get_source_response_set_history (
  p_organization_id uuid,
  p_source_response_set_id uuid
) returns jsonb language plpgsql security invoker
set
  search_path = public as $$
declare
  v_uid uuid;
  v_set public.source_response_sets%rowtype;
  v_events jsonb;
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
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_history', 'timestamp', v_now)
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
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_history', 'timestamp', v_now)
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
      jsonb_build_object('source', 'rpc', 'rpc', 'get_source_response_set_history', 'timestamp', v_now)
    );
  end if;

  if not public.user_has_study_access (v_set.study_id)
  and not public.user_is_org_admin (v_set.organization_id) then
    raise exception 'FORBIDDEN: caller lacks access to this response set history';
  end if;

  with
    timeline as (
      select
        v_set.opened_at as occurred_at,
        'response_set_opened'::text as event_kind,
        v_set.opened_by_user_id as actor_user_id,
        jsonb_build_object(
          'source_response_set_id',
          v_set.id,
          'status',
          'draft',
          'visit_id',
          v_set.visit_id,
          'procedure_execution_id',
          v_set.procedure_execution_id,
          'study_subject_id',
          v_set.study_subject_id
        ) as payload
      where
        v_set.opened_at is not null
      union all
      select
        v_set.submitted_at,
        'response_set_submitted',
        v_set.submitted_by_user_id,
        jsonb_build_object(
          'source_response_set_id',
          v_set.id,
          'status',
          v_set.status,
          'submitted_at',
          v_set.submitted_at
        )
      where
        v_set.submitted_at is not null
      union all
      select
        oe.occurred_at,
        oe.event_type,
        oe.actor_user_id,
        oe.payload
      from
        public.operational_events oe
      where
        oe.procedure_execution_id = v_set.procedure_execution_id
        and oe.visit_id = v_set.visit_id
        and oe.event_type in (
          'SOURCE_RESPONSE_SET_SUBMITTED',
          'SOURCE_RESPONSE_CORRECTED',
          'SOURCE_RESPONSE_ADDENDUM_ADDED',
          'SOURCE_VALIDATION_FINDING_CREATED',
          'SOURCE_VALIDATION_FINDING_ACKNOWLEDGED',
          'SOURCE_VALIDATION_FINDING_RESOLVED',
          'SOURCE_VALIDATION_FINDING_WAIVED'
        )
      union all
      select
        src.corrected_at,
        'source_response_corrected',
        src.corrected_by_user_id,
        jsonb_build_object(
          'correction_id',
          src.id,
          'superseded_response_id',
          src.superseded_response_id,
          'replacement_response_id',
          src.response_id,
          'correction_type',
          src.correction_type,
          'correction_reason',
          src.correction_reason,
          'prior_value_reference',
          src.prior_value_reference,
          'operational_event_id',
          src.operational_event_id
        )
      from
        public.source_response_corrections src
        join public.source_responses sr on sr.id = src.superseded_response_id
      where
        sr.response_set_id = v_set.id
      union all
      select
        sra.added_at,
        'source_addendum_added',
        sra.added_by_user_id,
        jsonb_build_object(
          'addendum_id',
          sra.id,
          'introduced_source_field_id',
          sra.introduced_source_field_id,
          'introduced_by_source_definition_version_id',
          sra.introduced_by_source_definition_version_id,
          'applied_to_source_definition_version_id',
          sra.applied_to_source_definition_version_id,
          'response_id',
          sra.response_id,
          'late_entry_reason',
          sra.late_entry_reason,
          'operational_event_id',
          sra.operational_event_id
        )
      from
        public.source_response_addenda sra
      where
        sra.response_set_id = v_set.id
      union all
      select
        fe.occurred_at,
        'validation_finding_' || fe.new_status,
        fe.actor_user_id,
        jsonb_build_object(
          'finding_id',
          fe.finding_id,
          'prior_status',
          fe.prior_status,
          'new_status',
          fe.new_status,
          'reason',
          fe.reason,
          'operational_event_id',
          fe.operational_event_id
        )
      from
        public.source_response_validation_finding_events fe
      where
        fe.response_set_id = v_set.id
      union all
      select
        f.created_at,
        'validation_finding_recorded',
        null::uuid,
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
          f.response_id
        )
      from
        public.source_response_validation_findings f
      where
        f.response_set_id = v_set.id
        and not exists (
          select
            1
          from
            public.source_response_validation_finding_events e0
          where
            e0.finding_id = f.id
            and e0.new_status = 'open'
            and e0.prior_status is null
        )
      union all
      select
        coalesce(sr.submitted_at, sr.captured_at, sr.created_at),
        case
          when sr.is_submitted then 'source_response_submitted_snapshot'
          else 'source_response_draft_saved'
        end,
        sr.originator_user_id,
        jsonb_build_object(
          'response_id',
          sr.id,
          'source_field_id',
          sr.source_field_id,
          'response_sequence',
          sr.response_sequence,
          'is_current',
          sr.is_current,
          'is_submitted',
          sr.is_submitted,
          'value_type',
          sr.value_type,
          'captured_at',
          sr.captured_at
        )
      from
        public.source_responses sr
      where
        sr.response_set_id = v_set.id
    )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'occurred_at',
          t.occurred_at,
          'event_kind',
          t.event_kind,
          'actor_user_id',
          t.actor_user_id,
          'payload',
          t.payload
        )
        order by
          t.occurred_at nulls last,
          t.event_kind
      ),
      '[]'::jsonb
    ) into v_events
  from
    timeline t
  where
    t.occurred_at is not null;

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
      'study_subject_id',
      v_set.study_subject_id,
      'visit_id',
      v_set.visit_id,
      'procedure_execution_id',
      v_set.procedure_execution_id,
      'current_status',
      v_set.status,
      'event_count',
      jsonb_array_length(v_events),
      'events',
      v_events
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
      'get_source_response_set_history',
      'timestamp',
      v_now,
      'actor_user_id',
      v_uid
    )
  );
end;
$$;

comment on function public.get_source_response_set_history (uuid, uuid) is
  'Read-only chronological reconstruction for a source_response_set (open, submit, corrections, addenda, findings, operational events, response snapshots).';

revoke all on function public.get_source_response_set_history (uuid, uuid) from public;

grant execute on function public.get_source_response_set_history (uuid, uuid) to authenticated;
