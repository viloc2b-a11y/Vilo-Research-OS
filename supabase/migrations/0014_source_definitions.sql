-- Phase 4A: source_definitions — logical instrument lineage per study (authoring only; capture is Phase 4B+).

create table if not exists public.source_definitions (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  code text not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now (),
  created_by_user_id uuid references auth.users (id),
  updated_by_user_id uuid references auth.users (id),
  constraint source_definitions_code_english_ascii check (
    code ~ '^[A-Za-z][A-Za-z0-9_]*$'::text
  ),
  unique (study_id, code)
);

create index if not exists source_definitions_study_id_idx on public.source_definitions (study_id);

create index if not exists source_definitions_organization_id_idx on public.source_definitions (organization_id);

drop trigger if exists source_definitions_enforce_org on public.source_definitions;

create trigger source_definitions_enforce_org before insert or update of organization_id,
study_id on public.source_definitions for each row
execute function public.enforce_row_study_organization_consistency ();

drop trigger if exists source_definitions_set_updated_at on public.source_definitions;

create trigger source_definitions_set_updated_at before
update on public.source_definitions for each row
execute function public.generic_set_updated_at ();

create or replace function public.phase4a_source_definitions_touch_actors () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id := coalesce(new.created_by_user_id, auth.uid());
    new.updated_by_user_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by_user_id := old.created_by_user_id;
    new.updated_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists source_definitions_touch_actors on public.source_definitions;

create trigger source_definitions_touch_actors before insert or update on public.source_definitions for each row
execute function public.phase4a_source_definitions_touch_actors ();

alter table public.source_definitions enable row level security;

drop policy if exists source_definitions_select on public.source_definitions;

create policy source_definitions_select on public.source_definitions for
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

drop policy if exists source_definitions_insert on public.source_definitions;

create policy source_definitions_insert on public.source_definitions for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_edit_study_definitions (study_id)
  );

drop policy if exists source_definitions_update on public.source_definitions;

create policy source_definitions_update on public.source_definitions for
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

drop policy if exists source_definitions_delete on public.source_definitions;

create policy source_definitions_delete on public.source_definitions for delete using (false);

comment on table public.source_definitions is 'Phase 4A: instrument shells per study. Mutable label/description; versioned snapshots live in source_definition_versions.';
