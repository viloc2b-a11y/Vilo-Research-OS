-- Phase 11D: protocol generalization primitives (role, arm, modality, conditional procedures).

-- ---------------------------------------------------------------------------
-- 11D-1: subject role + household linkage
-- ---------------------------------------------------------------------------

alter table public.study_subjects
  add column if not exists subject_role text,
  add column if not exists household_id uuid,
  add column if not exists anchor_subject_id uuid references public.study_subjects (id) on delete set null;

update public.study_subjects
set subject_role = 'participant'
where subject_role is null;

alter table public.study_subjects
  alter column subject_role set default 'participant';

alter table public.study_subjects
  drop constraint if exists study_subjects_subject_role_check;

alter table public.study_subjects
  add constraint study_subjects_subject_role_check check (
    subject_role in (
      'participant',
      'index_patient',
      'household_contact',
      'caregiver',
      'specimen_donor'
    )
  );

create index if not exists study_subjects_household_id_idx
  on public.study_subjects (household_id)
  where household_id is not null;

create index if not exists study_subjects_anchor_subject_id_idx
  on public.study_subjects (anchor_subject_id)
  where anchor_subject_id is not null;

comment on column public.study_subjects.subject_role is
  'Phase 11D: protocol role for schedule filtering (default participant).';

comment on column public.study_subjects.household_id is
  'Phase 11D: optional household grouping for related subjects.';

comment on column public.study_subjects.anchor_subject_id is
  'Phase 11D: index subject when this row is a household contact/caregiver.';

-- ---------------------------------------------------------------------------
-- 11D-2 / 11D-3: visit definition eligibility + modality
-- ---------------------------------------------------------------------------

alter table public.visit_definitions
  add column if not exists eligible_arms text[],
  add column if not exists eligible_subject_roles text[],
  add column if not exists modality text;

alter table public.visit_definitions
  drop constraint if exists visit_definitions_modality_check;

alter table public.visit_definitions
  add constraint visit_definitions_modality_check check (
    modality is null
    or modality in ('site', 'phone', 'remote', 'home', 'off_site')
  );

comment on column public.visit_definitions.eligible_arms is
  'Phase 11D: null = all arms; otherwise schedule only when subject.randomization_arm matches.';

comment on column public.visit_definitions.eligible_subject_roles is
  'Phase 11D: null = all roles; otherwise schedule only when subject.subject_role matches.';

comment on column public.visit_definitions.modality is
  'Phase 11D: visit modality copied to execution visits (default site).';

alter table public.visits
  add column if not exists modality text;

alter table public.visits
  drop constraint if exists visits_modality_check;

alter table public.visits
  add constraint visits_modality_check check (
    modality is null
    or modality in ('site', 'phone', 'remote', 'home', 'off_site')
  );

comment on column public.visits.modality is
  'Phase 11D: execution visit modality copied from visit_definitions at schedule generation.';

-- ---------------------------------------------------------------------------
-- 11D-4: conditional procedure map
-- ---------------------------------------------------------------------------

alter table public.visit_def_procedure_map
  add column if not exists is_conditional boolean not null default false,
  add column if not exists condition_label text;

comment on column public.visit_def_procedure_map.is_conditional is
  'Phase 11D: when true, procedure_execution is not auto-created; coordinator instantiates when condition met.';

comment on column public.visit_def_procedure_map.condition_label is
  'Phase 11D: human-readable label for conditional procedure availability.';

-- ---------------------------------------------------------------------------
-- Eligibility helper
-- ---------------------------------------------------------------------------

create or replace function public.phase11d_visit_definition_applies_to_subject (
  p_visit_definition_id uuid,
  p_study_subject_id uuid
) returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.visit_definitions vd
    inner join public.study_subjects ss on ss.id = p_study_subject_id
    where vd.id = p_visit_definition_id
      and vd.study_id = ss.study_id
      and (
        vd.eligible_subject_roles is null
        or coalesce(ss.subject_role, 'participant') = any (vd.eligible_subject_roles)
      )
      and (
        vd.eligible_arms is null
        or (
          ss.randomization_arm is not null
          and ss.randomization_arm = any (vd.eligible_arms)
        )
        or (
          ss.randomization_arm is null
          and vd.eligible_arms is null
        )
      )
  );
$$;

comment on function public.phase11d_visit_definition_applies_to_subject (uuid, uuid) is
  'Phase 11D: true when visit definition applies to subject role and randomization arm.';

grant execute on function public.phase11d_visit_definition_applies_to_subject (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Conditional procedure instantiation
-- ---------------------------------------------------------------------------

create or replace function public.instantiate_conditional_procedure_execution (
  p_organization_id uuid,
  p_visit_id uuid,
  p_visit_def_procedure_map_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_sub public.study_subjects%rowtype;
  v_map public.visit_def_procedure_map%rowtype;
  v_sdv uuid;
  v_pe_id uuid;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required');
  end if;

  select v.*
  into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'visit not found');
  end if;

  select ss.*
  into v_sub
  from public.study_subjects ss
  where ss.id = v_visit.study_subject_id;

  select m.*
  into v_map
  from public.visit_def_procedure_map m
  where m.id = p_visit_def_procedure_map_id
    and m.study_id = v_visit.study_id
    and m.visit_definition_id = v_visit.visit_definition_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'procedure map not found for visit');
  end if;

  if not coalesce(v_map.is_conditional, false) then
    return jsonb_build_object('ok', false, 'error', 'procedure map is not conditional');
  end if;

  if not public.user_can_manage_subject_enrollment (v_visit.study_id) then
    return jsonb_build_object('ok', false, 'error', 'insufficient study access');
  end if;

  if exists (
    select 1
    from public.procedure_executions pe
    where pe.visit_id = p_visit_id
      and pe.procedure_definition_id = v_map.procedure_definition_id
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'procedure_execution_id',
      (
        select pe.id
        from public.procedure_executions pe
        where pe.visit_id = p_visit_id
          and pe.procedure_definition_id = v_map.procedure_definition_id
        limit 1
      )
    );
  end if;

  select psb.default_source_definition_version_id
  into v_sdv
  from public.procedure_source_bindings psb
  where psb.study_id = v_visit.study_id
    and psb.procedure_definition_id = v_map.procedure_definition_id
  limit 1;

  if v_map.is_required
    and v_sdv is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'no published source binding for required conditional procedure'
    );
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
    v_visit.organization_id,
    v_visit.study_id,
    p_visit_id,
    v_map.procedure_definition_id,
    'pending',
    v_sdv
  )
  returning id into v_pe_id;

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
      v_pe_id,
      'CONDITIONAL_PROCEDURE_INSTANTIATED',
      jsonb_build_object(
        'source', 'instantiate_conditional_procedure_execution_rpc',
        'visit_def_procedure_map_id', v_map.id,
        'procedure_definition_id', v_map.procedure_definition_id,
        'condition_label', nullif(trim(v_map.condition_label), ''),
        'subject_id', v_sub.id,
        'subject_role', coalesce(v_sub.subject_role, 'participant'),
        'household_id', v_sub.household_id,
        'anchor_subject_id', v_sub.anchor_subject_id
      ),
      v_uid,
      v_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'procedure_execution_id', v_pe_id,
    'operational_event_id', v_event_id
  );
end;
$$;

comment on function public.instantiate_conditional_procedure_execution (uuid, uuid, uuid) is
  'Phase 11D: coordinator-confirmed instantiation of a conditional mapped procedure.';

revoke all on function public.instantiate_conditional_procedure_execution (uuid, uuid, uuid) from public;
grant execute on function public.instantiate_conditional_procedure_execution (uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Arm/role/modality-aware schedule generation
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
