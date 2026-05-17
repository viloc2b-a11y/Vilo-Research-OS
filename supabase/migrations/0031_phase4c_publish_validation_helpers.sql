-- Phase 4C.9: validation views/functions for publish persistence harness (read-only).
-- Dependencies: 0026–0030. Does not add publish_source_package RPC.

-- ---------------------------------------------------------------------------
-- Violation views (security_invoker — RLS on base tables applies)
-- ---------------------------------------------------------------------------

create or replace view public.phase4c_violation_package_not_ready_but_persisted
with
  (security_invoker = true) as
select
  spp.id,
  spp.organization_id,
  spp.package_id,
  spp.publish_ready,
  spp.persisted_at
from
  public.source_publish_packages spp
where
  spp.persisted_at is not null
  and (
    spp.publish_ready is distinct from true
    or spp.validation_status = 'invalid'
  );

comment on view public.phase4c_violation_package_not_ready_but_persisted is
  'Packages marked persisted while publish_ready=false or validation_status=invalid.';

create or replace view public.phase4c_violation_package_invalid_validation_status
with
  (security_invoker = true) as
select
  spp.id,
  spp.organization_id,
  spp.package_id,
  spp.validation_status
from
  public.source_publish_packages spp
where
  spp.validation_status = 'invalid';

create or replace view public.phase4c_violation_missing_approval_evidence
with
  (security_invoker = true) as
select
  spp.id,
  spp.organization_id,
  spp.package_id,
  spp.approval_id
from
  public.source_publish_packages spp
where
  spp.persisted_at is not null
  and not exists (
    select
      1
    from
      public.source_publish_approval_evidence ev
    where
      ev.organization_id = spp.organization_id
      and ev.package_id = spp.package_id
      and ev.approval_id = spp.approval_id
      and ev.decision = 'approved'
  );

create or replace view public.phase4c_violation_approval_hash_mismatch
with
  (security_invoker = true) as
select
  spp.id,
  spp.organization_id,
  spp.package_id,
  spp.source_definitions_hash as package_source_hash,
  ev.source_definitions_hash as evidence_source_hash,
  spp.preview_hash as package_preview_hash,
  ev.preview_hash as evidence_preview_hash,
  spp.approval_hash as package_approval_hash,
  ev.approval_hash as evidence_approval_hash
from
  public.source_publish_packages spp
  join public.source_publish_approval_evidence ev on ev.organization_id = spp.organization_id
  and ev.package_id = spp.package_id
  and ev.approval_id = spp.approval_id
where
  ev.source_definitions_hash is distinct from spp.source_definitions_hash
  or ev.preview_hash is distinct from spp.preview_hash
  or ev.approval_hash is distinct from spp.approval_hash;

comment on view public.phase4c_violation_approval_hash_mismatch is
  'Approval evidence hash fields must match package header at persist time.';

create or replace view public.phase4c_violation_published_sdv_without_package_header
with
  (security_invoker = true) as
select
  psdv.id,
  psdv.organization_id,
  psdv.package_id,
  psdv.source_definition_version_id
from
  public.published_source_definition_versions psdv
where
  not exists (
    select
      1
    from
      public.source_publish_packages spp
    where
      spp.organization_id = psdv.organization_id
      and spp.package_id = psdv.package_id
  );

create or replace view public.phase4c_violation_published_section_without_sdv
with
  (security_invoker = true) as
select
  psec.id,
  psec.organization_id,
  psec.package_id,
  psec.source_section_id,
  psec.source_definition_version_id
from
  public.published_source_sections psec
where
  not exists (
    select
      1
    from
      public.published_source_definition_versions psdv
    where
      psdv.organization_id = psec.organization_id
      and psdv.package_id = psec.package_id
      and psdv.source_definition_version_id = psec.source_definition_version_id
  );

create or replace view public.phase4c_violation_published_field_without_section
with
  (security_invoker = true) as
select
  pf.id,
  pf.organization_id,
  pf.package_id,
  pf.source_field_id,
  pf.source_section_id
from
  public.published_source_fields pf
where
  not exists (
    select
      1
    from
      public.published_source_sections psec
    where
      psec.organization_id = pf.organization_id
      and psec.package_id = pf.package_id
      and psec.source_section_id = pf.source_section_id
  );

create or replace view public.phase4c_violation_persisted_missing_phase4a_sdv_link
with
  (security_invoker = true) as
select
  psdv.id,
  psdv.organization_id,
  psdv.package_id,
  psdv.source_definition_version_id,
  psdv.phase4a_source_definition_version_id
from
  public.published_source_definition_versions psdv
  join public.source_publish_packages spp on spp.organization_id = psdv.organization_id
  and spp.package_id = psdv.package_id
where
  spp.persisted_at is not null
  and psdv.phase4a_source_definition_version_id is null;

comment on view public.phase4c_violation_persisted_missing_phase4a_sdv_link is
  'After persist, every published SDV snapshot must link Phase 4A source_definition_versions.id for Phase 4B runtime FK.';

create or replace view public.phase4c_violation_persisted_missing_phase4a_field_link
with
  (security_invoker = true) as
select
  pf.id,
  pf.organization_id,
  pf.package_id,
  pf.source_field_id,
  pf.phase4a_source_field_id
from
  public.published_source_fields pf
  join public.source_publish_packages spp on spp.organization_id = pf.organization_id
  and spp.package_id = pf.package_id
where
  spp.persisted_at is not null
  and pf.phase4a_source_field_id is null;

comment on view public.phase4c_violation_persisted_missing_phase4a_field_link is
  'After persist, every published field must link Phase 4A source_fields.id for source_responses.source_field_id.';

create or replace view public.phase4c_violation_duplicate_deterministic_sdv_ids
with
  (security_invoker = true) as
select
  organization_id,
  package_id,
  source_definition_version_id,
  count(*) as row_count
from
  public.published_source_definition_versions
group by
  organization_id,
  package_id,
  source_definition_version_id
having
  count(*) > 1;

create or replace view public.phase4c_violation_duplicate_deterministic_field_ids
with
  (security_invoker = true) as
select
  organization_id,
  package_id,
  source_field_id,
  count(*) as row_count
from
  public.published_source_fields
group by
  organization_id,
  package_id,
  source_field_id
having
  count(*) > 1;

create or replace view public.phase4c_violation_runtime_expectation_orphan
with
  (security_invoker = true) as
select
  rex.id,
  rex.organization_id,
  rex.package_id,
  rex.runtime_expectation_id,
  rex.visit_id,
  rex.procedure_id
from
  public.published_source_runtime_expectations rex
where
  (
    rex.visit_id is not null
    and rex.procedure_id is not null
    and not exists (
      select
        1
      from
        public.published_source_sections psec
      where
        psec.organization_id = rex.organization_id
        and psec.package_id = rex.package_id
        and exists (
          select
            1
          from
            public.published_source_definition_versions psdv
          where
            psdv.organization_id = rex.organization_id
            and psdv.package_id = rex.package_id
            and psdv.source_definition_version_id = psec.source_definition_version_id
            and (
              psdv.visit_code = rex.visit_id
              or psdv.visit_node_id = rex.visit_node_id
            )
        )
    )
  );

comment on view public.phase4c_violation_runtime_expectation_orphan is
  'Runtime expectations should align to a visit/procedure section snapshot in the same package (heuristic on visit_id/visit_node_id).';

-- Capture bind guard: response sets must not reference unpublished Phase 4A SDV when a published package exists for study.
create or replace view public.phase4c_violation_capture_unpublished_sdv_binding
with
  (security_invoker = true) as
select
  srs.id as source_response_set_id,
  srs.organization_id,
  srs.study_id,
  srs.source_definition_version_id,
  sdv.lifecycle_status
from
  public.source_response_sets srs
  join public.source_definition_versions sdv on sdv.id = srs.source_definition_version_id
where
  sdv.lifecycle_status is distinct from 'published';

comment on view public.phase4c_violation_capture_unpublished_sdv_binding is
  'Phase 4B capture must bind published source_definition_versions only (reinforces 0020 trigger intent).';

-- ---------------------------------------------------------------------------
-- Assert helper for persisted packages (post-insert validation)
-- ---------------------------------------------------------------------------

create or replace function public.phase4c_publish_package_is_consistent (
  p_organization_id uuid,
  p_package_id text
) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  not exists (
    select
      1
    from
      public.phase4c_violation_package_not_ready_but_persisted v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_package_invalid_validation_status v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_missing_approval_evidence v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_approval_hash_mismatch v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_published_sdv_without_package_header v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_published_section_without_sdv v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_published_field_without_section v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_persisted_missing_phase4a_sdv_link v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_persisted_missing_phase4a_field_link v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  )
  and not exists (
    select
      1
    from
      public.phase4c_violation_runtime_expectation_orphan v
    where
      v.organization_id = p_organization_id
      and v.package_id = p_package_id
  );
$$;

comment on function public.phase4c_publish_package_is_consistent (uuid, text) is
  'Harness helper: true when no phase4c_violation_* rows exist for the package.';

revoke all on function public.phase4c_publish_package_is_consistent (uuid, text)
from public;

grant execute on function public.phase4c_publish_package_is_consistent (uuid, text) to authenticated;
