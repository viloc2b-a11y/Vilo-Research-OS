-- Phase 4 — Safety continuity & governance fabric (derived runtime overlays only).
-- Canonical truth: subject_adverse_events, visits, source, workflow, operational_events.

-- ---------------------------------------------------------------------------
-- Subject safety continuity (longitudinal unresolved safety)
-- ---------------------------------------------------------------------------

create table if not exists public.subject_safety_continuity_projections (
  study_subject_id uuid primary key references public.study_subjects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  computed_at timestamptz not null default now(),
  projection_version int not null default 1,
  continuity_state text not null default 'clear'
    check (continuity_state in ('clear', 'attention', 'elevated', 'critical')),
  carry_forward_active boolean not null default false,
  unresolved_ae_count int not null default 0,
  open_safety_workflow_count int not null default 0,
  critical_finding_count int not null default 0,
  unresolved_items jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists subject_safety_continuity_study_idx
  on public.subject_safety_continuity_projections (study_id, continuity_state);

-- ---------------------------------------------------------------------------
-- Visit safety carry-forward overlay
-- ---------------------------------------------------------------------------

create table if not exists public.visit_safety_carryforward_projections (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  computed_at timestamptz not null default now(),
  projection_version int not null default 1,
  subject_continuity_state text not null default 'clear'
    check (subject_continuity_state in ('clear', 'attention', 'elevated', 'critical')),
  carried_ae_count int not null default 0,
  visit_linked_ae_count int not null default 0,
  carry_forward_active boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists visit_safety_carryforward_subject_idx
  on public.visit_safety_carryforward_projections (study_subject_id);

-- ---------------------------------------------------------------------------
-- Governance signals (runtime-derived; rebuildable)
-- ---------------------------------------------------------------------------

create table if not exists public.governance_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  source_response_set_id uuid references public.source_response_sets (id) on delete set null,
  workflow_action_id uuid references public.subject_workflow_actions (id) on delete set null,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  signal_key text not null,
  signal_type text not null,
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'blocker')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'superseded', 'resolved')),
  label text not null,
  detail text not null,
  detected_at timestamptz not null default now(),
  derivation jsonb not null default '{}'::jsonb,
  capa_placeholder_id uuid,
  unique (organization_id, signal_key)
);

create index if not exists governance_signals_study_status_idx
  on public.governance_signals (study_id, status, detected_at desc);
create index if not exists governance_signals_visit_idx
  on public.governance_signals (visit_id)
  where visit_id is not null;
create index if not exists governance_signals_subject_idx
  on public.governance_signals (study_subject_id)
  where study_subject_id is not null;

-- ---------------------------------------------------------------------------
-- CAPA placeholder (architecture only — no workflow in Phase 4)
-- ---------------------------------------------------------------------------

create table if not exists public.governance_capa_placeholders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  governance_signal_id uuid references public.governance_signals (id) on delete set null,
  status text not null default 'placeholder'
    check (status in ('placeholder', 'draft', 'active', 'closed')),
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.governance_signals
  drop constraint if exists governance_signals_capa_fk;

alter table public.governance_signals
  add constraint governance_signals_capa_fk
  foreign key (capa_placeholder_id) references public.governance_capa_placeholders (id) on delete set null;

comment on table public.subject_safety_continuity_projections is
  'Phase 4 derived: longitudinal unresolved safety from AE registry, workflow, findings.';
comment on table public.visit_safety_carryforward_projections is
  'Phase 4 derived: visit overlay for subject safety carry-forward.';
comment on table public.governance_signals is
  'Phase 4 derived: runtime governance signals (deviations, closeout gaps). Not formal CAPA/QMS.';
comment on table public.governance_capa_placeholders is
  'Phase 4 placeholder only — future CAPA linkage; no workflow in this phase.';

-- Org consistency
create or replace function public.enforce_governance_row_study_org()
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

drop trigger if exists subject_safety_continuity_enforce_org on public.subject_safety_continuity_projections;
create trigger subject_safety_continuity_enforce_org
before insert or update of organization_id, study_id on public.subject_safety_continuity_projections
for each row execute function public.enforce_governance_row_study_org();

drop trigger if exists visit_safety_carryforward_enforce_org on public.visit_safety_carryforward_projections;
create trigger visit_safety_carryforward_enforce_org
before insert or update of organization_id, study_id on public.visit_safety_carryforward_projections
for each row execute function public.enforce_governance_row_study_org();

drop trigger if exists governance_signals_enforce_org on public.governance_signals;
create trigger governance_signals_enforce_org
before insert or update of organization_id, study_id on public.governance_signals
for each row execute function public.enforce_governance_row_study_org();

drop trigger if exists governance_capa_placeholders_enforce_org on public.governance_capa_placeholders;
create trigger governance_capa_placeholders_enforce_org
before insert or update of organization_id, study_id on public.governance_capa_placeholders
for each row execute function public.enforce_governance_row_study_org();

drop trigger if exists governance_capa_placeholders_set_updated_at on public.governance_capa_placeholders;
create trigger governance_capa_placeholders_set_updated_at
before update on public.governance_capa_placeholders
for each row execute function public.generic_set_updated_at();

alter table public.subject_safety_continuity_projections enable row level security;
alter table public.visit_safety_carryforward_projections enable row level security;
alter table public.governance_signals enable row level security;
alter table public.governance_capa_placeholders enable row level security;

drop policy if exists subject_safety_continuity_select on public.subject_safety_continuity_projections;
create policy subject_safety_continuity_select on public.subject_safety_continuity_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists subject_safety_continuity_upsert on public.subject_safety_continuity_projections;
create policy subject_safety_continuity_upsert on public.subject_safety_continuity_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists visit_safety_carryforward_select on public.visit_safety_carryforward_projections;
create policy visit_safety_carryforward_select on public.visit_safety_carryforward_projections
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists visit_safety_carryforward_upsert on public.visit_safety_carryforward_projections;
create policy visit_safety_carryforward_upsert on public.visit_safety_carryforward_projections
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists governance_signals_select on public.governance_signals;
create policy governance_signals_select on public.governance_signals
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists governance_signals_upsert on public.governance_signals;
create policy governance_signals_upsert on public.governance_signals
for all using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists governance_capa_placeholders_select on public.governance_capa_placeholders;
create policy governance_capa_placeholders_select on public.governance_capa_placeholders
for select using (
  organization_id in (select public.user_organization_ids())
  and (public.user_is_org_admin(organization_id) or public.user_has_study_access(study_id))
);

drop policy if exists governance_capa_placeholders_insert on public.governance_capa_placeholders;
create policy governance_capa_placeholders_insert on public.governance_capa_placeholders
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);
