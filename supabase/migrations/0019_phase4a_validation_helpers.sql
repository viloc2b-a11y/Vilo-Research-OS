-- Phase 4A: shared helpers for future publish/bind RPCs & app-side checks (Phase 3C RPC bodies unchanged).

create or replace function public.phase4a_jsonb_octet_length (_payload jsonb) returns integer language sql immutable
set
  search_path = public as $$
select
  octet_length(coalesce(_payload::text, 'null'));
$$;

create or replace function public.phase4a_jsonb_within_limit (_payload jsonb, _max_octets integer) returns boolean language sql immutable
set
  search_path = public as $$
select
  public.phase4a_jsonb_octet_length (_payload) <= _max_octets;
$$;

create or replace function public.phase4a_sdv_authoring_editable (_source_definition_version_id uuid) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  exists (
    select
      1
    from
      public.source_definition_versions sdv
    where
      sdv.id = _source_definition_version_id
      and sdv.lifecycle_status in ('draft', 'in_review')
  );
$$;

create or replace function public.phase4a_sdv_is_published_binding_target (_source_definition_version_id uuid) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  exists (
    select
      1
    from
      public.source_definition_versions sdv
    where
      sdv.id = _source_definition_version_id
      and sdv.lifecycle_status = 'published'
  );
$$;

comment on function public.phase4a_sdv_authoring_editable (uuid) is 'True when manifests (source_fields) may still change — draft or in_review only.';

comment on function public.phase4a_sdv_is_published_binding_target (uuid) is 'True when a version row can be cited from procedure bindings or nullable execution FK.';

revoke all on function public.phase4a_jsonb_octet_length (jsonb) from public;

grant execute on function public.phase4a_jsonb_octet_length (jsonb) to authenticated;

revoke all on function public.phase4a_jsonb_within_limit (jsonb, integer) from public;

grant execute on function public.phase4a_jsonb_within_limit (jsonb, integer) to authenticated;

revoke all on function public.phase4a_sdv_authoring_editable (uuid) from public;

grant execute on function public.phase4a_sdv_authoring_editable (uuid) to authenticated;

revoke all on function public.phase4a_sdv_is_published_binding_target (uuid) from public;

grant execute on function public.phase4a_sdv_is_published_binding_target (uuid) to authenticated;
