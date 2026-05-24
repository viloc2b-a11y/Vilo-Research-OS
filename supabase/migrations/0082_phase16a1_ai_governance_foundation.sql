-- Phase 16A-1 — GOV-0 lightweight AI governance foundation (inventory + incidents).
-- No runtime hooks, no AI execution, no production seed data.

-- ---------------------------------------------------------------------------
-- RLS helper: org admin or any study_admin in the organization
-- ---------------------------------------------------------------------------

create or replace function public.user_can_manage_ai_governance(_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin(_organization_id)
    or exists (
      select 1
      from public.study_members sm
      where sm.organization_id = _organization_id
        and sm.user_id = auth.uid()
        and sm.role = 'study_admin'
        and public.user_has_active_organization_membership(sm.organization_id)
    );
$$;

comment on function public.user_can_manage_ai_governance(uuid) is
  'Org owner/admin or study_admin on any study in the organization — AI governance write scope.';

revoke all on function public.user_can_manage_ai_governance(uuid) from public;
grant execute on function public.user_can_manage_ai_governance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ai_system_inventory
-- ---------------------------------------------------------------------------

create table if not exists public.ai_system_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  system_name text not null,
  system_type text not null,
  vendor text,
  model_name text,
  owner_role text not null,
  use_case text not null,
  risk_tier text not null check (risk_tier in ('low', 'medium', 'high', 'critical')),
  human_in_loop_required boolean not null default true,
  phi_allowed boolean not null default false,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'active', 'paused', 'retired')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_system_inventory_organization_id_idx
  on public.ai_system_inventory (organization_id);

create index if not exists ai_system_inventory_risk_tier_idx
  on public.ai_system_inventory (organization_id, risk_tier);

create index if not exists ai_system_inventory_status_idx
  on public.ai_system_inventory (organization_id, status);

create index if not exists ai_system_inventory_created_at_idx
  on public.ai_system_inventory (organization_id, created_at desc);

comment on table public.ai_system_inventory is
  'GOV-0: registered AI/ML systems per organization (inventory only; no runtime execution).';

comment on column public.ai_system_inventory.metadata is
  'Non-PHI configuration only — must not store subject identifiers or clinical content.';

drop trigger if exists ai_system_inventory_set_updated_at on public.ai_system_inventory;
create trigger ai_system_inventory_set_updated_at
before update on public.ai_system_inventory
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_incidents
-- ---------------------------------------------------------------------------

create table if not exists public.ai_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_system_id uuid references public.ai_system_inventory (id) on delete set null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  incident_type text not null,
  description text not null,
  affected_entity_type text,
  affected_entity_id uuid,
  trace_id uuid,
  status text not null default 'open' check (
    status in ('open', 'investigating', 'mitigated', 'closed')
  ),
  corrective_action text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists ai_incidents_organization_id_idx
  on public.ai_incidents (organization_id);

create index if not exists ai_incidents_ai_system_id_idx
  on public.ai_incidents (ai_system_id)
  where ai_system_id is not null;

create index if not exists ai_incidents_status_idx
  on public.ai_incidents (organization_id, status);

create index if not exists ai_incidents_created_at_idx
  on public.ai_incidents (organization_id, created_at desc);

comment on table public.ai_incidents is
  'GOV-0: AI governance incidents (manual/runbook tracking; no automated AI telemetry yet).';

alter table public.ai_system_inventory enable row level security;
alter table public.ai_incidents enable row level security;

-- ---------------------------------------------------------------------------
-- ai_system_inventory policies
-- ---------------------------------------------------------------------------

drop policy if exists ai_system_inventory_select on public.ai_system_inventory;
create policy ai_system_inventory_select on public.ai_system_inventory
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists ai_system_inventory_insert on public.ai_system_inventory;
create policy ai_system_inventory_insert on public.ai_system_inventory
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists ai_system_inventory_update on public.ai_system_inventory;
create policy ai_system_inventory_update on public.ai_system_inventory
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists ai_system_inventory_delete on public.ai_system_inventory;
create policy ai_system_inventory_delete on public.ai_system_inventory
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

-- ---------------------------------------------------------------------------
-- ai_incidents policies
-- ---------------------------------------------------------------------------

drop policy if exists ai_incidents_select on public.ai_incidents;
create policy ai_incidents_select on public.ai_incidents
for select using (
  organization_id in (select public.user_organization_ids())
);

drop policy if exists ai_incidents_insert on public.ai_incidents;
create policy ai_incidents_insert on public.ai_incidents
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists ai_incidents_update on public.ai_incidents;
create policy ai_incidents_update on public.ai_incidents
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

drop policy if exists ai_incidents_delete on public.ai_incidents;
create policy ai_incidents_delete on public.ai_incidents
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_ai_governance(organization_id)
);

-- No anon/public table grants (authenticated + RLS only)
revoke all on table public.ai_system_inventory from anon, public;
revoke all on table public.ai_incidents from anon, public;
grant select, insert, update, delete on table public.ai_system_inventory to authenticated;
grant select, insert, update, delete on table public.ai_incidents to authenticated;
