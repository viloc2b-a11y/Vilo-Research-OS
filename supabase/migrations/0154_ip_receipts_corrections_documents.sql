-- Pharmacy Runtime Phase 1: receipts, corrections, document linkage.

create table if not exists public.ip_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  shipment_id uuid not null references public.ip_shipments(id) on delete restrict,
  received_by uuid not null references auth.users(id) on delete restrict,
  received_at timestamptz not null,
  status text not null default 'pending_verification',
  discrepancy_summary text null,
  signature_id uuid null references public.operational_signatures(id) on delete restrict,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_receipts_status_check check (
    status in ('pending_verification', 'verified', 'quarantined', 'corrected')
  ),
  constraint ip_receipts_signature_required_for_final check (
    status = 'pending_verification' or signature_id is not null
  ),
  constraint ip_receipts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ip_receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  receipt_id uuid not null references public.ip_receipts(id) on delete cascade,
  shipment_item_id uuid null references public.ip_shipment_items(id) on delete restrict,
  kit_id uuid null references public.ip_kits(id) on delete restrict,
  lot_id uuid not null references public.ip_lots(id) on delete restrict,
  location_id uuid null references public.ip_inventory_locations(id) on delete restrict,
  received_quantity integer not null default 0,
  condition text not null,
  discrepancy_reason text null,
  created_at timestamptz not null default now(),
  constraint ip_receipt_items_condition_check check (
    condition in ('intact', 'damaged', 'missing', 'extra', 'mismatched')
  ),
  constraint ip_receipt_items_quantity_check check (received_quantity >= 0),
  constraint ip_receipt_items_discrepancy_reason_check check (
    condition = 'intact'
    or (discrepancy_reason is not null and length(trim(discrepancy_reason)) > 0)
  )
);

create table if not exists public.ip_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  target_event_id uuid not null references public.ip_ledger_events(id) on delete restrict,
  reversal_event_id uuid null references public.ip_ledger_events(id) on delete restrict,
  superseding_event_id uuid null references public.ip_ledger_events(id) on delete restrict,
  scope text not null,
  reason text not null,
  justification text not null,
  corrected_by uuid not null references auth.users(id) on delete restrict,
  signature_id uuid not null references public.operational_signatures(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ip_corrections_scope_check check (
    scope in ('receipt_event', 'inventory_foundation_event', 'accountability_foundation_event')
  ),
  constraint ip_corrections_reason_required check (length(trim(reason)) > 0),
  constraint ip_corrections_justification_required check (length(trim(justification)) > 0)
);

create table if not exists public.ip_document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  document_id uuid not null references public.compliance_runtime_documents(id) on delete restrict,
  document_reader_artifact_id uuid null references public.document_intelligence_documents(id) on delete restrict,
  document_role text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ip_document_links_entity_type_check check (
    entity_type in (
      'pharmacy_runtime_blueprint',
      'ip_receipt',
      'ip_correction',
      'ip_accountability_exception',
      'ip_shipment'
    )
  ),
  constraint ip_document_links_role_check check (
    document_role in (
      'source_document',
      'document_reader_artifact',
      'packing_slip',
      'depot_shipment_notice',
      'chain_of_custody',
      'receipt_confirmation',
      'discrepancy_evidence',
      'quarantine_evidence',
      'correction_support'
    )
  )
);

create index if not exists ip_receipts_study_idx on public.ip_receipts(study_id);
create index if not exists ip_receipts_shipment_idx on public.ip_receipts(shipment_id);
create index if not exists ip_receipts_signature_idx on public.ip_receipts(signature_id);
create index if not exists ip_receipt_items_receipt_idx on public.ip_receipt_items(receipt_id);
create index if not exists ip_receipt_items_kit_idx on public.ip_receipt_items(kit_id);
create index if not exists ip_corrections_target_idx on public.ip_corrections(target_event_id);
create index if not exists ip_corrections_signature_idx on public.ip_corrections(signature_id);
create index if not exists ip_document_links_entity_idx on public.ip_document_links(entity_type, entity_id);
create index if not exists ip_document_links_document_idx on public.ip_document_links(document_id);

create or replace function public.ip_receipt_active_blueprint_gate()
returns trigger
language plpgsql
as $$
begin
  if not public.pharmacy_blueprint_is_active(new.blueprint_id) then
    raise exception 'Cannot commit IP receipt without active Pharmacy Runtime Blueprint';
  end if;

  if not public.pharmacy_user_can_access_action(new.study_id, new.site_id, 'receipt') then
    raise exception 'Delegation/training gate failed for IP receipt';
  end if;

  return new;
end;
$$;

drop trigger if exists ip_receipt_active_blueprint_gate on public.ip_receipts;
create trigger ip_receipt_active_blueprint_gate
before insert on public.ip_receipts
for each row execute function public.ip_receipt_active_blueprint_gate();

create or replace function public.ip_receipts_deny_signed_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending_verification' or old.signature_id is not null then
    raise exception 'Signed or finalized IP receipts are immutable; use correction events';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists ip_receipts_deny_signed_update on public.ip_receipts;
create trigger ip_receipts_deny_signed_update
before update or delete on public.ip_receipts
for each row execute function public.ip_receipts_deny_signed_mutation();

alter table public.ip_receipts enable row level security;
alter table public.ip_receipt_items enable row level security;
alter table public.ip_corrections enable row level security;
alter table public.ip_document_links enable row level security;

drop policy if exists ip_receipts_select on public.ip_receipts;
create policy ip_receipts_select on public.ip_receipts
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));
drop policy if exists ip_receipts_insert on public.ip_receipts;
create policy ip_receipts_insert on public.ip_receipts
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));
drop policy if exists ip_receipts_update on public.ip_receipts;
create policy ip_receipts_update on public.ip_receipts
  for update using (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'))
  with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

drop policy if exists ip_receipt_items_select_unblinded on public.ip_receipt_items;
create policy ip_receipt_items_select_unblinded on public.ip_receipt_items
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
drop policy if exists ip_receipt_items_insert on public.ip_receipt_items;
create policy ip_receipt_items_insert on public.ip_receipt_items
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'receipt'));

drop policy if exists ip_corrections_select on public.ip_corrections;
create policy ip_corrections_select on public.ip_corrections
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
drop policy if exists ip_corrections_insert on public.ip_corrections;
create policy ip_corrections_insert on public.ip_corrections
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'correction'));

drop policy if exists ip_document_links_select on public.ip_document_links;
create policy ip_document_links_select on public.ip_document_links
  for select using (
    public.pharmacy_user_can_access_action(study_id, site_id, 'receipt')
    or public.pharmacy_user_can_access_action(study_id, site_id, 'correction')
  );
drop policy if exists ip_document_links_insert on public.ip_document_links;
create policy ip_document_links_insert on public.ip_document_links
  for insert with check (
    public.pharmacy_user_can_access_action(study_id, site_id, 'receipt')
    or public.pharmacy_user_can_access_action(study_id, site_id, 'correction')
  );
