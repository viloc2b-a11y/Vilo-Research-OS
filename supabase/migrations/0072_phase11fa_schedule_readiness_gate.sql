-- Phase 11F-A-HARDEN: DB-side READY_FOR_EXECUTION gate on generate_subject_visit_schedule.

-- ---------------------------------------------------------------------------
-- Study runtime readiness (schedule generation)
-- ---------------------------------------------------------------------------

create or replace function public.phase11fa_study_runtime_ready_for_schedule (
  p_study_id uuid
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_org uuid;
  v_pkg record;
  v_blockers text[] := array[]::text[];
  v_map record;
  v_binding_sdv_id uuid;
  v_sdv record;
  v_visit_count integer;
  v_required_map_count integer;
begin
  select s.organization_id
  into v_org
  from public.studies s
  where s.id = p_study_id;

  if v_org is null then
    return jsonb_build_object(
      'ok', false,
      'blockers', array['Study not found.']
    );
  end if;

  select count(*)::integer
  into v_visit_count
  from public.visit_definitions vd
  where vd.study_id = p_study_id;

  if v_visit_count = 0 then
    v_blockers := array_append(v_blockers, 'No visit definitions exist for this study.');
  end if;

  select count(*)::integer
  into v_required_map_count
  from public.visit_def_procedure_map m
  where m.study_id = p_study_id
    and coalesce(m.is_required, false) = true
    and coalesce(m.is_conditional, false) = false;

  if v_required_map_count = 0 then
    v_blockers := array_append(
      v_blockers,
      'No required visit-to-procedure mappings exist for this study.'
    );
  end if;

  select spp.package_id, spp.validation_status, spp.persisted_at
  into v_pkg
  from public.source_publish_packages spp
  where spp.study_id = p_study_id
    and spp.organization_id = v_org
    and spp.persisted_at is not null
  order by spp.persisted_at desc nulls last, spp.created_at desc nulls last
  limit 1;

  if not found then
    v_blockers := array_append(
      v_blockers,
      'No persisted source package exists for this study.'
    );
  elsif v_pkg.validation_status = 'invalid' then
    v_blockers := array_append(
      v_blockers,
      'Published package is invalid for this study.'
    );
  elsif not public.phase4c_publish_package_is_consistent (v_org, v_pkg.package_id) then
    v_blockers := array_append(
      v_blockers,
      'Package consistency failed for the persisted source package.'
    );
  end if;

  for v_map in
  select
    m.id,
    coalesce(vd.label, vd.code, 'Visit') as visit_label,
    coalesce(pd.label, pd.code, 'Procedure') as procedure_label,
    m.procedure_definition_id
  from public.visit_def_procedure_map m
  inner join public.visit_definitions vd on vd.id = m.visit_definition_id
  inner join public.procedure_definitions pd on pd.id = m.procedure_definition_id
  where m.study_id = p_study_id
    and coalesce(m.is_required, false) = true
    and coalesce(m.is_conditional, false) = false
    and (
      vd.eligible_subject_roles is null
      or 'participant' = any (vd.eligible_subject_roles)
    ) loop
    select psb.default_source_definition_version_id
    into v_binding_sdv_id
    from public.procedure_source_bindings psb
    where psb.study_id = p_study_id
      and psb.procedure_definition_id = v_map.procedure_definition_id
    limit 1;

    if v_binding_sdv_id is null then
      v_blockers := array_append(
        v_blockers,
        format(
          'Required procedure is missing a source binding: %s · %s.',
          v_map.visit_label,
          v_map.procedure_label
        )
      );
      continue;
    end if;

    select sdv.id, sdv.lifecycle_status, sdv.study_id, sdv.version_label
    into v_sdv
    from public.source_definition_versions sdv
    where sdv.id = v_binding_sdv_id;

    if not found then
      v_blockers := array_append(
        v_blockers,
        format(
          'Required procedure binding target is unavailable: %s · %s.',
          v_map.visit_label,
          v_map.procedure_label
        )
      );
      continue;
    end if;

    if v_sdv.lifecycle_status is distinct from 'published' then
      v_blockers := array_append(
        v_blockers,
        format(
          'Required procedure binding is not published: %s · %s.',
          v_map.visit_label,
          v_map.procedure_label
        )
      );
      continue;
    end if;

    if v_sdv.study_id is distinct from p_study_id then
      v_blockers := array_append(
        v_blockers,
        format(
          'Required procedure binding points to a different study: %s · %s.',
          v_map.visit_label,
          v_map.procedure_label
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', coalesce(array_length(v_blockers, 1), 0) = 0,
    'blockers', to_jsonb(v_blockers)
  );
end;
$$;

comment on function public.phase11fa_study_runtime_ready_for_schedule (uuid) is
  'Phase 11F-A: true when study has persisted package, required maps, and published same-study bindings for schedule generation.';

grant execute on function public.phase11fa_study_runtime_ready_for_schedule (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule RPC: enforce readiness before creating visits / procedure_executions
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
  v_readiness jsonb;
  v_blockers jsonb;
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
  v_modality text;
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

  v_readiness := public.phase11fa_study_runtime_ready_for_schedule (v_sub.study_id);
  if coalesce((v_readiness ->> 'ok')::boolean, false) = false then
    v_blockers := coalesce(v_readiness -> 'blockers', '[]'::jsonb);
    return jsonb_build_object(
      'ok', false,
      'error',
      'study runtime is not ready for schedule generation',
      'readiness_blockers',
      v_blockers
    );
  end if;

  v_anchor := coalesce(p_anchor_date, v_sub.schedule_anchor_date, current_date);

  select not exists (
    select 1
    from public.visit_definitions vd
    where vd.study_id = v_sub.study_id
      and public.phase11d_visit_definition_applies_to_subject (vd.id, p_study_subject_id)
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
    vd.sort_order,
    vd.modality
  from public.visit_definitions vd
  where vd.study_id = v_sub.study_id
    and public.phase11d_visit_definition_applies_to_subject (vd.id, p_study_subject_id)
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
    v_modality := coalesce(nullif(trim(v_def.modality), ''), 'site');

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
        visit_status,
        modality
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
        'scheduled',
        v_modality
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
      and not coalesce(m.is_conditional, false)
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

comment on function public.generate_subject_visit_schedule (uuid, date, boolean) is
  'Phase 11F-A: generates visits/procedures; blocks when phase11fa_study_runtime_ready_for_schedule is false.';

revoke all on function public.generate_subject_visit_schedule (uuid, date, boolean) from public;
grant execute on function public.generate_subject_visit_schedule (uuid, date, boolean) to authenticated;
