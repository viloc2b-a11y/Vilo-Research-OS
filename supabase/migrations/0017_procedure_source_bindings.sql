-- Phase 4A: procedure_source_bindings — default published instrument per procedure template.

create table if not exists public.procedure_source_bindings (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  procedure_definition_id uuid not null references public.procedure_definitions (id) on delete cascade,
  default_source_definition_version_id uuid not null references public.source_definition_versions (id) on delete restrict,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  created_by_user_id uuid references auth.users (id),
  updated_by_user_id uuid references auth.users (id),
  unique (study_id, procedure_definition_id)
);

create index if not exists procedure_source_bindings_study_procedure_idx on public.procedure_source_bindings (
  organization_id,
  study_id,
  procedure_definition_id
);

create index if not exists procedure_source_bindings_default_version_idx on public.procedure_source_bindings (
  default_source_definition_version_id
);

drop trigger if exists procedure_source_bindings_enforce_org on public.procedure_source_bindings;

create trigger procedure_source_bindings_enforce_org before insert or update of organization_id,
study_id on public.procedure_source_bindings for each row
execute function public.enforce_row_study_organization_consistency ();

drop trigger if exists procedure_source_bindings_set_updated_at on public.procedure_source_bindings;

create trigger procedure_source_bindings_set_updated_at before
update on public.procedure_source_bindings for each row
execute function public.generic_set_updated_at ();

create or replace function public.phase4a_procedure_bindings_normalize () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_ord uuid;
  v_study uuid;
  v_tgt_org uuid;
  v_tgt_study uuid;
  v_lc text;
begin
  select
    pd.organization_id,
    pd.study_id into v_ord,
    v_study
  from
    public.procedure_definitions pd
  where
    pd.id = new.procedure_definition_id;

  if v_ord is null then
    raise exception 'procedure_definition_id % invalid',
    new.procedure_definition_id;
  end if;

  new.organization_id := v_ord;
  new.study_id := v_study;

  select
    sdv.organization_id,
    sdv.study_id,
    sdv.lifecycle_status into v_tgt_org,
    v_tgt_study,
    v_lc
  from
    public.source_definition_versions sdv
  where
    sdv.id = new.default_source_definition_version_id;

  if v_lc is distinct from 'published' then
    raise exception 'procedure bindings must reference lifecycle_status=published instruments (currently %)',
    v_lc;
  end if;

  if new.study_id is distinct from v_tgt_study then
    raise exception 'procedure and instrument versions must belong to the same study';
  end if;

  if new.organization_id is distinct from v_tgt_org then
    raise exception 'organization mismatch between procedure and instrument version';
  end if;

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

drop trigger if exists procedure_source_bindings_normalize on public.procedure_source_bindings;

create trigger procedure_source_bindings_normalize before insert or update on public.procedure_source_bindings for each row
execute function public.phase4a_procedure_bindings_normalize ();

alter table public.procedure_source_bindings enable row level security;

drop policy if exists procedure_source_bindings_select on public.procedure_source_bindings;

create policy procedure_source_bindings_select on public.procedure_source_bindings for
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

drop policy if exists procedure_source_bindings_insert on public.procedure_source_bindings;

create policy procedure_source_bindings_insert on public.procedure_source_bindings for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_edit_study_definitions (study_id)
  );

drop policy if exists procedure_source_bindings_update on public.procedure_source_bindings;

create policy procedure_source_bindings_update on public.procedure_source_bindings for
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

drop policy if exists procedure_source_bindings_delete on public.procedure_source_bindings;

create policy procedure_source_bindings_delete on public.procedure_source_bindings for delete using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_edit_study_definitions (study_id)
);

comment on table public.procedure_source_bindings is 'Version-scoped binds: coordinators retarget bindings to newer published instruments without mutating frozen versions.';
