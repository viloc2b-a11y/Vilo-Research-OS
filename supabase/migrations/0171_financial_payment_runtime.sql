alter table public.financial_invoices
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partially_paid', 'paid', 'overpaid', 'disputed')),
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists balance_due numeric(12,2) not null default 0,
  add column if not exists paid_at timestamptz;

create table if not exists public.financial_payments (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  invoice_id uuid not null references public.financial_invoices (id) on delete cascade,
  pricing_event_id uuid null references public.study_budget_negotiation_events (id) on delete set null,
  currency text not null default 'USD',
  payment_method text not null default 'ach',
  payment_status text not null default 'posted'
    check (payment_status in ('posted', 'reversed', 'disputed')),
  amount_received numeric(12,2) not null,
  amount_applied numeric(12,2) not null,
  amount_unapplied numeric(12,2) not null default 0,
  received_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.financial_payments (id) on delete cascade,
  invoice_id uuid not null references public.financial_invoices (id) on delete cascade,
  invoice_line_item_id uuid not null references public.financial_invoice_line_items (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  amount_allocated numeric(12,2) not null,
  allocation_status text not null default 'applied'
    check (allocation_status in ('applied', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, invoice_line_item_id)
);

create index if not exists financial_payments_study_idx
  on public.financial_payments (study_id);
create index if not exists financial_payments_visit_idx
  on public.financial_payments (visit_id);
create index if not exists financial_payments_invoice_idx
  on public.financial_payments (invoice_id);
create index if not exists financial_payments_status_idx
  on public.financial_payments (payment_status);
create index if not exists financial_payment_allocations_payment_idx
  on public.financial_payment_allocations (payment_id);
create index if not exists financial_payment_allocations_invoice_idx
  on public.financial_payment_allocations (invoice_id);

drop trigger if exists financial_payments_enforce_org on public.financial_payments;
create trigger financial_payments_enforce_org
before insert or update of organization_id, study_id on public.financial_payments
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists financial_payments_set_updated_at on public.financial_payments;
create trigger financial_payments_set_updated_at
before update on public.financial_payments
for each row execute function public.generic_set_updated_at();

drop trigger if exists financial_payment_allocations_enforce_org on public.financial_payment_allocations;
create trigger financial_payment_allocations_enforce_org
before insert or update of organization_id, study_id on public.financial_payment_allocations
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists financial_payment_allocations_set_updated_at on public.financial_payment_allocations;
create trigger financial_payment_allocations_set_updated_at
before update on public.financial_payment_allocations
for each row execute function public.generic_set_updated_at();

alter table public.financial_payments enable row level security;
alter table public.financial_payment_allocations enable row level security;

drop policy if exists financial_payments_select on public.financial_payments;
create policy financial_payments_select on public.financial_payments
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payments_insert on public.financial_payments;
create policy financial_payments_insert on public.financial_payments
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payments_update on public.financial_payments;
create policy financial_payments_update on public.financial_payments
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payments_delete on public.financial_payments;
create policy financial_payments_delete on public.financial_payments
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payment_allocations_select on public.financial_payment_allocations;
create policy financial_payment_allocations_select on public.financial_payment_allocations
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payment_allocations_insert on public.financial_payment_allocations;
create policy financial_payment_allocations_insert on public.financial_payment_allocations
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payment_allocations_update on public.financial_payment_allocations;
create policy financial_payment_allocations_update on public.financial_payment_allocations
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_payment_allocations_delete on public.financial_payment_allocations;
create policy financial_payment_allocations_delete on public.financial_payment_allocations
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

comment on table public.financial_payments is
  'Cash collection ledger for invoice-level payments and disputes.';
comment on table public.financial_payment_allocations is
  'Allocations of a payment across invoice line items.';
