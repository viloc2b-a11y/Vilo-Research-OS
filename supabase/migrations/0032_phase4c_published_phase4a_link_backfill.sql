-- Phase 4C.9 patch: controlled one-time Phase 4A link backfill on published snapshots.
-- Dependencies: 0026–0031. Does not add publish_source_package RPC. Phase 3C / 0020–0025 unchanged.
--
-- Generated snapshot payload remains immutable. phase4a_* columns are one-time bridge links
-- to Phase 4A runtime FK targets (source_definition_versions / source_fields). Phase 4B capture
-- must use those Phase 4A UUIDs — not published_* row ids.

-- ---------------------------------------------------------------------------
-- Controlled before-write (SDV + fields only; other tables keep deny_mutation)
-- ---------------------------------------------------------------------------

create or replace function public.phase4c_published_snapshot_before_write () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_compiler_sdv_id text;
  v_parent_phase4a_sdv uuid;
  v_parent_study_id uuid;
begin
  if tg_op = 'DELETE' then
    raise exception '% rows are immutable snapshot records; amendments require a new publish package',
      tg_table_name;
  end if;

  if tg_table_name = 'published_source_definition_versions' then
    if (to_jsonb (new) - 'phase4a_source_definition_version_id') is distinct from (to_jsonb (old) - 'phase4a_source_definition_version_id') then
      raise exception 'published_source_definition_versions payload is immutable except one-time phase4a_source_definition_version_id link backfill';
    end if;

    if old.phase4a_source_definition_version_id is not null
    and new.phase4a_source_definition_version_id is null then
      raise exception 'phase4a_source_definition_version_id cannot be cleared after link backfill';
    end if;

    if old.phase4a_source_definition_version_id is not null then
      if new.phase4a_source_definition_version_id is distinct from old.phase4a_source_definition_version_id then
        raise exception 'phase4a_source_definition_version_id cannot change once set';
      end if;

      return new;
    end if;

    if new.phase4a_source_definition_version_id is null then
      return new;
    end if;

    if not exists (
      select
        1
      from
        public.source_definition_versions sdv
      where
        sdv.id = new.phase4a_source_definition_version_id
        and sdv.organization_id = new.organization_id
        and sdv.study_id = new.study_id
        and sdv.lifecycle_status = 'published'
    ) then
      raise exception 'phase4a_source_definition_version_id must reference a published Phase 4A source_definition_versions row for this organization and study';
    end if;

    return new;
  end if;

  if tg_table_name = 'published_source_fields' then
    if (to_jsonb (new) - 'phase4a_source_field_id') is distinct from (to_jsonb (old) - 'phase4a_source_field_id') then
      raise exception 'published_source_fields payload is immutable except one-time phase4a_source_field_id link backfill';
    end if;

    if old.phase4a_source_field_id is not null
    and new.phase4a_source_field_id is null then
      raise exception 'phase4a_source_field_id cannot be cleared after link backfill';
    end if;

    if old.phase4a_source_field_id is not null then
      if new.phase4a_source_field_id is distinct from old.phase4a_source_field_id then
        raise exception 'phase4a_source_field_id cannot change once set';
      end if;

      return new;
    end if;

    if new.phase4a_source_field_id is null then
      return new;
    end if;

    select
      psec.source_definition_version_id into v_compiler_sdv_id
    from
      public.published_source_sections psec
    where
      psec.organization_id = new.organization_id
      and psec.package_id = new.package_id
      and psec.source_section_id = new.source_section_id;

    if v_compiler_sdv_id is null then
      raise exception 'published_source_fields row missing parent published_source_sections snapshot';
    end if;

    select
      psdv.phase4a_source_definition_version_id,
      psdv.study_id into v_parent_phase4a_sdv,
      v_parent_study_id
    from
      public.published_source_definition_versions psdv
    where
      psdv.organization_id = new.organization_id
      and psdv.package_id = new.package_id
      and psdv.source_definition_version_id = v_compiler_sdv_id;

    if v_parent_study_id is null then
      raise exception 'published_source_fields parent source_definition_version snapshot not found';
    end if;

    if not exists (
      select
        1
      from
        public.source_fields sf
        join public.source_definition_versions sdv on sdv.id = sf.source_definition_version_id
      where
        sf.id = new.phase4a_source_field_id
        and sf.organization_id = new.organization_id
        and sf.study_id = v_parent_study_id
        and sdv.lifecycle_status = 'published'
        and (
          v_parent_phase4a_sdv is null
          or sf.source_definition_version_id = v_parent_phase4a_sdv
        )
    ) then
      raise exception 'phase4a_source_field_id must reference a published Phase 4A source_fields row for this organization/study and parent instrument when linked';
    end if;

    return new;
  end if;

  raise exception '% rows are immutable snapshot records; amendments require a new publish package',
    tg_table_name;
end;
$$;

comment on function public.phase4c_published_snapshot_before_write () is
  'Allows one-time NULL→UUID backfill of phase4a_* bridge columns on published SDV/field snapshots only. All other columns and tables remain immutable.';

-- ---------------------------------------------------------------------------
-- Rewire triggers (SDV + fields)
-- ---------------------------------------------------------------------------

drop trigger if exists published_sdv_deny_mutation on public.published_source_definition_versions;

drop trigger if exists published_fields_deny_mutation on public.published_source_fields;

drop trigger if exists published_sdv_before_write on public.published_source_definition_versions;

create trigger published_sdv_before_write before update
or delete on public.published_source_definition_versions for each row
execute function public.phase4c_published_snapshot_before_write ();

drop trigger if exists published_fields_before_write on public.published_source_fields;

create trigger published_fields_before_write before update
or delete on public.published_source_fields for each row
execute function public.phase4c_published_snapshot_before_write ();

comment on column public.published_source_definition_versions.phase4a_source_definition_version_id is
  'One-time bridge to public.source_definition_versions.id (Phase 4A runtime FK). source_response_sets bind here — not to published_source_definition_versions.id.';

comment on column public.published_source_fields.phase4a_source_field_id is
  'One-time bridge to public.source_fields.id (Phase 4A runtime FK). source_responses bind here — not to published_source_fields.id.';

-- ---------------------------------------------------------------------------
-- Narrow SECURITY DEFINER link helpers (no broad UPDATE policies)
-- ---------------------------------------------------------------------------

create or replace function public.phase4c_link_published_sdv_to_phase4a (
  p_organization_id uuid,
  p_package_id text,
  p_published_source_definition_version_id text,
  p_phase4a_source_definition_version_id uuid
) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  v_pkg public.source_publish_packages%rowtype;
  v_updated integer;
begin
  if auth.uid () is null then
    raise exception 'authenticated user required';
  end if;

  if p_organization_id is null
  or p_package_id is null
  or length(trim(both from p_package_id)) = 0
  or p_published_source_definition_version_id is null
  or length(trim(both from p_published_source_definition_version_id)) = 0
  or p_phase4a_source_definition_version_id is null then
    raise exception 'organization_id, package_id, published source_definition_version_id, and phase4a id are required';
  end if;

  select *
  into v_pkg
  from public.source_publish_packages spp
  where spp.organization_id = p_organization_id
    and spp.package_id = p_package_id;

  if not found then
    raise exception 'publish package not found: org=% package_id=%', p_organization_id, p_package_id;
  end if;

  if not public.phase4c_user_can_publish_source_package (v_pkg.organization_id, v_pkg.study_id) then
    raise exception 'caller not authorized to link published snapshots for package %', p_package_id;
  end if;

  if v_pkg.publish_ready is distinct from true then
    raise exception 'publish package % is not publish_ready', p_package_id;
  end if;

  if v_pkg.persisted_at is not null then
    raise exception 'publish package % is already persisted; phase4a links cannot be backfilled', p_package_id;
  end if;

  update public.published_source_definition_versions psdv
  set
    phase4a_source_definition_version_id = p_phase4a_source_definition_version_id
  where
    psdv.organization_id = p_organization_id
    and psdv.package_id = p_package_id
    and psdv.source_definition_version_id = p_published_source_definition_version_id
    and psdv.phase4a_source_definition_version_id is null;

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'expected exactly one published_source_definition_versions row to link (updated %)', v_updated;
  end if;
end;
$$;

comment on function public.phase4c_link_published_sdv_to_phase4a (uuid, text, text, uuid) is
  'SECURITY DEFINER: one-time NULL→UUID link from published SDV snapshot to Phase 4A source_definition_versions.id before package persisted_at is set.';

create or replace function public.phase4c_link_published_field_to_phase4a (
  p_organization_id uuid,
  p_package_id text,
  p_published_source_field_id text,
  p_phase4a_source_field_id uuid
) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  v_pkg public.source_publish_packages%rowtype;
  v_updated integer;
begin
  if auth.uid () is null then
    raise exception 'authenticated user required';
  end if;

  if p_organization_id is null
  or p_package_id is null
  or length(trim(both from p_package_id)) = 0
  or p_published_source_field_id is null
  or length(trim(both from p_published_source_field_id)) = 0
  or p_phase4a_source_field_id is null then
    raise exception 'organization_id, package_id, published source_field_id, and phase4a id are required';
  end if;

  select *
  into v_pkg
  from public.source_publish_packages spp
  where spp.organization_id = p_organization_id
    and spp.package_id = p_package_id;

  if not found then
    raise exception 'publish package not found: org=% package_id=%', p_organization_id, p_package_id;
  end if;

  if not public.phase4c_user_can_publish_source_package (v_pkg.organization_id, v_pkg.study_id) then
    raise exception 'caller not authorized to link published snapshots for package %', p_package_id;
  end if;

  if v_pkg.publish_ready is distinct from true then
    raise exception 'publish package % is not publish_ready', p_package_id;
  end if;

  if v_pkg.persisted_at is not null then
    raise exception 'publish package % is already persisted; phase4a links cannot be backfilled', p_package_id;
  end if;

  update public.published_source_fields pf
  set
    phase4a_source_field_id = p_phase4a_source_field_id
  where
    pf.organization_id = p_organization_id
    and pf.package_id = p_package_id
    and pf.source_field_id = p_published_source_field_id
    and pf.phase4a_source_field_id is null;

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'expected exactly one published_source_fields row to link (updated %)', v_updated;
  end if;
end;
$$;

comment on function public.phase4c_link_published_field_to_phase4a (uuid, text, text, uuid) is
  'SECURITY DEFINER: one-time NULL→UUID link from published field snapshot to Phase 4A source_fields.id before package persisted_at is set.';

revoke all on function public.phase4c_link_published_sdv_to_phase4a (uuid, text, text, uuid)
from public;

grant execute on function public.phase4c_link_published_sdv_to_phase4a (uuid, text, text, uuid) to authenticated;

revoke all on function public.phase4c_link_published_field_to_phase4a (uuid, text, text, uuid)
from public;

grant execute on function public.phase4c_link_published_field_to_phase4a (uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes (composite org + phase4a for harness lookups)
-- ---------------------------------------------------------------------------

create index if not exists published_sdv_org_phase4a_sdv_idx on public.published_source_definition_versions (
  organization_id,
  phase4a_source_definition_version_id
);

create index if not exists published_fields_org_phase4a_field_idx on public.published_source_fields (organization_id, phase4a_source_field_id);
