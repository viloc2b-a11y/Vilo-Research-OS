-- Phase 4A: optional FK from procedure executions to immutable published instruments (populate Phase 4B; nullable preserves Phase 3C RPC semantics).

alter table public.procedure_executions
add column if not exists source_definition_version_id uuid references public.source_definition_versions (id) on delete restrict;

create index if not exists procedure_executions_source_definition_version_id_idx on public.procedure_executions (source_definition_version_id);

create or replace function public.phase4a_pe_source_definition_version_optional_fk () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_study uuid;
  v_lc text;
begin
  if new.source_definition_version_id is null then
    return new;
  end if;

  select
    sdv.study_id,
    sdv.lifecycle_status into v_study,
    v_lc
  from
    public.source_definition_versions sdv
  where
    sdv.id = new.source_definition_version_id;

  if v_study is null then
    raise exception 'source_definition_version_id % not found',
    new.source_definition_version_id;
  end if;

  if v_lc is distinct from 'published' then
    raise exception 'procedure executions may only cite published instruments (lifecycle %)',
    v_lc;
  end if;

  if new.study_id is distinct from v_study then
    raise exception 'procedure execution instrument version must belong to execution study';
  end if;

  return new;
end;
$$;

drop trigger if exists procedure_executions_enforce_z_source_definition_version on public.procedure_executions;

create trigger procedure_executions_enforce_z_source_definition_version before insert
or
update of source_definition_version_id,
study_id,
visit_id on public.procedure_executions for each row
execute function public.phase4a_pe_source_definition_version_optional_fk ();

comment on column public.procedure_executions.source_definition_version_id is 'Frozen execution-bound instrument revision (populate Phase 4B). Nullable FK keeps legacy Phase 3C rows untouched.';
