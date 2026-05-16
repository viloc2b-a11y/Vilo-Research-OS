-- Phase 4B: source_response_addenda — late-entry provenance (post-lock fields from newer instrument versions).
-- Dependencies: 0020 source_response_sets, 0021 source_responses, 0015 source_definition_versions, 0016 source_fields.

create table if not exists public.source_response_addenda (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  response_set_id uuid not null references public.source_response_sets (id) on delete restrict,
  introduced_by_source_definition_version_id uuid not null references public.source_definition_versions (id) on delete restrict,
  applied_to_source_definition_version_id uuid not null references public.source_definition_versions (id) on delete restrict,
  introduced_source_field_id uuid not null references public.source_fields (id) on delete restrict,
  late_entry_reason text not null,
  added_by_user_id uuid not null references auth.users (id),
  added_at timestamptz not null default now(),
  response_id uuid references public.source_responses (id) on delete set null,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  audit_event_id uuid references public.audit_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint source_response_addenda_reason_nonempty check (
    length(
      trim(
        both
        from
          late_entry_reason
      )
    ) > 0
  )
);

comment on table public.source_response_addenda is
  'Late-entry addendum provenance. Does not mutate published source_definition_versions; exports must show introduced vs applied version.';

create index if not exists source_response_addenda_set_idx on public.source_response_addenda (response_set_id);

create index if not exists source_response_addenda_introduced_version_idx on public.source_response_addenda (introduced_by_source_definition_version_id);

create or replace function public.phase4b_enforce_source_response_addendum () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_set record;
  v_intro_field_version uuid;
  v_applied_lc text;
  v_intro_lc text;
begin
  select
    srs.organization_id,
    srs.study_id,
    srs.source_definition_version_id,
    srs.status into v_set
  from
    public.source_response_sets srs
  where
    srs.id = new.response_set_id;

  if v_set.organization_id is null then
    raise exception 'response_set_id % not found', new.response_set_id;
  end if;

  new.organization_id := v_set.organization_id;

  if new.applied_to_source_definition_version_id is distinct from v_set.source_definition_version_id then
    raise exception 'applied_to_source_definition_version_id must match response set bound version';
  end if;

  select
    sf.source_definition_version_id into v_intro_field_version
  from
    public.source_fields sf
  where
    sf.id = new.introduced_source_field_id;

  if v_intro_field_version is null then
    raise exception 'introduced_source_field_id % not found', new.introduced_source_field_id;
  end if;

  if v_intro_field_version is distinct from new.introduced_by_source_definition_version_id then
    raise exception 'introduced field must belong to introduced_by source_definition_version';
  end if;

  select
    lifecycle_status into v_applied_lc
  from
    public.source_definition_versions
  where
    id = new.applied_to_source_definition_version_id;

  select
    lifecycle_status into v_intro_lc
  from
    public.source_definition_versions
  where
    id = new.introduced_by_source_definition_version_id;

  if v_applied_lc is distinct from 'published'
  or v_intro_lc is distinct from 'published' then
    raise exception 'addenda may only reference published source_definition_versions';
  end if;

  new.added_by_user_id := coalesce(new.added_by_user_id, auth.uid());
  new.added_at := coalesce(new.added_at, now());

  if length(
    trim(
      both
      from
        coalesce(new.late_entry_reason, '')
    )
  ) = 0 then
    raise exception 'late_entry_reason is required';
  end if;

  if new.operational_event_id is null
  and new.audit_event_id is null then
    raise exception 'addendum requires operational_event_id and/or audit_event_id reference';
  end if;

  return new;
end;
$$;

drop trigger if exists source_response_addenda_enforce on public.source_response_addenda;

create trigger source_response_addenda_enforce before insert on public.source_response_addenda for each row
execute function public.phase4b_enforce_source_response_addendum ();

alter table public.source_response_addenda enable row level security;

drop policy if exists source_response_addenda_select on public.source_response_addenda;

create policy source_response_addenda_select on public.source_response_addenda for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (
          select
            srs.study_id
          from
            public.source_response_sets srs
          where
            srs.id = response_set_id
        )
      )
    )
  );

drop policy if exists source_response_addenda_insert on public.source_response_addenda;

create policy source_response_addenda_insert on public.source_response_addenda for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.phase4b_user_can_correct_source (
      (
        select
          srs.study_id
        from
          public.source_response_sets srs
        where
          srs.id = response_set_id
      )
    )
  );

-- No UPDATE or DELETE policies (append-only).
