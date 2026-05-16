-- Phase 4A: source_fields — normalized field manifests for versioned authoring.

create table if not exists public.source_fields (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  source_definition_version_id uuid not null references public.source_definition_versions (id) on delete cascade,
  field_key text not null,
  label text not null,
  instructions text not null,
  sort_order integer not null default 100,
  is_required boolean not null default false,
  validation_rules jsonb not null default '{}'::jsonb,
  widget_hint text not null default 'text',
  options jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now (),
  constraint source_fields_field_key_snake_ascii check (
    field_key ~ '^[a-z][a-z0-9_]*$'::text
  ),
  constraint source_fields_instructions_non_blank check (
    length(
      trim(
        both
        from
          instructions
      )
    ) > 0
  ),
  constraint source_fields_validation_rules_object check (
    jsonb_typeof (validation_rules) = 'object'
  ),
  constraint source_fields_widget_hint_ascii check (
    widget_hint ~ '^[A-Za-z][A-Za-z0-9_]*$'::text
  ),
  constraint source_fields_options_kind check (
    options is null
    or jsonb_typeof (options) in ('array', 'object')
  ),
  unique (source_definition_version_id, field_key)
);

create index if not exists source_fields_org_study_idx on public.source_fields (organization_id, study_id);

create index if not exists source_fields_version_sequence_idx on public.source_fields (source_definition_version_id, sort_order);

create or replace function public.phase4a_source_fields_before_write () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_org uuid;
  v_study uuid;
  v_lc text;
  v_json text;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select
      sdv.organization_id,
      sdv.study_id,
      sdv.lifecycle_status into v_org,
      v_study,
      v_lc
    from
      public.source_definition_versions sdv
    where
      sdv.id = new.source_definition_version_id;

    if v_org is null then
      raise exception 'source_definition_version_id % missing',
      new.source_definition_version_id;
    end if;

    if v_lc not in ('draft', 'in_review') then
      raise exception 'source_fields can only be authored when parent version is draft or in_review (current %)',
      v_lc;
    end if;

    new.organization_id := v_org;
    new.study_id := v_study;
    new.field_key := lower(trim(new.field_key));
    new.label := trim(new.label);
    new.instructions := trim(new.instructions);
    new.widget_hint := trim(new.widget_hint);

    v_json := new.validation_rules::text;
    if octet_length (v_json) > 32768 then
      raise exception 'validation_rules exceeds 32KiB serialized cap';
    end if;

    if new.options is not null then
      v_json := new.options::text;
      if octet_length (v_json) > 16384 then
        raise exception 'options exceeds 16KiB serialized cap';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    select
      sdv.lifecycle_status into v_lc
    from
      public.source_definition_versions sdv
    where
      sdv.id = old.source_definition_version_id;

    if v_lc not in ('draft', 'in_review') then
      raise exception 'cannot delete source_fields on finalized source_definition_versions';
    end if;

    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists source_fields_authoring_gate on public.source_fields;

create trigger source_fields_authoring_gate before insert
or
update
or delete on public.source_fields for each row
execute function public.phase4a_source_fields_before_write ();

drop trigger if exists source_fields_enforce_org on public.source_fields;

create trigger source_fields_enforce_org before insert or update of organization_id,
study_id on public.source_fields for each row
execute function public.enforce_row_study_organization_consistency ();

drop trigger if exists source_fields_set_updated_at on public.source_fields;

create trigger source_fields_set_updated_at before
update on public.source_fields for each row
execute function public.generic_set_updated_at ();

alter table public.source_fields enable row level security;

drop policy if exists source_fields_select on public.source_fields;

create policy source_fields_select on public.source_fields for
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

drop policy if exists source_fields_insert on public.source_fields;

create policy source_fields_insert on public.source_fields for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_edit_study_definitions (study_id)
  );

drop policy if exists source_fields_update on public.source_fields;

create policy source_fields_update on public.source_fields for
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

drop policy if exists source_fields_delete on public.source_fields;

create policy source_fields_delete on public.source_fields for delete using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_edit_study_definitions (study_id)
);

comment on table public.source_fields is 'Legible normalized field manifests; authoring mutates draft/in_review parents only — published versions require new source_definition_version rows.';
