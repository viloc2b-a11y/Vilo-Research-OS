-- Phase 4C.9: source_publish_packages — immutable publish handoff header (file package → DB).
-- Dependencies: 0003 studies, 0004 study_versions, 0005 study_members helpers.
-- Does not implement publish_source_package RPC. Phase 3C / 0020–0025 unchanged.

-- Publish authorization (reused by published_* RLS in 0027–0029; expanded in 0030).
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
  'Phase 4C.9: study_admin/coordinator or org admin may persist approved publish packages. Monitors/viewers excluded.';

revoke all on function public.phase4c_user_can_publish_source_package (uuid, uuid)
from public;

grant execute on function public.phase4c_user_can_publish_source_package (uuid, uuid) to authenticated;

create table if not exists public.source_publish_packages (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete restrict,
  package_id text not null,
  graph_id text not null,
  input_hash text not null,
  compiler_output_id text not null,
  compiler_version text not null,
  approval_id text not null,
  publish_ready boolean not null default false,
  source_definitions_hash text not null,
  preview_hash text not null,
  approval_hash text not null,
  package_hash text,
  validation_status text not null,
  persisted_by_user_id uuid references auth.users (id),
  persisted_at timestamptz,
  created_at timestamptz not null default now (),
  constraint source_publish_packages_package_id_nonempty check (
    length(trim(both from package_id)) > 0
  ),
  constraint source_publish_packages_graph_id_nonempty check (
    length(trim(both from graph_id)) > 0
  ),
  constraint source_publish_packages_validation_status_allowed check (
    validation_status in ('valid', 'warning', 'invalid')
  ),
  constraint source_publish_packages_publish_ready_validation check (
    not publish_ready
    or validation_status in ('valid', 'warning')
  ),
  constraint source_publish_packages_persist_attribution check (
    persisted_at is null
    or persisted_by_user_id is not null
  ),
  constraint source_publish_packages_unique_org_package unique (organization_id, package_id)
);

create index if not exists source_publish_packages_study_id_idx on public.source_publish_packages (study_id);

create index if not exists source_publish_packages_org_study_idx on public.source_publish_packages (organization_id, study_id);

create index if not exists source_publish_packages_graph_id_idx on public.source_publish_packages (graph_id);

create index if not exists source_publish_packages_input_hash_idx on public.source_publish_packages (input_hash);

comment on table public.source_publish_packages is
  'Phase 4C.9: one row per approved source-definition publish package. Immutable content lives in published_* mirrors; Phase 4A rows remain runtime FK targets for Phase 4B capture.';

comment on column public.source_publish_packages.package_id is
  'Deterministic compiler package id (pkg_*). Unique per organization.';

comment on column public.source_publish_packages.publish_ready is
  'Snapshot from publish package builder; only true packages may be persisted.';

comment on column public.source_publish_packages.package_hash is
  'Optional SHA-256 of canonical package JSON manifest at persist time.';

-- Align organization_id with parent study.
create or replace function public.phase4c_source_publish_packages_before_write () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_org uuid;
begin
  select s.organization_id into v_org
  from public.studies s
  where s.id = new.study_id;

  if v_org is null then
    raise exception 'study_id % not found', new.study_id;
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  if new.study_version_id is not null then
    if not exists (
      select 1
      from public.study_versions sv
      where sv.id = new.study_version_id
        and sv.study_id = new.study_id
    ) then
      raise exception 'study_version_id must belong to study_id %', new.study_id;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb (new) - 'persisted_at' - 'persisted_by_user_id') is distinct from (to_jsonb (old) - 'persisted_at' - 'persisted_by_user_id') then
      raise exception 'source_publish_packages payload is immutable; only persisted_at / persisted_by_user_id may change';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists source_publish_packages_before_write on public.source_publish_packages;

create trigger source_publish_packages_before_write before insert
or update on public.source_publish_packages for each row
execute function public.phase4c_source_publish_packages_before_write ();

alter table public.source_publish_packages enable row level security;

drop policy if exists source_publish_packages_select on public.source_publish_packages;

create policy source_publish_packages_select on public.source_publish_packages for
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

drop policy if exists source_publish_packages_insert on public.source_publish_packages;

create policy source_publish_packages_insert on public.source_publish_packages for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and public.user_has_study_access (study_id)
    and public.phase4c_user_can_publish_source_package (organization_id, study_id)
    and publish_ready = true
    and validation_status in ('valid', 'warning')
  );

-- No UPDATE/DELETE policies: persist attribution via SECURITY DEFINER helper in 0030 only.
