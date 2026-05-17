-- Phase 4C.13: publish_source_package RPC — persist approved publish package to Phase 4A + 4C snapshots.
-- Dependencies: 0026–0032. Does not alter Phase 3C / 0020–0025.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase4c_publish_json_errors_empty (p_json jsonb) returns boolean language sql immutable
set
  search_path = public as $$
select
  coalesce(jsonb_array_length(p_json), 0) = 0;
$$;

create or replace function public.phase4c_map_compiler_data_type_to_widget (p_data_type text) returns text language plpgsql immutable
set
  search_path = public as $$
declare
  v_dt text := lower(trim(coalesce(p_data_type, 'text')));
begin
  case v_dt
    when 'text', 'textarea' then return 'text';
    when 'integer' then return 'integer';
    when 'number', 'decimal' then return 'number';
    when 'boolean' then return 'boolean';
    when 'date' then return 'date';
    when 'datetime' then return 'datetime';
    when 'time' then return 'time';
    when 'coded', 'dropdown', 'dropdown_multi', 'checkbox' then return 'dropdown';
    when 'file_reference' then return 'file_reference';
    else return 'text';
  end case;
end;
$$;

create or replace function public.phase4c_resolve_source_definition_for_instrument (
  p_organization_id uuid,
  p_study_id uuid,
  p_instrument_code text,
  p_instrument_label text
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_code text;
  v_label text;
  v_id uuid;
begin
  v_code := trim(coalesce(p_instrument_code, ''));
  if v_code = '' then
    raise exception 'instrument_code is required for source_definitions resolution';
  end if;

  if v_code !~ '^[A-Za-z][A-Za-z0-9_]*$' then
    v_code := regexp_replace(v_code, '[^A-Za-z0-9_]', '_', 'g');
    if v_code !~ '^[A-Za-z]' then
      v_code := 'Inst_' || v_code;
    end if;
  end if;

  v_label := coalesce(nullif(trim(p_instrument_label), ''), v_code);

  insert into public.source_definitions (
    organization_id,
    study_id,
    code,
    label,
    description
  )
  values (
    p_organization_id,
    p_study_id,
    v_code,
    v_label,
    'Auto-resolved instrument for publish package'
  )
  on conflict (study_id, code) do nothing;

  select sd.id into v_id
  from public.source_definitions sd
  where sd.study_id = p_study_id
    and sd.code = v_code;

  if v_id is null then
    raise exception 'failed to resolve source_definitions row for study % code %', p_study_id, v_code;
  end if;

  return v_id;
end;
$$;

create or replace function public.phase4c_build_publish_summary (
  p_organization_id uuid,
  p_package_id text,
  p_idempotent_replay boolean default false
) returns jsonb language plpgsql stable security definer
set
  search_path = public as $$
declare
  v_pkg public.source_publish_packages%rowtype;
  v_sdv_map jsonb := '{}'::jsonb;
  v_field_map jsonb := '{}'::jsonb;
  v_counts jsonb;
  v_warnings jsonb := '[]'::jsonb;
begin
  select * into v_pkg
  from public.source_publish_packages spp
  where spp.organization_id = p_organization_id
    and spp.package_id = p_package_id;

  if not found then
    raise exception 'publish package not found: org=% package_id=%', p_organization_id, p_package_id;
  end if;

  select coalesce(jsonb_object_agg(psdv.source_definition_version_id, psdv.phase4a_source_definition_version_id), '{}'::jsonb)
  into v_sdv_map
  from public.published_source_definition_versions psdv
  where psdv.organization_id = p_organization_id
    and psdv.package_id = p_package_id
    and psdv.phase4a_source_definition_version_id is not null;

  select coalesce(jsonb_object_agg(pf.source_field_id, pf.phase4a_source_field_id), '{}'::jsonb)
  into v_field_map
  from public.published_source_fields pf
  where pf.organization_id = p_organization_id
    and pf.package_id = p_package_id
    and pf.phase4a_source_field_id is not null;

  select jsonb_build_object(
    'source_definition_versions', (select count(*)::int from public.published_source_definition_versions where organization_id = p_organization_id and package_id = p_package_id),
    'source_sections', (select count(*)::int from public.published_source_sections where organization_id = p_organization_id and package_id = p_package_id),
    'source_fields', (select count(*)::int from public.published_source_fields where organization_id = p_organization_id and package_id = p_package_id),
    'validation_rules', (select count(*)::int from public.published_source_validation_rules where organization_id = p_organization_id and package_id = p_package_id),
    'conditional_rules', (select count(*)::int from public.published_source_conditional_rules where organization_id = p_organization_id and package_id = p_package_id),
    'workflow_requirements', (select count(*)::int from public.published_source_workflow_requirements where organization_id = p_organization_id and package_id = p_package_id),
    'signature_requirements', (select count(*)::int from public.published_source_signature_requirements where organization_id = p_organization_id and package_id = p_package_id),
    'external_source_requirements', (select count(*)::int from public.published_source_external_requirements where organization_id = p_organization_id and package_id = p_package_id),
    'runtime_expectations', (select count(*)::int from public.published_source_runtime_expectations where organization_id = p_organization_id and package_id = p_package_id),
    'approval_evidence', (select count(*)::int from public.source_publish_approval_evidence where organization_id = p_organization_id and package_id = p_package_id)
  )
  into v_counts;

  if v_pkg.validation_status = 'warning' then
    v_warnings := jsonb_build_array(
      jsonb_build_object('code', 'VALIDATION_WARNINGS', 'message', 'Package persisted with validation_status=warning')
    );
  end if;

  return jsonb_build_object(
    'package_id', v_pkg.package_id,
    'organization_id', v_pkg.organization_id,
    'study_id', v_pkg.study_id,
    'study_version_id', v_pkg.study_version_id,
    'source_publish_package_row_id', v_pkg.id,
    'persisted_at', v_pkg.persisted_at,
    'persisted_by_user_id', v_pkg.persisted_by_user_id,
    'idempotent_replay', coalesce(p_idempotent_replay, false),
    'validation_status', v_pkg.validation_status,
    'warnings', v_warnings,
    'phase4a_source_definition_version_ids', v_sdv_map,
    'phase4a_source_field_ids', v_field_map,
    'published_snapshot_counts', v_counts,
    'consistency_check_passed', public.phase4c_publish_package_is_consistent(p_organization_id, p_package_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- publish_source_package
-- ---------------------------------------------------------------------------

create or replace function public.publish_source_package (
  p_organization_id uuid,
  p_study_id uuid,
  p_study_version_id uuid,
  p_publish_package jsonb,
  p_source_definitions jsonb,
  p_approval jsonb
) returns jsonb language plpgsql security definer
set
  search_path = public as $$
declare
  v_uid uuid;
  v_package_id text;
  v_existing public.source_publish_packages%rowtype;
  v_header_id uuid;
  v_validation_status text;
  v_sdv jsonb;
  v_sec jsonb;
  v_fld jsonb;
  v_rule jsonb;
  v_map record;
  v_compiler_sdv_id text;
  v_phase4a_sdv_id uuid;
  v_phase4a_field_id uuid;
  v_source_def_id uuid;
  v_sort integer;
  v_instrument_code text;
  v_instrument_label text;
  v_sdv_node_id text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: authenticated user required';
  end if;

  if p_organization_id is null or p_study_id is null or p_study_version_id is null then
    raise exception 'organization_id, study_id, and study_version_id are required';
  end if;

  if p_publish_package is null or p_source_definitions is null or p_approval is null then
    raise exception 'publish_package, source_definitions, and approval JSON payloads are required';
  end if;

  if not public.phase4c_user_can_publish_source_package(p_organization_id, p_study_id) then
    raise exception 'UNAUTHORIZED_PUBLISH: caller cannot publish for this study';
  end if;

  if not exists (
    select 1 from public.studies s
    where s.id = p_study_id and s.organization_id = p_organization_id
  ) then
    raise exception 'STUDY_TENANT_MISMATCH: study not in organization';
  end if;

  if not exists (
    select 1 from public.study_versions sv
    where sv.id = p_study_version_id and sv.study_id = p_study_id
  ) then
    raise exception 'STUDY_VERSION_MISMATCH: study_version_id invalid for study';
  end if;

  v_package_id := nullif(trim(p_publish_package ->> 'package_id'), '');
  if v_package_id is null then
    raise exception 'package_id is required';
  end if;

  -- Eligibility (payload-level, before write)
  if coalesce((p_publish_package ->> 'publish_ready')::boolean, false) is distinct from true then
    raise exception 'PACKAGE_NOT_READY: publish_ready must be true';
  end if;

  if coalesce(p_approval ->> 'decision', '') <> 'approved' then
    raise exception 'APPROVAL_NOT_APPROVED: decision must be approved';
  end if;

  if coalesce((p_approval ->> 'publish_eligible')::boolean, false) is distinct from true then
    raise exception 'APPROVAL_NOT_ELIGIBLE: publish_eligible must be true';
  end if;

  if not public.phase4c_publish_json_errors_empty(p_publish_package -> 'validation_snapshot' -> 'errors')
     or not public.phase4c_publish_json_errors_empty(p_source_definitions -> 'validation_report' -> 'errors')
     or coalesce((p_source_definitions -> 'validation_report' ->> 'passed')::boolean, true) is distinct from true then
    raise exception 'VALIDATION_ERRORS_PRESENT: validation_report must have no errors';
  end if;

  if not public.phase4c_package_hash_is_valid(p_publish_package ->> 'source_definitions_hash')
     or not public.phase4c_package_hash_is_valid(p_publish_package ->> 'preview_hash')
     or not public.phase4c_package_hash_is_valid(p_publish_package ->> 'approval_hash') then
    raise exception 'HASH_MISMATCH: package hash fields must be sha256:* format';
  end if;

  if p_publish_package ->> 'source_definitions_hash' is distinct from p_approval ->> 'source_definitions_hash' then
    raise exception 'HASH_MISMATCH: approval source_definitions_hash mismatch';
  end if;

  if p_publish_package ->> 'preview_hash' is distinct from coalesce(p_approval ->> 'preview_hash', p_publish_package ->> 'preview_hash') then
    raise exception 'HASH_MISMATCH: preview_hash mismatch between package and approval';
  end if;

  if p_publish_package ->> 'graph_id' is distinct from p_source_definitions ->> 'graph_id'
     or p_publish_package ->> 'input_hash' is distinct from p_source_definitions ->> 'input_hash'
     or p_publish_package ->> 'compiler_output_id' is distinct from p_source_definitions ->> 'compiler_output_id' then
    raise exception 'GRAPH_METADATA_MISMATCH: graph_id/input_hash/compiler_output_id must align';
  end if;

  if p_approval ->> 'graph_id' is not null
     and p_approval ->> 'graph_id' is distinct from p_publish_package ->> 'graph_id' then
    raise exception 'GRAPH_METADATA_MISMATCH: approval graph_id mismatch';
  end if;

  v_validation_status := coalesce(
    p_publish_package -> 'validation_snapshot' ->> 'validation_status',
    p_source_definitions -> 'validation_report' ->> 'validation_status',
    'valid'
  );
  if v_validation_status not in ('valid', 'warning') then
    raise exception 'VALIDATION_ERRORS_PRESENT: validation_status must be valid or warning';
  end if;

  -- Idempotency
  select * into v_existing
  from public.source_publish_packages spp
  where spp.organization_id = p_organization_id
    and spp.package_id = v_package_id;

  if found then
    if v_existing.persisted_at is not null then
      if v_existing.source_definitions_hash is distinct from p_publish_package ->> 'source_definitions_hash'
         or v_existing.preview_hash is distinct from p_publish_package ->> 'preview_hash'
         or v_existing.approval_hash is distinct from p_publish_package ->> 'approval_hash' then
        raise exception 'PACKAGE_HASH_CONFLICT: package_id already persisted with different hashes';
      end if;
      return public.phase4c_build_publish_summary(p_organization_id, v_package_id, true);
    else
      raise exception 'PACKAGE_PUBLISH_INCOMPLETE: package header exists without persisted_at; manual review required';
    end if;
  end if;

  -- Temp mapping tables
  create temp table _phase4c_sdv_map (
    compiler_sdv_id text primary key,
    phase4a_sdv_id uuid not null
  ) on commit drop;

  create temp table _phase4c_field_map (
    compiler_field_id text primary key,
    phase4a_field_id uuid not null
  ) on commit drop;

  -- Header
  insert into public.source_publish_packages (
    organization_id,
    study_id,
    study_version_id,
    package_id,
    graph_id,
    input_hash,
    compiler_output_id,
    compiler_version,
    approval_id,
    publish_ready,
    source_definitions_hash,
    preview_hash,
    approval_hash,
    package_hash,
    validation_status
  )
  values (
    p_organization_id,
    p_study_id,
    p_study_version_id,
    v_package_id,
    p_publish_package ->> 'graph_id',
    p_publish_package ->> 'input_hash',
    p_publish_package ->> 'compiler_output_id',
    coalesce(p_publish_package ->> 'compiler_version', p_source_definitions ->> 'compiler_version', '0.1.0'),
    coalesce(p_publish_package ->> 'approval_id', p_approval ->> 'approval_id'),
    true,
    p_publish_package ->> 'source_definitions_hash',
    p_publish_package ->> 'preview_hash',
    p_publish_package ->> 'approval_hash',
    nullif(p_publish_package ->> 'package_hash', ''),
    v_validation_status
  )
  returning id into v_header_id;

  -- Phase 4A: SDVs (draft) then fields then publish
  for v_sdv in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'source_definition_versions', '[]'::jsonb)) loop
    v_compiler_sdv_id := v_sdv ->> 'source_definition_version_id';
    if v_compiler_sdv_id is null or length(trim(v_compiler_sdv_id)) = 0 then
      raise exception 'source_definition_versions row missing source_definition_version_id';
    end if;

    v_instrument_code := coalesce(v_sdv ->> 'instrument_code', v_sdv ->> 'visit_code');
    v_instrument_label := coalesce(v_sdv ->> 'visit_name', v_sdv ->> 'visit_code', v_instrument_code);
    v_source_def_id := public.phase4c_resolve_source_definition_for_instrument(
      p_organization_id,
      p_study_id,
      v_instrument_code,
      v_instrument_label
    );

    insert into public.source_definition_versions (
      organization_id,
      study_id,
      study_version_id,
      source_definition_id,
      version_label,
      lifecycle_status,
      schema_manifest_hash,
      meta
    )
    values (
      p_organization_id,
      p_study_id,
      p_study_version_id,
      v_source_def_id,
      coalesce(v_sdv ->> 'version_label', v_sdv ->> 'cpst_version', 'v1.0.0'),
      'draft',
      p_source_definitions ->> 'input_hash',
      jsonb_build_object(
        'compiler_sdv_id', v_compiler_sdv_id,
        'visit_id', v_sdv ->> 'visit_id',
        'visit_code', v_sdv ->> 'visit_code',
        'graph_id', p_source_definitions ->> 'graph_id',
        'package_id', v_package_id,
        'source_status', v_sdv ->> 'source_status'
      )
    )
    returning id into v_phase4a_sdv_id;

    insert into _phase4c_sdv_map (compiler_sdv_id, phase4a_sdv_id)
    values (v_compiler_sdv_id, v_phase4a_sdv_id);
  end loop;

  v_sort := 0;
  for v_fld in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'source_fields', '[]'::jsonb)) loop
    v_compiler_sdv_id := v_fld ->> 'source_definition_version_id';
    select m.phase4a_sdv_id into v_phase4a_sdv_id
    from _phase4c_sdv_map m
    where m.compiler_sdv_id = v_compiler_sdv_id;

    if v_phase4a_sdv_id is null then
      raise exception 'source_fields row references unknown source_definition_version_id %', v_compiler_sdv_id;
    end if;

    v_sort := v_sort + 1;

    insert into public.source_fields (
      organization_id,
      study_id,
      source_definition_version_id,
      field_key,
      label,
      instructions,
      sort_order,
      is_required,
      validation_rules,
      widget_hint,
      options
    )
    values (
      p_organization_id,
      p_study_id,
      v_phase4a_sdv_id,
      coalesce(v_fld ->> 'field_key', v_fld ->> 'field_name'),
      coalesce(v_fld ->> 'display_label', v_fld ->> 'label', v_fld ->> 'field_name'),
      coalesce(nullif(trim(v_fld ->> 'display_label'), ''), v_fld ->> 'field_name', 'Capture field'),
      v_sort,
      coalesce((v_fld ->> 'is_required')::boolean, (v_fld ->> 'required')::boolean, false),
      case
        when v_fld ->> 'validation_rule' is not null then
          jsonb_build_object('validation_rule_id', v_fld ->> 'validation_rule')
        else '{}'::jsonb
      end,
      public.phase4c_map_compiler_data_type_to_widget(v_fld ->> 'data_type'),
      case
        when v_fld ->> 'allowed_list_name' is not null then
          jsonb_build_object('list_code', v_fld ->> 'allowed_list_name')
        when v_fld ->> 'options_manifest_key' is not null then
          jsonb_build_object('list_code', v_fld ->> 'options_manifest_key')
        else null
      end
    )
    returning id into v_phase4a_field_id;

    insert into _phase4c_field_map (compiler_field_id, phase4a_field_id)
    values (v_fld ->> 'source_field_id', v_phase4a_field_id);
  end loop;

  update public.source_definition_versions sdv
  set lifecycle_status = 'published'
  where sdv.id in (select phase4a_sdv_id from _phase4c_sdv_map);

  -- Published snapshots: SDV
  for v_sdv in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'source_definition_versions', '[]'::jsonb)) loop
    v_compiler_sdv_id := v_sdv ->> 'source_definition_version_id';
    v_sdv_node_id := coalesce(v_sdv ->> 'visit_node_id', 'visit:' || coalesce(v_sdv ->> 'visit_id', 'unknown'));

    insert into public.published_source_definition_versions (
      organization_id,
      package_id,
      source_definition_version_id,
      study_id,
      study_version_id,
      visit_node_id,
      visit_code,
      visit_name,
      source_status,
      compiler_version,
      input_hash,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_compiler_sdv_id,
      p_study_id,
      p_study_version_id,
      v_sdv_node_id,
      v_sdv ->> 'visit_code',
      coalesce(v_sdv ->> 'visit_name', v_sdv ->> 'visit_code'),
      coalesce(v_sdv ->> 'source_status', 'draft_generated'),
      coalesce(v_sdv ->> 'compiler_version', p_source_definitions ->> 'compiler_version', '0.1.0'),
      coalesce(v_sdv ->> 'input_hash', p_source_definitions ->> 'input_hash'),
      coalesce(v_sdv -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Sections
  for v_sec in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'source_sections', '[]'::jsonb)) loop
    insert into public.published_source_sections (
      organization_id,
      package_id,
      source_definition_version_id,
      source_section_id,
      procedure_node_id,
      section_name,
      section_order,
      source_type,
      required_status,
      detailed_capture_required,
      external_reference_required,
      owner_role,
      signature_required,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_sec ->> 'source_definition_version_id',
      v_sec ->> 'source_section_id',
      coalesce(v_sec ->> 'procedure_node_id', v_sec ->> 'procedure_id'),
      coalesce(v_sec ->> 'section_name', v_sec ->> 'label', v_sec ->> 'section_code'),
      coalesce((v_sec ->> 'section_order')::int, (v_sec ->> 'sort_order')::int, 0),
      v_sec ->> 'source_type',
      v_sec ->> 'required_status',
      coalesce((v_sec ->> 'detailed_capture_required')::boolean, true),
      coalesce((v_sec ->> 'external_reference_required')::boolean, false),
      v_sec ->> 'owner_role',
      coalesce((v_sec ->> 'signature_required')::boolean, false),
      coalesce(v_sec -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Published fields (snapshot)
  for v_fld in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'source_fields', '[]'::jsonb)) loop
    insert into public.published_source_fields (
      organization_id,
      package_id,
      source_section_id,
      source_field_id,
      field_name,
      display_label,
      data_type,
      required,
      validation_rule,
      conditional_visibility,
      allowed_list_name,
      export_name,
      source_origin_mode,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_fld ->> 'source_section_id',
      v_fld ->> 'source_field_id',
      coalesce(v_fld ->> 'field_name', v_fld ->> 'field_key'),
      coalesce(v_fld ->> 'display_label', v_fld ->> 'label'),
      coalesce(v_fld ->> 'data_type', 'text'),
      coalesce((v_fld ->> 'is_required')::boolean, (v_fld ->> 'required')::boolean, false),
      v_fld ->> 'validation_rule',
      v_fld ->> 'conditional_visibility',
      v_fld ->> 'allowed_list_name',
      v_fld ->> 'export_name',
      v_fld ->> 'source_origin_mode',
      coalesce(v_fld -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Link Phase 4A (0032 helpers only)
  for v_map in select m.compiler_sdv_id, m.phase4a_sdv_id from _phase4c_sdv_map m loop
    perform public.phase4c_link_published_sdv_to_phase4a(
      p_organization_id,
      v_package_id,
      v_map.compiler_sdv_id,
      v_map.phase4a_sdv_id
    );
  end loop;

  for v_map in select f.compiler_field_id, f.phase4a_field_id from _phase4c_field_map f loop
    perform public.phase4c_link_published_field_to_phase4a(
      p_organization_id,
      v_package_id,
      v_map.compiler_field_id,
      v_map.phase4a_field_id
    );
  end loop;

  -- Validation rules
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'validation_rules', '[]'::jsonb)) loop
    insert into public.published_source_validation_rules (
      organization_id,
      package_id,
      validation_rule_id,
      scope,
      scope_id,
      rule_type,
      rule_payload_json,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'validation_rule_id',
      'field',
      coalesce(v_rule ->> 'source_field_id', v_rule ->> 'field_name'),
      coalesce(v_rule ->> 'rule_type', 'expression'),
      jsonb_strip_nulls(
        jsonb_build_object(
          'expression', v_rule ->> 'expression',
          'field_name', v_rule ->> 'field_name',
          'validation_code', v_rule ->> 'validation_code',
          'validation_message', v_rule ->> 'validation_message'
        )
      ),
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Conditional rules
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'conditional_rules', '[]'::jsonb)) loop
    insert into public.published_source_conditional_rules (
      organization_id,
      package_id,
      conditional_rule_id,
      rule_id,
      trigger_type,
      trigger_field,
      operator,
      trigger_value,
      then_action,
      applies_to,
      applies_to_id,
      hard_stop,
      requires_review,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'conditional_rule_id',
      coalesce(v_rule ->> 'rule_id', v_rule ->> 'rule_name'),
      v_rule ->> 'trigger_type',
      v_rule ->> 'trigger_field',
      v_rule ->> 'operator',
      v_rule ->> 'trigger_value',
      v_rule ->> 'then_action',
      v_rule ->> 'applies_to',
      v_rule ->> 'applies_to_id',
      coalesce((v_rule ->> 'hard_stop')::boolean, false),
      coalesce((v_rule ->> 'requires_review')::boolean, false),
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Workflow requirements
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'workflow_requirements', '[]'::jsonb)) loop
    insert into public.published_source_workflow_requirements (
      organization_id,
      package_id,
      workflow_requirement_id,
      workflow_type,
      trigger_expression,
      action,
      required_role,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'workflow_requirement_id',
      coalesce(v_rule ->> 'workflow_type', 'WORKFLOW'),
      coalesce(v_rule ->> 'trigger_expression', v_rule ->> 'workflow_type'),
      v_rule ->> 'action',
      v_rule ->> 'required_role',
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Signature requirements
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'signature_requirements', '[]'::jsonb)) loop
    insert into public.published_source_signature_requirements (
      organization_id,
      package_id,
      signature_requirement_id,
      source_definition_version_id,
      source_section_id,
      required_role,
      signature_order,
      signature_meaning_code,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'signature_requirement_id',
      v_rule ->> 'source_definition_version_id',
      v_rule ->> 'source_section_id',
      coalesce(v_rule ->> 'role_code', 'investigator'),
      1,
      v_rule ->> 'signature_meaning_code',
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- External source requirements
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'external_source_requirements', '[]'::jsonb)) loop
    insert into public.published_source_external_requirements (
      organization_id,
      package_id,
      external_source_requirement_id,
      source_definition_version_id,
      source_section_id,
      external_source_name,
      external_system_type,
      ref_id_field,
      status_field,
      attachment_allowed,
      audit_requirement,
      capture_strategy,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'external_source_requirement_id',
      v_rule ->> 'source_definition_version_id',
      v_rule ->> 'source_section_id',
      v_rule ->> 'external_source_name',
      coalesce(v_rule ->> 'external_system_type', 'external'),
      v_rule ->> 'ref_id_field',
      v_rule ->> 'status_field',
      coalesce((v_rule ->> 'attachment_allowed')::boolean, false),
      coalesce((v_rule ->> 'audit_requirement')::boolean, true),
      coalesce(v_rule ->> 'capture_strategy', 'metadata_reference_only'),
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Runtime expectations
  for v_rule in select value from jsonb_array_elements(coalesce(p_source_definitions -> 'runtime_expectations', '[]'::jsonb)) loop
    v_compiler_sdv_id := v_rule ->> 'source_definition_version_id';
    select ps.visit_node_id into v_sdv_node_id
    from public.published_source_definition_versions ps
    where ps.organization_id = p_organization_id
      and ps.package_id = v_package_id
      and ps.source_definition_version_id = v_compiler_sdv_id
    limit 1;

    insert into public.published_source_runtime_expectations (
      organization_id,
      package_id,
      runtime_expectation_id,
      visit_node_id,
      procedure_node_id,
      visit_id,
      procedure_id,
      required_status,
      procedure_order,
      source_type,
      conditionality,
      provenance_json
    )
    values (
      p_organization_id,
      v_package_id,
      v_rule ->> 'runtime_expectation_id',
      v_sdv_node_id,
      coalesce(v_rule ->> 'procedure_node_id', v_rule ->> 'procedure_id'),
      v_rule ->> 'visit_id',
      v_rule ->> 'procedure_id',
      coalesce(v_rule ->> 'requiredness', v_rule ->> 'required_status'),
      coalesce((v_rule ->> 'execution_order')::int, (v_rule ->> 'procedure_order')::int, 0),
      v_rule ->> 'source_type',
      coalesce(v_rule -> 'conditionality', '{}'::jsonb),
      coalesce(v_rule -> 'provenance', '{}'::jsonb)
    );
  end loop;

  -- Approval evidence
  insert into public.source_publish_approval_evidence (
    organization_id,
    package_id,
    approval_id,
    reviewer_user_id,
    reviewer_role,
    decision,
    reason,
    comments,
    reviewed_at,
    source_definitions_hash,
    preview_hash,
    approval_hash,
    validation_snapshot_json
  )
  values (
    p_organization_id,
    v_package_id,
    coalesce(p_publish_package ->> 'approval_id', p_approval ->> 'approval_id'),
    v_uid,
    p_approval ->> 'reviewer_role',
    'approved',
    coalesce(nullif(trim(p_approval ->> 'reason'), ''), 'Approved for publish'),
    p_approval ->> 'comments',
    coalesce((p_approval ->> 'reviewed_at')::timestamptz, now()),
    p_publish_package ->> 'source_definitions_hash',
    p_publish_package ->> 'preview_hash',
    p_publish_package ->> 'approval_hash',
    coalesce(p_approval -> 'validation_snapshot', p_publish_package -> 'validation_snapshot', '{}'::jsonb)
  );

  perform public.phase4c_assert_publish_package_eligible(p_organization_id, v_package_id);

  if not public.phase4c_publish_package_is_consistent(p_organization_id, v_package_id) then
    raise exception 'CONSISTENCY_CHECK_FAILED: phase4c_publish_package_is_consistent returned false';
  end if;

  perform public.phase4c_touch_persisted_package(v_header_id);

  return public.phase4c_build_publish_summary(p_organization_id, v_package_id, false);
end;
$$;

comment on function public.publish_source_package (uuid, uuid, uuid, jsonb, jsonb, jsonb) is
  'Phase 4C.13: Atomic persist of approved publish package to Phase 4A runtime tables and Phase 4C immutable snapshots.';

revoke all on function public.phase4c_publish_json_errors_empty (jsonb) from public;
revoke all on function public.phase4c_map_compiler_data_type_to_widget (text) from public;
revoke all on function public.phase4c_resolve_source_definition_for_instrument (uuid, uuid, text, text) from public;
revoke all on function public.phase4c_build_publish_summary (uuid, text, boolean) from public;
revoke all on function public.publish_source_package (uuid, uuid, uuid, jsonb, jsonb, jsonb) from public;

grant execute on function public.phase4c_build_publish_summary (uuid, text, boolean) to authenticated;
grant execute on function public.publish_source_package (uuid, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
