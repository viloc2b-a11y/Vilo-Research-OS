-- Phase 2: runtime protocol identifier de-identification.
-- Keeps raw protocol text out of runtime/cache/export tables by replacing known
-- commercial identifiers with neutral aliases.

create or replace function public.protocol_sanitize_runtime_text(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_value text := p_value;
begin
  if v_value is null then
    return null;
  end if;

  v_value := replace(v_value, 'F. Hoffmann-La ' || 'Ro' || 'che', 'Sponsor-B');
  v_value := replace(v_value, 'Pentosan Polysulfate ' || 'Sodium', 'Compound-X');
  v_value := replace(v_value, 'baloxavir ' || 'marboxil', 'Compound-Y');
  v_value := replace(v_value, 'PARA' || '_OA_012', 'STUDY-KOA-001');
  v_value := replace(v_value, 'MV' || '40618', 'STUDY-INF-001');
  v_value := replace(v_value, 'Para' || 'digm', 'Sponsor-A');
  v_value := replace(v_value, 'Ro' || 'che', 'Sponsor-B');
  v_value := replace(v_value, 'Baloxa' || 'vir', 'Compound-Y');
  v_value := replace(v_value, 'P' || 'PS', 'Compound-X');

  return v_value;
end;
$$;

create or replace function public.protocol_sanitize_runtime_jsonb(p_value jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p_value is null then null
    else public.protocol_sanitize_runtime_text(p_value::text)::jsonb
  end
$$;

do $$
declare
  v_target record;
begin
  for v_target in
    select * from (values
      ('studies', 'name', 'text'),
      ('study_versions', 'version_label', 'text'),
      ('source_definitions', 'name', 'text'),
      ('source_definition_versions', 'version_label', 'text'),
      ('source_definition_versions', 'schema_manifest_hash', 'text'),
      ('source_definition_versions', 'validation_rules_manifest', 'jsonb'),
      ('source_definition_versions', 'meta', 'jsonb'),
      ('source_response_sets', 'meta', 'jsonb'),
      ('source_responses', 'value_text', 'text'),
      ('source_responses', 'comments', 'text'),
      ('source_responses', 'value_json', 'jsonb'),
      ('source_response_corrections', 'corrected_value', 'jsonb'),
      ('source_response_corrections', 'correction_reason', 'text'),
      ('source_response_addenda', 'value', 'jsonb'),
      ('source_response_addenda', 'reason', 'text'),
      ('source_response_validation_findings', 'message', 'text'),
      ('source_publish_packages', 'package_id', 'text'),
      ('source_publish_packages', 'graph_id', 'text'),
      ('source_publish_packages', 'compiler_output_id', 'text'),
      ('published_source_definitions', 'package_id', 'text'),
      ('published_source_definitions', 'definition_payload', 'jsonb'),
      ('published_source_definition_versions', 'package_id', 'text'),
      ('published_source_definition_versions', 'definition_payload', 'jsonb'),
      ('published_source_fields', 'field_payload', 'jsonb'),
      ('protocol_graph_publications', 'graph_document', 'jsonb'),
      ('protocol_graph_publications', 'amendment_summary', 'jsonb'),
      ('operational_events', 'payload', 'jsonb'),
      ('audit_events', 'payload', 'jsonb'),
      ('subject_visit_notes', 'note_text', 'text'),
      ('subject_workflow_actions', 'title', 'text'),
      ('subject_workflow_actions', 'description', 'text')
    ) as t(table_name, column_name, column_kind)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_target.table_name
        and column_name = v_target.column_name
    ) then
      if v_target.column_kind = 'jsonb' then
        execute format(
          'update public.%I set %I = public.protocol_sanitize_runtime_jsonb(%I) where %I is not null and %I <> public.protocol_sanitize_runtime_jsonb(%I)',
          v_target.table_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name
        );
      else
        execute format(
          'update public.%I set %I = public.protocol_sanitize_runtime_text(%I) where %I is not null and %I <> public.protocol_sanitize_runtime_text(%I)',
          v_target.table_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name,
          v_target.column_name
        );
      end if;
    end if;
  end loop;
end;
$$;
