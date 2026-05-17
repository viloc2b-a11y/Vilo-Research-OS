-- Phase 4C.9: persistence helper functions (no publish_source_package RPC yet).
-- Dependencies: 0026–0029. Phase 3C RPC bodies unchanged.

-- Re-affirm publish authorization (0026 defines initial version).
create or replace function public.phase4c_user_can_publish_source_package (
  p_org_id uuid,
  p_study_id uuid
) returns boolean language sql stable security definer
set
  search_path = public as $$
select
  public.user_is_org_admin (p_org_id)
  or exists (
    select
      1
    from
      public.study_members sm
    where
      sm.study_id = p_study_id
      and sm.organization_id = p_org_id
      and sm.user_id = auth.uid ()
      and sm.role in ('study_admin', 'coordinator')
  );
$$;

comment on function public.phase4c_user_can_publish_source_package (uuid, uuid) is
  'Phase 4C.9: authorized roles for publish-package persistence. Fails closed for monitor/viewer/lab/finance.';

create or replace function public.phase4c_package_hash_is_valid (p_hash text) returns boolean language sql immutable security invoker
set
  search_path = public as $$
select
  p_hash is not null
  and p_hash ~ '^sha256:[a-f0-9]{64}$';
$$;

comment on function public.phase4c_package_hash_is_valid (text) is
  'Minimal SHA-256 digest format guard for publish package hash fields.';

create or replace function public.phase4c_assert_publish_package_eligible (
  p_organization_id uuid,
  p_package_id text
) returns void language plpgsql stable security invoker
set
  search_path = public as $$
declare
  v_pkg public.source_publish_packages%rowtype;
  v_evidence_count integer;
begin
  select *
  into v_pkg
  from public.source_publish_packages spp
  where spp.organization_id = p_organization_id
    and spp.package_id = p_package_id;

  if not found then
    raise exception 'publish package not found: org=% package_id=%', p_organization_id, p_package_id;
  end if;

  if not public.phase4c_user_can_publish_source_package (v_pkg.organization_id, v_pkg.study_id) then
    raise exception 'caller not authorized to persist publish package %', p_package_id;
  end if;

  if v_pkg.publish_ready is distinct from true then
    raise exception 'publish package % is not publish_ready', p_package_id;
  end if;

  if v_pkg.validation_status not in ('valid', 'warning') then
    raise exception 'publish package % has invalid validation_status %', p_package_id, v_pkg.validation_status;
  end if;

  if not public.phase4c_package_hash_is_valid (v_pkg.source_definitions_hash)
  or not public.phase4c_package_hash_is_valid (v_pkg.preview_hash)
  or not public.phase4c_package_hash_is_valid (v_pkg.approval_hash) then
    raise exception 'publish package % has malformed hash field(s)', p_package_id;
  end if;

  select
    count(*) into v_evidence_count
  from
    public.source_publish_approval_evidence ev
  where
    ev.organization_id = p_organization_id
    and ev.package_id = p_package_id
    and ev.decision = 'approved'
    and ev.approval_id = v_pkg.approval_id
    and ev.source_definitions_hash = v_pkg.source_definitions_hash
    and ev.preview_hash = v_pkg.preview_hash
    and ev.approval_hash = v_pkg.approval_hash;

  if v_evidence_count < 1 then
    raise exception 'publish package % missing matching approved evidence row', p_package_id;
  end if;
end;
$$;

comment on function public.phase4c_assert_publish_package_eligible (uuid, text) is
  'Raises when package header or approval evidence fails publish eligibility checks. Call inside future publish transaction.';

-- Mark package persisted (only persisted_at / persisted_by_user_id mutable on header).
create or replace function public.phase4c_touch_persisted_package (p_package_row_id uuid) returns public.source_publish_packages language plpgsql security definer
set
  search_path = public as $$
declare
  v_pkg public.source_publish_packages%rowtype;
  v_uid uuid;
begin
  v_uid := auth.uid ();

  if v_uid is null then
    raise exception 'authenticated user required';
  end if;

  select *
  into v_pkg
  from public.source_publish_packages
  where id = p_package_row_id;

  if not found then
    raise exception 'source_publish_packages row % not found', p_package_row_id;
  end if;

  if not public.phase4c_user_can_publish_source_package (v_pkg.organization_id, v_pkg.study_id) then
    raise exception 'caller not authorized to mark package persisted';
  end if;

  perform public.phase4c_assert_publish_package_eligible (v_pkg.organization_id, v_pkg.package_id);

  update public.source_publish_packages
  set
    persisted_at = coalesce(persisted_at, now()),
    persisted_by_user_id = coalesce(persisted_by_user_id, v_uid)
  where
    id = p_package_row_id
  returning * into v_pkg;

  return v_pkg;
end;
$$;

comment on function public.phase4c_touch_persisted_package (uuid) is
  'SECURITY DEFINER: sets persisted_at/persisted_by_user_id after eligibility checks. Future publish RPC calls this last in transaction.';

revoke all on function public.phase4c_package_hash_is_valid (text)
from public;

grant execute on function public.phase4c_package_hash_is_valid (text) to authenticated;

revoke all on function public.phase4c_assert_publish_package_eligible (uuid, text)
from public;

grant execute on function public.phase4c_assert_publish_package_eligible (uuid, text) to authenticated;

revoke all on function public.phase4c_touch_persisted_package (uuid)
from public;

grant execute on function public.phase4c_touch_persisted_package (uuid) to authenticated;

-- Allow persist attribution updates only via definer helper (no broad UPDATE policy).
drop policy if exists source_publish_packages_update_persist on public.source_publish_packages;

create policy source_publish_packages_update_persist on public.source_publish_packages for
update using (
  organization_id in (
    select public.user_organization_ids ()
  )
  and public.phase4c_user_can_publish_source_package (organization_id, study_id)
)
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and public.phase4c_user_can_publish_source_package (organization_id, study_id)
    and publish_ready = true
  );
