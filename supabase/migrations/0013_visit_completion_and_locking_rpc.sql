-- Phase 3C: visit completion + locking (transactional RPCs).
-- Adds visit lifecycle columns, extends visit_status (+ locked) and execution_status (+ verified),
-- replaces complete_procedure_execution for verified + visit-terminal guards,
-- introduces complete_visit + lock_visit.

-- ---------------------------------------------------------------------------
-- Schema: visits
-- ---------------------------------------------------------------------------

alter table public.visits add column if not exists actual_date date;

alter table public.visits add column if not exists locked_at timestamptz;

alter table public.visits add column if not exists locked_by_user_id uuid references auth.users (id);

alter table public.visits drop constraint if exists visits_visit_status_check;

alter table public.visits add constraint visits_visit_status_check check (
  visit_status in (
    'scheduled',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'locked'
  )
);

-- ---------------------------------------------------------------------------
-- Schema: procedure_executions (+ verified QC state after lock)
-- ---------------------------------------------------------------------------

alter table public.procedure_executions drop constraint if exists procedure_executions_execution_status_check;

alter table public.procedure_executions add constraint procedure_executions_execution_status_check check (
  execution_status in (
    'pending',
    'in_progress',
    'completed',
    'verified',
    'not_applicable',
    'cancelled'
  )
);

-- ---------------------------------------------------------------------------
-- complete_procedure_execution: visit terminal guard + verified idempotent
-- ---------------------------------------------------------------------------

create or replace function public.complete_procedure_execution(p_procedure_execution_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_id uuid;
  v_organization_id uuid;
  v_study_id uuid;
  v_visit_id uuid;
  v_procedure_definition_id uuid;
  v_status text;
  v_visit_state text;
  v_updated int;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'authentication required',
      'procedure_execution_id', p_procedure_execution_id,
      'execution_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  select
    pe.id,
    pe.organization_id,
    pe.study_id,
    pe.visit_id,
    pe.procedure_definition_id,
    pe.execution_status,
    v.visit_status
  into
    v_id,
    v_organization_id,
    v_study_id,
    v_visit_id,
    v_procedure_definition_id,
    v_status,
    v_visit_state
  from public.procedure_executions pe
  inner join public.visits v on v.id = pe.visit_id
  where pe.id = p_procedure_execution_id
  for update of pe, v;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'procedure execution not found or access denied',
      'procedure_execution_id', p_procedure_execution_id,
      'execution_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if not (
    v_organization_id in (select public.user_organization_ids())
    and public.user_can_manage_subject_enrollment(v_study_id)
    and public.user_can_append_operational_events(v_study_id)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient study access to complete procedure',
      'procedure_execution_id', v_id,
      'execution_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if v_status in ('completed', 'verified') then
    select oe.id
    into v_event_id
    from public.operational_events oe
    where oe.procedure_execution_id = p_procedure_execution_id
      and oe.event_type = 'PROCEDURE_COMPLETED'
    order by oe.created_at asc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'error', null,
      'procedure_execution_id', v_id,
      'organization_id', v_organization_id,
      'study_id', v_study_id,
      'visit_id', v_visit_id,
      'execution_status', v_status,
      'operational_event_id', v_event_id,
      'idempotent', true
    );
  end if;

  if v_status in ('not_applicable', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'error',
      'procedure execution cannot be completed while status is ' || v_status,
      'procedure_execution_id', v_id,
      'execution_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if v_status not in ('pending', 'in_progress') then
    return jsonb_build_object(
      'ok', false,
      'error',
      'procedure execution cannot be completed while status is ' || v_status,
      'procedure_execution_id', v_id,
      'execution_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  -- Block mutations when visit is finalized (locking / QC / archival).
  if v_visit_state in ('locked', 'completed', 'cancelled', 'no_show') then
    return jsonb_build_object(
      'ok', false,
      'error',
      'procedure completion is not allowed while visit status is ' || v_visit_state,
      'procedure_execution_id', v_id,
      'execution_status', v_status,
      'visit_status', v_visit_state,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  update public.procedure_executions pe
  set
    execution_status = 'completed',
    performed_at = v_now,
    performed_by_user_id = v_uid
  where pe.id = v_id
    and pe.execution_status in ('pending', 'in_progress');

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    select pe.execution_status
    into v_status
    from public.procedure_executions pe
    where pe.id = v_id;

    if v_status in ('completed', 'verified') then
      select oe.id
      into v_event_id
      from public.operational_events oe
      where oe.procedure_execution_id = p_procedure_execution_id
        and oe.event_type = 'PROCEDURE_COMPLETED'
      order by oe.created_at asc
      limit 1;

      return jsonb_build_object(
        'ok', true,
        'error', null,
        'procedure_execution_id', v_id,
        'organization_id', v_organization_id,
        'study_id', v_study_id,
        'visit_id', v_visit_id,
        'execution_status', v_status,
        'operational_event_id', v_event_id,
        'idempotent', true
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'procedure execution could not be completed',
      'procedure_execution_id', v_id,
      'execution_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

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
    v_organization_id,
    v_study_id,
    v_visit_id,
    v_id,
    'PROCEDURE_COMPLETED',
    jsonb_build_object(
      'source', 'complete_procedure_execution_rpc',
      'procedure_definition_id', v_procedure_definition_id
    ),
    v_uid,
    v_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'procedure_execution_id', v_id,
    'organization_id', v_organization_id,
    'study_id', v_study_id,
    'visit_id', v_visit_id,
    'execution_status', 'completed',
    'operational_event_id', v_event_id,
    'idempotent', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_visit — all required mapped procedures satisfied
-- ---------------------------------------------------------------------------

create or replace function public.complete_visit(p_visit_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_org uuid;
  v_study uuid;
  v_vdef uuid;
  v_status text;
  v_evt uuid;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'authentication required',
      'visit_id', p_visit_id,
      'visit_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  select
    v.organization_id,
    v.study_id,
    v.visit_definition_id,
    v.visit_status
  into
    v_org,
    v_study,
    v_vdef,
    v_status
  from public.visits v
  where v.id = p_visit_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit not found or access denied',
      'visit_id', p_visit_id,
      'visit_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if not (
    v_org in (select public.user_organization_ids())
    and public.user_can_manage_subject_enrollment(v_study)
    and public.user_can_append_operational_events(v_study)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient study access to complete visit',
      'visit_id', p_visit_id,
      'visit_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  -- Idempotent: already completed OR locked archival state.
  if v_status = 'completed' or v_status = 'locked' then
    select oe.id
    into v_evt
    from public.operational_events oe
    where oe.visit_id = p_visit_id
      and oe.event_type = 'VISIT_COMPLETED'
    order by oe.created_at asc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'error', null,
      'visit_id', p_visit_id,
      'organization_id', v_org,
      'study_id', v_study,
      'visit_status', v_status,
      'operational_event_id', v_evt,
      'idempotent', true
    );
  end if;

  if v_status in ('cancelled', 'no_show') then
    return jsonb_build_object(
      'ok', false,
      'error', 'cannot complete visit with status ' || v_status,
      'visit_id', p_visit_id,
      'visit_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  -- Required mapped procedures must exist and be terminal (completed | verified).
  if exists (
    select 1
    from public.visit_def_procedure_map m
    where m.visit_definition_id = v_vdef
      and m.is_required is true
      and (
        not exists (
          select 1
          from public.procedure_executions pe
          where pe.visit_id = p_visit_id
            and pe.procedure_definition_id = m.procedure_definition_id
        )
        or exists (
          select 1
          from public.procedure_executions pe
          where pe.visit_id = p_visit_id
            and pe.procedure_definition_id = m.procedure_definition_id
            and pe.execution_status not in ('completed', 'verified')
        )
      )
  ) then
    return jsonb_build_object(
      'ok', false,
      'error',
      'required procedures for this visit are not all completed or verified',
      'visit_id', p_visit_id,
      'visit_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  update public.visits v
  set
    visit_status = 'completed',
    actual_date = coalesce(v.actual_date, (v_now at time zone 'utc')::date),
    completed_at = coalesce(v.completed_at, v_now),
    occurred_at = coalesce(v.occurred_at, v_now)
  where v.id = p_visit_id;

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
    v_org,
    v_study,
    p_visit_id,
    null,
    'VISIT_COMPLETED',
    jsonb_build_object('source', 'complete_visit_rpc'),
    v_uid,
    v_now
  )
  returning id into v_evt;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'visit_id', p_visit_id,
    'organization_id', v_org,
    'study_id', v_study,
    'visit_status', 'completed',
    'operational_event_id', v_evt,
    'idempotent', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- lock_visit — must be completed; promotes completed procedures → verified
-- ---------------------------------------------------------------------------

create or replace function public.lock_visit(p_visit_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_org uuid;
  v_study uuid;
  v_status text;
  v_evt uuid;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'authentication required',
      'visit_id', p_visit_id,
      'visit_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  select
    v.organization_id,
    v.study_id,
    v.visit_status
  into v_org, v_study, v_status
  from public.visits v
  where v.id = p_visit_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit not found or access denied',
      'visit_id', p_visit_id,
      'visit_status', null,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if not (
    v_org in (select public.user_organization_ids())
    and public.user_can_manage_subject_enrollment(v_study)
    and public.user_can_append_operational_events(v_study)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient study access to lock visit',
      'visit_id', p_visit_id,
      'visit_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  if v_status = 'locked' then
    select oe.id
    into v_evt
    from public.operational_events oe
    where oe.visit_id = p_visit_id
      and oe.event_type = 'VISIT_LOCKED'
    order by oe.created_at asc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'error', null,
      'visit_id', p_visit_id,
      'organization_id', v_org,
      'study_id', v_study,
      'visit_status', 'locked',
      'operational_event_id', v_evt,
      'idempotent', true
    );
  end if;

  if v_status <> 'completed' then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit must be completed before it can be locked',
      'visit_id', p_visit_id,
      'visit_status', v_status,
      'operational_event_id', null,
      'idempotent', false
    );
  end if;

  update public.procedure_executions pe
  set execution_status = 'verified'
  where pe.visit_id = p_visit_id
    and pe.execution_status = 'completed';

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
    v_org,
    v_study,
    p_visit_id,
    null,
    'VISIT_LOCKED',
    jsonb_build_object('source', 'lock_visit_rpc'),
    v_uid,
    v_now
  )
  returning id into v_evt;

  update public.visits v
  set
    visit_status = 'locked',
    locked_at = coalesce(v.locked_at, v_now),
    locked_by_user_id = coalesce(v.locked_by_user_id, v_uid)
  where v.id = p_visit_id;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'visit_id', p_visit_id,
    'organization_id', v_org,
    'study_id', v_study,
    'visit_status', 'locked',
    'operational_event_id', v_evt,
    'idempotent', false
  );
end;
$$;

revoke all on function public.complete_visit(uuid) from public;
grant execute on function public.complete_visit(uuid) to authenticated;

revoke all on function public.lock_visit(uuid) from public;
grant execute on function public.lock_visit(uuid) to authenticated;
