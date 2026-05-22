-- Phase 11B-FIX: audit blocker remediation (investigator role RPC, reopen validation,
-- save all-or-error, transactional schedule, compensating events).

-- ---------------------------------------------------------------------------
-- Investigator closeout sign authority (org PI/Sub-I/admin/owner only)
-- ---------------------------------------------------------------------------

create or replace function public.user_can_sign_investigator_closeout (_study_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_is_org_admin (
      (
        select s.organization_id
        from public.studies s
        where s.id = _study_id
      )
    )
    or exists (
      select 1
      from public.organization_members om
      inner join public.studies s on s.id = _study_id
      where om.organization_id = s.organization_id
        and om.user_id = auth.uid ()
        and public.user_has_active_organization_membership (s.organization_id)
        and (
          om.role in ('owner', 'admin', 'pi_sub_i')
          or om.roles && array['owner', 'admin', 'pi_sub_i']::text[]
        )
    );
$$;

comment on function public.user_can_sign_investigator_closeout (uuid) is
  'Phase 11B: investigator visit closeout sign requires PI/Sub-I/admin/owner site role (not coordinator-only).';

revoke all on function public.user_can_sign_investigator_closeout (uuid) from public;
grant execute on function public.user_can_sign_investigator_closeout (uuid) to authenticated;

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

  if not public.user_can_sign_investigator_closeout (v_visit.study_id) then
    return jsonb_build_object(
      'ok', false,
      'error', 'investigator sign requires pi_sub_i, admin, or owner site role',
      'idempotent', false
    );
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

-- ---------------------------------------------------------------------------
-- Reopen reason validation + investigator reopen RPC
-- ---------------------------------------------------------------------------

create or replace function public.reopen_visit_coordinator_closeout (
  p_organization_id uuid,
  p_visit_id uuid,
  p_actor_name text,
  p_reopen_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required', 'idempotent', false);
  end if;

  if length(trim(coalesce(p_reopen_reason, ''))) < 3 then
    return jsonb_build_object(
      'ok', false,
      'error', 'reopen reason required (minimum 3 characters)',
      'idempotent', false
    );
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

  if v_visit.visit_review_status = 'reopened' then
    return jsonb_build_object('ok', true, 'error', null, 'idempotent', true);
  end if;

  if v_visit.visit_review_status not in ('coordinator_signed', 'investigator_signed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit closeout was changed; refresh before reopening',
      'idempotent', false
    );
  end if;

  update public.visit_progress_notes
  set
    coordinator_signature_status = 'draft',
    coordinator_signed_by_user_id = null,
    coordinator_signed_by_name = null,
    coordinator_signed_at = null,
    investigator_review_status = 'pending',
    investigator_signed_by_user_id = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null,
    updated_by = v_uid
  where visit_id = p_visit_id;

  update public.visits
  set
    visit_review_status = 'reopened',
    coordinator_signed_by = null,
    coordinator_signed_by_name = null,
    coordinator_signed_at = null,
    investigator_signed_by = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null
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
      'CLOSEOUT_REOPENED',
      jsonb_build_object(
        'source', 'reopen_visit_coordinator_closeout_rpc',
        'actor_name', nullif(trim(p_actor_name), ''),
        'closeout_context', 'coordinator_reopened',
        'reopen_reason', nullif(trim(p_reopen_reason), '')
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

create or replace function public.reopen_visit_investigator_closeout (
  p_organization_id uuid,
  p_visit_id uuid,
  p_actor_name text,
  p_reopen_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required', 'idempotent', false);
  end if;

  if length(trim(coalesce(p_reopen_reason, ''))) < 3 then
    return jsonb_build_object(
      'ok', false,
      'error', 'reopen reason required (minimum 3 characters)',
      'idempotent', false
    );
  end if;

  if not public.user_can_sign_investigator_closeout (
    (
      select v.study_id
      from public.visits v
      where v.id = p_visit_id
        and v.organization_id = p_organization_id
    )
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'investigator reopen requires pi_sub_i, admin, or owner site role',
      'idempotent', false
    );
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

  if exists (
    select 1
    from public.visit_progress_notes vpn
    where vpn.visit_id = p_visit_id
      and vpn.investigator_review_status = 'reopened'
  )
  and v_visit.visit_review_status = 'coordinator_signed' then
    return jsonb_build_object('ok', true, 'error', null, 'idempotent', true);
  end if;

  if v_visit.visit_review_status is distinct from 'investigator_signed' then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit closeout was changed; refresh before investigator reopen',
      'idempotent', false
    );
  end if;

  update public.visit_progress_notes
  set
    investigator_review_status = 'reopened',
    investigator_signed_by_user_id = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null,
    updated_by = v_uid
  where visit_id = p_visit_id;

  update public.visits
  set
    visit_review_status = 'coordinator_signed',
    investigator_signed_by = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null,
    visit_status = 'in_progress'
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
      'CLOSEOUT_REOPENED',
      jsonb_build_object(
        'source', 'reopen_visit_investigator_closeout_rpc',
        'actor_name', nullif(trim(p_actor_name), ''),
        'closeout_context', 'investigator_reopened',
        'reopen_reason', nullif(trim(p_reopen_reason), '')
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

-- ---------------------------------------------------------------------------
-- Transactional visit schedule generation (single DB transaction)
-- ---------------------------------------------------------------------------

create or replace function public.generate_subject_visit_schedule (
  p_study_subject_id uuid,
  p_anchor_date date default null,
  p_force boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sub public.study_subjects%rowtype;
  v_def record;
  v_map record;
  v_anchor date;
  v_target_day integer;
  v_min_off integer;
  v_max_off integer;
  v_target_date date;
  v_window_start date;
  v_window_end date;
  v_window_status text;
  v_visit_id uuid;
  v_sdv uuid;
  v_created integer := 0;
  v_idx integer := 0;
  v_all_exist boolean;
begin
  if auth.uid () is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  select ss.*
  into v_sub
  from public.study_subjects ss
  where ss.id = p_study_subject_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'subject not found');
  end if;

  if not public.user_can_manage_subject_enrollment (v_sub.study_id) then
    return jsonb_build_object('ok', false, 'error', 'insufficient study access');
  end if;

  if v_sub.enrollment_status not in ('enrolled', 'randomized', 'completed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit schedule is generated after enrollment or randomization'
    );
  end if;

  v_anchor := coalesce(p_anchor_date, v_sub.schedule_anchor_date, current_date);

  select not exists (
    select 1
    from public.visit_definitions vd
    where vd.study_id = v_sub.study_id
      and not exists (
        select 1
        from public.visits v
        where v.study_subject_id = p_study_subject_id
          and v.visit_definition_id = vd.id
          and v.visit_status not in ('cancelled', 'missed', 'no_show')
      )
  )
  into v_all_exist;

  if v_all_exist
    and v_sub.visit_schedule_generated_at is not null
    and not coalesce(p_force, false) then
    return jsonb_build_object(
      'ok', true,
      'created_count', 0,
      'skipped', true,
      'error', null
    );
  end if;

  for v_def in
  select
    vd.id,
    vd.target_day,
    vd.window_min_offset,
    vd.window_max_offset,
    vd.sort_order
  from public.visit_definitions vd
  where vd.study_id = v_sub.study_id
  order by vd.sort_order asc, vd.created_at asc loop
    if exists (
      select 1
      from public.visits v
      where v.study_subject_id = p_study_subject_id
        and v.visit_definition_id = v_def.id
        and v.visit_status not in ('cancelled', 'missed', 'no_show')
    ) then
      continue;
    end if;

    v_idx := v_idx + 1;
    v_target_day := greatest(
      1,
      coalesce(
        nullif(v_def.target_day, 0),
        v_idx
      )
    );
    v_min_off := coalesce(v_def.window_min_offset, -1);
    v_max_off := coalesce(v_def.window_max_offset, 2);
    v_target_date := v_anchor + make_interval (days => v_target_day - 1);
    v_window_start := v_target_date + make_interval (days => v_min_off);
    v_window_end := v_target_date + make_interval (days => v_max_off);
    v_window_status := 'inside_window';

    begin
      insert into public.visits (
        organization_id,
        study_id,
        study_subject_id,
        visit_definition_id,
        visit_day,
        target_date,
        scheduled_date,
        window_start,
        window_end,
        window_status,
        confirmation_status,
        visit_status
      )
      values (
        v_sub.organization_id,
        v_sub.study_id,
        p_study_subject_id,
        v_def.id,
        v_target_day,
        v_target_date,
        v_target_date,
        v_window_start,
        v_window_end,
        v_window_status,
        'pending',
        'scheduled'
      )
      returning id into v_visit_id;
    exception
      when unique_violation then
        continue;
    end;

    for v_map in
    select
      m.procedure_definition_id,
      m.is_required
    from public.visit_def_procedure_map m
    where m.study_id = v_sub.study_id
      and m.visit_definition_id = v_def.id
    order by m.sort_order asc loop
      select psb.default_source_definition_version_id
      into v_sdv
      from public.procedure_source_bindings psb
      where psb.study_id = v_sub.study_id
        and psb.procedure_definition_id = v_map.procedure_definition_id
      limit 1;

      if v_map.is_required
        and v_sdv is null then
        raise exception
          'Required procedure execution was not created because no published source binding resolved for schedule generation.';
      end if;

      insert into public.procedure_executions (
        organization_id,
        study_id,
        visit_id,
        procedure_definition_id,
        execution_status,
        source_definition_version_id
      )
      values (
        v_sub.organization_id,
        v_sub.study_id,
        v_visit_id,
        v_map.procedure_definition_id,
        'pending',
        v_sdv
      );
    end loop;

    v_created := v_created + 1;
  end loop;

  update public.study_subjects
  set
    schedule_anchor_date = v_anchor,
    visit_schedule_generated_at = clock_timestamp()
  where id = p_study_subject_id;

  return jsonb_build_object(
    'ok', true,
    'created_count', v_created,
    'skipped', false,
    'error', null
  );
end;
$$;

revoke all on function public.reopen_visit_investigator_closeout (uuid, uuid, text, text) from public;
revoke all on function public.generate_subject_visit_schedule (uuid, date, boolean) from public;

grant execute on function public.reopen_visit_investigator_closeout (uuid, uuid, text, text) to authenticated;
grant execute on function public.generate_subject_visit_schedule (uuid, date, boolean) to authenticated;
