-- Phase 7 — Financial runtime intelligence (derived from execution; not accounting).

create table if not exists public.visit_financial_runtime_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  financial_version int not null default 1,
  expected jsonb not null default '{}'::jsonb,
  executed jsonb not null default '{}'::jsonb,
  earned jsonb not null default '{}'::jsonb,
  leakage jsonb not null default '[]'::jsonb,
  coordinator_economics jsonb not null default '{}'::jsonb,
  unscheduled_burden jsonb not null default '{}'::jsonb,
  amendment_impact jsonb not null default '{}'::jsonb,
  procedure_attributions jsonb not null default '[]'::jsonb,
  expected_procedure_count int not null default 0,
  executed_procedure_count int not null default 0,
  earned_procedure_count int not null default 0,
  leakage_item_count int not null default 0,
  leakage_score int not null default 0,
  earned_rate_basis_points int not null default 0,
  visit_financial_burden_score int not null default 0,
  safeguards jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_financial_runtime_study_idx
  on public.visit_financial_runtime_projections (study_id, leakage_score desc);
create index if not exists visit_financial_runtime_subject_idx
  on public.visit_financial_runtime_projections (study_subject_id);

create table if not exists public.subject_financial_runtime_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  financial_version int not null default 1,
  expected jsonb not null default '{}'::jsonb,
  executed jsonb not null default '{}'::jsonb,
  earned jsonb not null default '{}'::jsonb,
  leakage jsonb not null default '[]'::jsonb,
  coordinator_economics jsonb not null default '{}'::jsonb,
  unscheduled_burden jsonb not null default '{}'::jsonb,
  amendment_impact jsonb not null default '{}'::jsonb,
  expected_procedure_count int not null default 0,
  executed_procedure_count int not null default 0,
  earned_procedure_count int not null default 0,
  leakage_item_count int not null default 0,
  leakage_score int not null default 0,
  earned_rate_basis_points int not null default 0,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_financial_runtime_study_idx
  on public.subject_financial_runtime_projections (study_id, leakage_score desc);

comment on table public.visit_financial_runtime_projections is
  'Phase 7 derived: Expected vs Executed vs Earned financial runtime per visit (not invoicing).';
comment on table public.subject_financial_runtime_projections is
  'Phase 7 derived: subject-level financial runtime rollup.';

create or replace function public.enforce_financial_runtime_row_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select s.organization_id into org from public.studies s where s.id = new.study_id;
  if org is null then
    raise exception 'study not found for study_id %', new.study_id;
  end if;
  if new.organization_id is distinct from org then
    new.organization_id := org;
  end if;
  return new;
end;
$$;

drop trigger if exists visit_financial_runtime_enforce_org on public.visit_financial_runtime_projections;
create trigger visit_financial_runtime_enforce_org
before insert or update of organization_id, study_id on public.visit_financial_runtime_projections
for each row execute function public.enforce_financial_runtime_row_org();

drop trigger if exists subject_financial_runtime_enforce_org on public.subject_financial_runtime_projections;
create trigger subject_financial_runtime_enforce_org
before insert or update of organization_id, study_id on public.subject_financial_runtime_projections
for each row execute function public.enforce_financial_runtime_row_org();

alter table public.visit_financial_runtime_projections enable row level security;
alter table public.subject_financial_runtime_projections enable row level security;

drop policy if exists visit_financial_runtime_select on public.visit_financial_runtime_projections;
create policy visit_financial_runtime_select on public.visit_financial_runtime_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_financial_runtime_upsert on public.visit_financial_runtime_projections;
create policy visit_financial_runtime_upsert on public.visit_financial_runtime_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists subject_financial_runtime_select on public.subject_financial_runtime_projections;
create policy subject_financial_runtime_select on public.subject_financial_runtime_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_financial_runtime_upsert on public.subject_financial_runtime_projections;
create policy subject_financial_runtime_upsert on public.subject_financial_runtime_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);
