-- Phase 3B: atomic procedure completion (UPDATE + INSERT operational_events).
-- SECURITY INVOKER: RLS on procedure_executions + operational_events enforces tenancy and roles.

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
    pe.execution_status
  into
    v_id,
    v_organization_id,
    v_study_id,
    v_visit_id,
    v_procedure_definition_id,
    v_status
  from public.procedure_executions pe
  where pe.id = p_procedure_execution_id
  for update;

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

  -- Mirrors RLS on procedure_executions (update) + operational_events (insert).
  -- `user_can_manage_subject_enrollment` / `user_can_append_operational_events` include org-admin
  -- shortcuts (same helpers as migrations 0007 + 0010); study coordinators satisfy both.
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

  if v_status = 'completed' then
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
      'execution_status', 'completed',
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

    if v_status = 'completed' then
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
        'execution_status', 'completed',
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

revoke all on function public.complete_procedure_execution(uuid) from public;
grant execute on function public.complete_procedure_execution(uuid) to authenticated;
