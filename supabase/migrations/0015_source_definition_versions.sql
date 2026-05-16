-- Phase 4A: source_definition_versions — versioned authoring rows; publish freezes payload.

create table if not exists public.source_definition_versions (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete restrict,
  source_definition_id uuid not null references public.source_definitions (id) on delete cascade,
  version_label text not null,
  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'in_review', 'published', 'retired', 'amended')
  ),
  supersedes_version_id uuid references public.source_definition_versions (id) on delete restrict,
  schema_manifest_hash text,
  validation_rules_manifest jsonb,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now (),
  published_at timestamptz,
  retired_at timestamptz,
  published_by_user_id uuid references auth.users (id),
  retired_by_user_id uuid references auth.users (id),
  created_by_user_id uuid references auth.users (id),
  updated_by_user_id uuid references auth.users (id),
  constraint source_definition_versions_meta_object check (
    jsonb_typeof (meta) in ('object', 'null')
  ),
  constraint source_definition_versions_validation_rules_object check (
    validation_rules_manifest is null
    or jsonb_typeof (validation_rules_manifest) in ('object', 'array')
  )
);

create index if not exists source_definition_versions_study_id_idx on public.source_definition_versions (study_id);

create index if not exists source_definition_versions_definition_id_idx on public.source_definition_versions (source_definition_id);

create index if not exists source_definition_versions_lifecycle_idx on public.source_definition_versions (lifecycle_status);

create or replace function public.phase4a_sdv_before_write () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_org uuid;
  v_study uuid;
  v_payload_changed boolean;
begin
  if tg_op = 'INSERT' then
    select
      sd.organization_id,
      sd.study_id into v_org,
      v_study
    from
      public.source_definitions sd
    where
      sd.id = new.source_definition_id;

    if v_org is null then
      raise exception 'source_definition_id % not found',
      new.source_definition_id;
    end if;

    new.organization_id := v_org;
    new.study_id := v_study;

    if new.lifecycle_status not in ('draft', 'in_review') then
      raise exception 'new source_definition_versions must start as draft or in_review';
    end if;

    if new.published_at is not null
    or new.published_by_user_id is not null then
      raise exception 'publish attribution is server-managed only';
    end if;

    if new.validation_rules_manifest is not null then
      if octet_length (new.validation_rules_manifest::text) > 32768 then
        raise exception 'validation_rules_manifest exceeds 32KiB serialized cap';
      end if;
    end if;

    if octet_length (coalesce(new.meta, '{}'::jsonb)::text) > 32768 then
      raise exception 'meta exceeds 32KiB serialized cap';
    end if;

    new.created_by_user_id := coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id := auth.uid();
    new.updated_at := now();
    return new;
  end if;

  if old.lifecycle_status in ('retired', 'amended') then
    raise exception 'source_definition_version % is terminal (%); no further updates',
    old.id,
    old.lifecycle_status;
  end if;

  if new.source_definition_id is distinct from old.source_definition_id then
    select
      sd.organization_id,
      sd.study_id into v_org,
      v_study
    from
      public.source_definitions sd
    where
      sd.id = new.source_definition_id;

    if v_org is null then
      raise exception 'source_definition_id % not found',
      new.source_definition_id;
    end if;

    new.organization_id := v_org;
    new.study_id := v_study;
  end if;

  if new.study_version_id is not null then
    if not exists (
      select
        1
      from
        public.study_versions sv
      where
        sv.id = new.study_version_id
        and sv.study_id = new.study_id
    ) then
      raise exception 'study_version_id must reference study_versions for the same study_id';
    end if;
  end if;

  if new.validation_rules_manifest is not null then
    if octet_length (new.validation_rules_manifest::text) > 32768 then
      raise exception 'validation_rules_manifest exceeds 32KiB serialized cap';
    end if;
  end if;

  if octet_length (coalesce(new.meta, '{}'::jsonb)::text) > 32768 then
    raise exception 'meta exceeds 32KiB serialized cap';
  end if;

  if old.lifecycle_status in ('draft', 'in_review') then
    if new.lifecycle_status not in ('draft', 'in_review', 'published') then
      raise exception 'invalid transition from % to %',
      old.lifecycle_status,
      new.lifecycle_status;
    end if;

    if old.lifecycle_status in ('draft', 'in_review')
    and new.lifecycle_status = 'published' then
      new.published_at := now();
      new.published_by_user_id := auth.uid();
    end if;

  elsif old.lifecycle_status = 'published' then
    if new.lifecycle_status = 'published' then
      v_payload_changed := (
        new.version_label is distinct from old.version_label
        or new.study_version_id is distinct from old.study_version_id
        or new.schema_manifest_hash is distinct from old.schema_manifest_hash
        or coalesce(new.validation_rules_manifest, 'null'::jsonb) is distinct from coalesce(
          old.validation_rules_manifest,
          'null'::jsonb
        )
        or coalesce(new.meta, '{}'::jsonb) is distinct from coalesce(old.meta, '{}'::jsonb)
        or new.supersedes_version_id is distinct from old.supersedes_version_id
        or new.source_definition_id is distinct from old.source_definition_id
        or new.organization_id is distinct from old.organization_id
        or new.study_id is distinct from old.study_id
        or new.created_at is distinct from old.created_at
        or new.published_at is distinct from old.published_at
        or new.published_by_user_id is distinct from old.published_by_user_id
        or new.retired_at is distinct from old.retired_at
        or new.retired_by_user_id is distinct from old.retired_by_user_id
      );

      if v_payload_changed then
        raise exception 'published source_definition_versions are immutable except lifecycle retirement';
      end if;

    elsif new.lifecycle_status in ('retired', 'amended') then
      if (
        new.version_label is distinct from old.version_label
        or new.study_version_id is distinct from old.study_version_id
        or new.schema_manifest_hash is distinct from old.schema_manifest_hash
        or coalesce(new.validation_rules_manifest, 'null'::jsonb) is distinct from coalesce(
          old.validation_rules_manifest,
          'null'::jsonb
        )
        or coalesce(new.meta, '{}'::jsonb) is distinct from coalesce(old.meta, '{}'::jsonb)
        or new.supersedes_version_id is distinct from old.supersedes_version_id
        or new.source_definition_id is distinct from old.source_definition_id
        or new.organization_id is distinct from old.organization_id
        or new.study_id is distinct from old.study_id
        or new.created_at is distinct from old.created_at
        or new.published_at is distinct from old.published_at
        or new.published_by_user_id is distinct from old.published_by_user_id
      ) then
        raise exception 'cannot mutate published payload while retiring or amending';
      end if;

      new.retired_at := coalesce(new.retired_at, now());
      new.retired_by_user_id := auth.uid();
    else
      raise exception 'invalid transition from published to %',
      new.lifecycle_status;
    end if;
  end if;

  new.created_by_user_id := old.created_by_user_id;

  if old.lifecycle_status = 'published'
  and new.lifecycle_status = 'published' then
    new.updated_by_user_id := old.updated_by_user_id;
    new.updated_at := old.updated_at;
  else
    new.updated_by_user_id := auth.uid();
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists source_definition_versions_coalesce_publish on public.source_definition_versions;

create trigger source_definition_versions_coalesce_publish before insert
or
update on public.source_definition_versions for each row
execute function public.phase4a_sdv_before_write ();

comment on function public.phase4a_sdv_before_write () is 'Phase 4A: coerce org/study from parent instrument, gate lifecycle transitions, freeze published authoring payload, server publish timestamps.';

alter table public.source_definition_versions enable row level security;

drop policy if exists source_definition_versions_select on public.source_definition_versions;

create policy source_definition_versions_select on public.source_definition_versions for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (study_id)
    )
  );

drop policy if exists source_definition_versions_insert on public.source_definition_versions;

create policy source_definition_versions_insert on public.source_definition_versions for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_edit_study_definitions (study_id)
    and lifecycle_status in ('draft', 'in_review')
  );

drop policy if exists source_definition_versions_update on public.source_definition_versions;

create policy source_definition_versions_update on public.source_definition_versions for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_edit_study_definitions (study_id)
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_edit_study_definitions (study_id)
  );

drop policy if exists source_definition_versions_delete on public.source_definition_versions;

create policy source_definition_versions_delete on public.source_definition_versions for delete using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_edit_study_definitions (study_id)
  and lifecycle_status in ('draft', 'in_review')
);

comment on table public.source_definition_versions is 'Phase 4A immutable published snapshots bind execution (Phase 4B). Regulatory timestamps are populated by triggers, not trusted from clients.';
