-- Pharmacy Runtime Phase 1: immutable IP ledger.
-- Inventory state is derived from this append-only event stream.

create table if not exists public.ip_ledger_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  event_type text not null,
  event_version integer not null default 1,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  source_entity_type text not null,
  source_entity_id uuid not null,
  kit_id uuid null references public.ip_kits(id) on delete restrict,
  lot_id uuid null references public.ip_lots(id) on delete restrict,
  location_id uuid null references public.ip_inventory_locations(id) on delete restrict,
  quantity_delta integer not null default 0,
  status_delta text not null,
  payload_json jsonb not null default '{}'::jsonb,
  reverses_event_id uuid null references public.ip_ledger_events(id) on delete restrict,
  supersedes_event_id uuid null references public.ip_ledger_events(id) on delete restrict,
  signature_id uuid not null references public.operational_signatures(id) on delete restrict,
  record_hash text not null,
  created_at timestamptz not null default now(),
  constraint ip_ledger_event_type_check check (
    event_type in (
      'receipt_verified',
      'receipt_quarantined',
      'receipt_discrepancy_recorded',
      'receipt_reversed',
      'receipt_superseded',
      'inventory_location_assigned',
      'kit_quarantined'
    )
  ),
  constraint ip_ledger_status_delta_check check (
    status_delta in ('available', 'quarantined', 'discrepant', 'location_assigned', 'reversed')
  ),
  constraint ip_ledger_source_entity_type_check check (
    source_entity_type in ('shipment', 'receipt', 'correction', 'inventory')
  ),
  constraint ip_ledger_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint ip_ledger_hash_required check (length(trim(record_hash)) >= 32),
  constraint ip_ledger_reversal_reference_check check (
    event_type <> 'receipt_reversed' or reverses_event_id is not null
  ),
  constraint ip_ledger_superseding_reference_check check (
    event_type <> 'receipt_superseded' or supersedes_event_id is not null
  ),
  constraint ip_ledger_no_self_reversal check (
    reverses_event_id is null or reverses_event_id <> id
  ),
  constraint ip_ledger_no_self_supersede check (
    supersedes_event_id is null or supersedes_event_id <> id
  )
);

create index if not exists ip_ledger_events_org_idx on public.ip_ledger_events(organization_id);
create index if not exists ip_ledger_events_study_idx on public.ip_ledger_events(study_id);
create index if not exists ip_ledger_events_blueprint_idx on public.ip_ledger_events(blueprint_id);
create index if not exists ip_ledger_events_event_type_idx on public.ip_ledger_events(event_type);
create index if not exists ip_ledger_events_recorded_at_idx on public.ip_ledger_events(recorded_at);
create index if not exists ip_ledger_events_kit_idx on public.ip_ledger_events(kit_id);
create index if not exists ip_ledger_events_lot_idx on public.ip_ledger_events(lot_id);
create index if not exists ip_ledger_events_reversal_idx on public.ip_ledger_events(reverses_event_id);
create index if not exists ip_ledger_events_supersede_idx on public.ip_ledger_events(supersedes_event_id);
create unique index if not exists ip_ledger_events_record_hash_unique
  on public.ip_ledger_events(record_hash);

create or replace function public.ip_ledger_events_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IP ledger events are append-only; use reversal and superseding events';
end;
$$;

drop trigger if exists ip_ledger_events_deny_update
  on public.ip_ledger_events;
create trigger ip_ledger_events_deny_update
before update or delete on public.ip_ledger_events
for each row execute function public.ip_ledger_events_deny_mutation();

create or replace function public.ip_ledger_events_active_blueprint_gate()
returns trigger
language plpgsql
as $$
begin
  if not public.pharmacy_blueprint_is_active(new.blueprint_id) then
    raise exception 'Cannot commit IP ledger event without active Pharmacy Runtime Blueprint';
  end if;

  if not public.pharmacy_user_can_access_action(new.study_id, new.site_id, case
    when new.event_type in ('receipt_reversed', 'receipt_superseded') then 'correction'
    else 'receipt'
  end) then
    raise exception 'Delegation/training gate failed for IP ledger event';
  end if;

  return new;
end;
$$;

drop trigger if exists ip_ledger_events_active_blueprint_gate
  on public.ip_ledger_events;
create trigger ip_ledger_events_active_blueprint_gate
before insert on public.ip_ledger_events
for each row execute function public.ip_ledger_events_active_blueprint_gate();

create or replace view public.ip_inventory_projection_unblinded as
select
  e.organization_id,
  e.study_id,
  e.site_id,
  e.lot_id,
  e.kit_id,
  e.location_id,
  sum(case when e.event_type = 'receipt_verified' then e.quantity_delta else 0 end) as available,
  sum(case when e.event_type in ('receipt_quarantined', 'kit_quarantined') then e.quantity_delta else 0 end) as quarantined,
  sum(case when e.event_type = 'receipt_discrepancy_recorded' then e.quantity_delta else 0 end) as discrepant,
  max(e.recorded_at) as last_event_at
from public.ip_ledger_events e
where e.event_type <> 'receipt_reversed'
  and public.pharmacy_user_can_view_unblinded_ip(e.study_id, e.site_id)
  and not exists (
    select 1
    from public.ip_ledger_events r
    where r.reverses_event_id = e.id
  )
group by e.organization_id, e.study_id, e.site_id, e.lot_id, e.kit_id, e.location_id;

create or replace view public.ip_inventory_projection_masked as
select
  e.organization_id,
  e.study_id,
  e.site_id,
  bool_or(e.event_type in ('receipt_verified', 'receipt_quarantined', 'receipt_discrepancy_recorded')) as inventory_action_exists,
  bool_or(e.event_type = 'receipt_discrepancy_recorded') as ip_issue_requires_unblinded_review,
  'IP_STATUS_MASKED'::text as masked_status,
  max(e.recorded_at) as last_event_at
from public.ip_ledger_events e
where public.pharmacy_user_can_access_action(e.study_id, e.site_id, 'inventory_review')
group by e.organization_id, e.study_id, e.site_id;

alter table public.ip_ledger_events enable row level security;

drop policy if exists ip_ledger_events_select_unblinded on public.ip_ledger_events;
create policy ip_ledger_events_select_unblinded
  on public.ip_ledger_events
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));

drop policy if exists ip_ledger_events_insert on public.ip_ledger_events;
create policy ip_ledger_events_insert
  on public.ip_ledger_events
  for insert with check (
    public.pharmacy_user_can_access_action(study_id, site_id, case
      when event_type in ('receipt_reversed', 'receipt_superseded') then 'correction'
      else 'receipt'
    end)
  );

grant select on public.ip_inventory_projection_unblinded to authenticated;
grant select on public.ip_inventory_projection_masked to authenticated;
