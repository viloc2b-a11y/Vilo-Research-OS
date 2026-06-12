-- Forward-only migration: align protocol identifier aliases to canonical coded names.
--
-- Context: migration 0091 sanitized runtime rows using intermediate aliases
-- (STUDY-KOA-001, STUDY-INF-001, Compound-X, Compound-Y, Sponsor-A, Sponsor-B).
-- The approved canonical identifiers are now:
--   VALIDATION_PROTOCOL_001, VALIDATION_PROTOCOL_002
--   Investigational Product A, Investigational Product B
--   Sponsor A, Sponsor B
--
-- This migration:
--   1. Updates the sanitize function to use canonical identifiers going forward.
--   2. Runs a one-time UPDATE on affected tables to convert intermediate aliases
--      and any remaining real identifiers.

-- Step 1: Replace sanitize function with canonical identifier mapping.
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

  -- Canonical replacements (intermediate aliases → canonical coded identifiers).
  v_value := replace(v_value, 'STUDY-KOA-001', 'VALIDATION_PROTOCOL_001');
  v_value := replace(v_value, 'STUDY-INF-001', 'VALIDATION_PROTOCOL_002');
  v_value := replace(v_value, 'Compound-X', 'Investigational Product A');
  v_value := replace(v_value, 'Compound-Y', 'Investigational Product B');
  v_value := replace(v_value, 'Sponsor-A', 'Sponsor A');
  v_value := replace(v_value, 'Sponsor-B', 'Sponsor B');

  return v_value;
end;
$$;

-- Step 2: Re-apply sanitize function across runtime tables to convert intermediate
-- aliases already written by migration 0091 to canonical coded identifiers.
-- Skips rows where no update is needed (idempotent).
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
          v_target.table_name, v_target.column_name, v_target.column_name,
          v_target.column_name, v_target.column_name, v_target.column_name
        );
      else
        execute format(
          'update public.%I set %I = public.protocol_sanitize_runtime_text(%I) where %I is not null and %I <> public.protocol_sanitize_runtime_text(%I)',
          v_target.table_name, v_target.column_name, v_target.column_name,
          v_target.column_name, v_target.column_name, v_target.column_name
        );
      end if;
    end if;
  end loop;
end;
$$;
