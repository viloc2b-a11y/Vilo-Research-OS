-- Pharmacy Runtime Phase 1: IP master data.
-- Master data stores identities and expected shipment contents only; operational state is derived from ip_ledger_events.

create table if not exists public.ip_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  manufacturer_lot_number text not null,
  expiry_date date null,
  status text not null default 'created',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_lots_status_check check (status in ('created', 'active', 'expired', 'quarantined')),
  constraint ip_lots_lot_required check (length(trim(manufacturer_lot_number)) > 0),
  constraint ip_lots_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists ip_lots_unique_lot_per_study_site
  on public.ip_lots(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), manufacturer_lot_number);

create table if not exists public.ip_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  lot_id uuid not null references public.ip_lots(id) on delete restrict,
  kit_number text not null,
  kit_label text null,
  treatment_metadata jsonb null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ip_kits_number_required check (length(trim(kit_number)) > 0),
  constraint ip_kits_treatment_metadata_object check (
    treatment_metadata is null or jsonb_typeof(treatment_metadata) = 'object'
  )
);

create unique index if not exists ip_kits_unique_kit_per_study_site
  on public.ip_kits(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), kit_number);

create table if not exists public.ip_inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  name text not null,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ip_inventory_locations_name_required check (length(trim(name)) > 0),
  constraint ip_inventory_locations_status_check check (status in ('active', 'inactive'))
);

create unique index if not exists ip_inventory_locations_unique_name
  on public.ip_inventory_locations(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table if not exists public.ip_shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  shipment_number text not null,
  expected_arrival_date date null,
  status text not null default 'in_transit',
  source text not null default 'activated_blueprint',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_shipments_status_check check (
    status in ('in_transit', 'received', 'received_with_discrepancy', 'cancelled')
  ),
  constraint ip_shipments_source_check check (source in ('activated_blueprint', 'manual_exception')),
  constraint ip_shipments_number_required check (length(trim(shipment_number)) > 0),
  constraint ip_shipments_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists ip_shipments_unique_number
  on public.ip_shipments(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), shipment_number);

create table if not exists public.ip_shipment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  shipment_id uuid not null references public.ip_shipments(id) on delete cascade,
  lot_id uuid not null references public.ip_lots(id) on delete restrict,
  kit_id uuid null references public.ip_kits(id) on delete restrict,
  expected_quantity integer not null default 1,
  expected_condition text not null default 'intact',
  source text not null default 'activated_blueprint',
  manual_exception_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ip_shipment_items_quantity_positive check (expected_quantity > 0),
  constraint ip_shipment_items_condition_check check (expected_condition in ('intact', 'damaged', 'unknown')),
  constraint ip_shipment_items_source_check check (source in ('activated_blueprint', 'manual_exception')),
  constraint ip_shipment_items_manual_reason_check check (
    source <> 'manual_exception'
    or (manual_exception_reason is not null and length(trim(manual_exception_reason)) > 0)
  )
);

create index if not exists ip_lots_study_idx on public.ip_lots(study_id);
create index if not exists ip_lots_blueprint_idx on public.ip_lots(blueprint_id);
create index if not exists ip_kits_study_idx on public.ip_kits(study_id);
create index if not exists ip_kits_lot_idx on public.ip_kits(lot_id);
create index if not exists ip_locations_study_idx on public.ip_inventory_locations(study_id);
create index if not exists ip_shipments_study_idx on public.ip_shipments(study_id);
create index if not exists ip_shipments_blueprint_idx on public.ip_shipments(blueprint_id);
create index if not exists ip_shipment_items_shipment_idx on public.ip_shipment_items(shipment_id);
create index if not exists ip_shipment_items_kit_idx on public.ip_shipment_items(kit_id);

create or replace function public.ip_master_data_requires_active_blueprint()
returns trigger
language plpgsql
as $$
begin
  if not public.pharmacy_blueprint_is_active(new.blueprint_id) then
    raise exception 'Pharmacy Runtime Blueprint must be active before IP master data can drive receipt runtime';
  end if;
  return new;
end;
$$;

drop trigger if exists ip_lots_active_blueprint_gate on public.ip_lots;
create trigger ip_lots_active_blueprint_gate
before insert or update of blueprint_id on public.ip_lots
for each row execute function public.ip_master_data_requires_active_blueprint();

drop trigger if exists ip_kits_active_blueprint_gate on public.ip_kits;
create trigger ip_kits_active_blueprint_gate
before insert or update of blueprint_id on public.ip_kits
for each row execute function public.ip_master_data_requires_active_blueprint();

drop trigger if exists ip_shipments_active_blueprint_gate on public.ip_shipments;
create trigger ip_shipments_active_blueprint_gate
before insert or update of blueprint_id on public.ip_shipments
for each row execute function public.ip_master_data_requires_active_blueprint();

alter table public.ip_lots enable row level security;
alter table public.ip_kits enable row level security;
alter table public.ip_inventory_locations enable row level security;
alter table public.ip_shipments enable row level security;
alter table public.ip_shipment_items enable row level security;

create policy ip_lots_select on public.ip_lots
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
create policy ip_lots_insert on public.ip_lots
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

create policy ip_kits_select on public.ip_kits
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
create policy ip_kits_insert on public.ip_kits
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

create policy ip_locations_select on public.ip_inventory_locations
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'inventory_review'));
create policy ip_locations_insert on public.ip_inventory_locations
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

create policy ip_shipments_select on public.ip_shipments
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));
create policy ip_shipments_insert on public.ip_shipments
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));
create policy ip_shipments_update on public.ip_shipments
  for update using (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'))
  with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

create policy ip_shipment_items_select on public.ip_shipment_items
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
create policy ip_shipment_items_insert on public.ip_shipment_items
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));
