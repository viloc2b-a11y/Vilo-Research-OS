-- Phase 4C.9: published source definition snapshots (immutable mirrors; Phase 4A = runtime FK).
-- Dependencies: 0026 source_publish_packages, 0015 source_definition_versions, 0016 source_fields.

create or replace function public.phase4c_published_snapshot_deny_mutation () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  raise exception '% rows are immutable snapshot records; amendments require a new publish package',
    tg_table_name;
end;
$$;

comment on function public.phase4c_published_snapshot_deny_mutation () is
  'Phase 4C.9: block UPDATE/DELETE on published_* generated content tables.';

-- ---------------------------------------------------------------------------
-- published_source_definition_versions
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_definition_versions (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  source_definition_version_id text not null,
  phase4a_source_definition_version_id uuid references public.source_definition_versions (id) on delete restrict,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete restrict,
  visit_node_id text not null,
  visit_code text,
  visit_name text,
  source_status text not null,
  compiler_version text not null,
  input_hash text not null,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_sdv_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_sdv_unique_version_per_package unique (
    organization_id,
    package_id,
    source_definition_version_id
  ),
  constraint published_sdv_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_sdv_org_package_idx on public.published_source_definition_versions (organization_id, package_id);

create index if not exists published_sdv_phase4a_sdv_idx on public.published_source_definition_versions (phase4a_source_definition_version_id);

create index if not exists published_sdv_study_idx on public.published_source_definition_versions (study_id);

comment on table public.published_source_definition_versions is
  'Immutable visit-level source definition snapshot per publish package. phase4a_source_definition_version_id links Phase 4B runtime FK target (4A), not this row id.';

comment on column public.published_source_definition_versions.phase4a_source_definition_version_id is
  'FK to public.source_definition_versions.id — required after successful persist for runtime capture.';

-- ---------------------------------------------------------------------------
-- published_source_sections
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_sections (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  source_definition_version_id text not null,
  source_section_id text not null,
  procedure_node_id text,
  section_name text not null,
  section_order integer,
  source_type text,
  required_status text,
  detailed_capture_required boolean not null default false,
  external_reference_required boolean not null default false,
  owner_role text,
  signature_required boolean not null default false,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_sections_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_sections_unique_per_package unique (
    organization_id,
    package_id,
    source_section_id
  ),
  constraint published_sections_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_sections_org_package_idx on public.published_source_sections (organization_id, package_id);

create index if not exists published_sections_sdv_idx on public.published_source_sections (organization_id, package_id, source_definition_version_id);

comment on table public.published_source_sections is
  'Immutable procedure/section snapshot. Runtime capture uses Phase 4A fields bound via phase4a_source_field_id on published_source_fields.';

-- ---------------------------------------------------------------------------
-- published_source_fields
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_fields (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  source_section_id text not null,
  source_field_id text not null,
  phase4a_source_field_id uuid references public.source_fields (id) on delete restrict,
  field_name text not null,
  display_label text not null,
  data_type text not null,
  required boolean not null default false,
  validation_rule text,
  conditional_visibility text,
  allowed_list_name text,
  export_name text,
  source_origin_mode text,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_fields_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_fields_unique_per_package unique (
    organization_id,
    package_id,
    source_field_id
  ),
  constraint published_fields_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict,
  constraint published_fields_fk_section foreign key (organization_id, package_id, source_section_id) references public.published_source_sections (organization_id, package_id, source_section_id) on delete restrict
);

create index if not exists published_fields_org_package_idx on public.published_source_fields (organization_id, package_id);

create index if not exists published_fields_section_idx on public.published_source_fields (organization_id, package_id, source_section_id);

create index if not exists published_fields_phase4a_field_idx on public.published_source_fields (phase4a_source_field_id);

comment on table public.published_source_fields is
  'Immutable field snapshot. source_responses.source_field_id must reference phase4a_source_field_id (Phase 4A), not published_source_fields.id.';

-- ---------------------------------------------------------------------------
-- org alignment triggers (INSERT only)
-- ---------------------------------------------------------------------------

create or replace function public.phase4c_published_row_align_org () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_org uuid;
begin
  select s.organization_id into v_org
  from public.studies s
  where s.id = new.study_id;

  if tg_table_name = 'published_source_sections'
  or tg_table_name = 'published_source_fields' then
    select spp.organization_id into v_org
    from public.source_publish_packages spp
    where spp.organization_id = new.organization_id
      and spp.package_id = new.package_id;

    if v_org is null then
      raise exception 'publish package % not found for organization', new.package_id;
    end if;

    return new;
  end if;

  if v_org is null then
    raise exception 'study_id % not found', new.study_id;
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  return new;
end;
$$;

drop trigger if exists published_sdv_align_org on public.published_source_definition_versions;

create trigger published_sdv_align_org before insert on public.published_source_definition_versions for each row
execute function public.phase4c_published_row_align_org ();

-- ---------------------------------------------------------------------------
-- immutability triggers
-- ---------------------------------------------------------------------------

drop trigger if exists published_sdv_deny_mutation on public.published_source_definition_versions;

create trigger published_sdv_deny_mutation before update
or delete on public.published_source_definition_versions for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_sections_deny_mutation on public.published_source_sections;

create trigger published_sections_deny_mutation before update
or delete on public.published_source_sections for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_fields_deny_mutation on public.published_source_fields;

create trigger published_fields_deny_mutation before update
or delete on public.published_source_fields for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.published_source_definition_versions enable row level security;

alter table public.published_source_sections enable row level security;

alter table public.published_source_fields enable row level security;

drop policy if exists published_sdv_select on public.published_source_definition_versions;

create policy published_sdv_select on public.published_source_definition_versions for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (study_id)
    )
  );

drop policy if exists published_sdv_insert on public.published_source_definition_versions;

create policy published_sdv_insert on public.published_source_definition_versions for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and public.user_has_study_access (study_id)
    and public.phase4c_user_can_publish_source_package (organization_id, study_id)
  );

drop policy if exists published_sections_select on public.published_source_sections;

create policy published_sections_select on public.published_source_sections for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = published_source_sections.organization_id
        and spp.package_id = published_source_sections.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_sections_insert on public.published_source_sections;

create policy published_sections_insert on public.published_source_sections for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = published_source_sections.organization_id
        and spp.package_id = published_source_sections.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_fields_select on public.published_source_fields;

create policy published_fields_select on public.published_source_fields for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = published_source_fields.organization_id
        and spp.package_id = published_source_fields.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_fields_insert on public.published_source_fields;

create policy published_fields_insert on public.published_source_fields for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = published_source_fields.organization_id
        and spp.package_id = published_source_fields.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );
