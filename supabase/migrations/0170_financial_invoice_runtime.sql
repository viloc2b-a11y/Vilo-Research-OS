create table if not exists public.financial_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  pricing_event_id uuid null references public.study_budget_negotiation_events (id) on delete set null,
  currency text not null default 'USD',
  invoice_status text not null default 'draft'
    check (invoice_status in ('draft', 'sent', 'void')),
  invoice_date timestamptz not null default now(),
  sent_at timestamptz,
  total_amount numeric(12,2) not null default 0,
  source_financial_version integer not null,
  source_computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

create table if not exists public.financial_invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.financial_invoices (id) on delete cascade,
  invoiceable_line_item_id uuid not null references public.financial_invoiceable_line_items (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  procedure_execution_id uuid not null references public.procedure_executions (id) on delete cascade,
  pricing_event_id uuid null references public.study_budget_negotiation_events (id) on delete set null,
  visit_name text not null,
  activity_id text not null,
  activity_type text not null,
  description text not null,
  billable_to text not null,
  quantity numeric(10,4) not null,
  unit_cost numeric(12,2) not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  line_status text not null default 'draft'
    check (line_status in ('draft', 'sent', 'void')),
  source_state text not null default 'earned'
    check (source_state in ('earned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, invoiceable_line_item_id),
  unique (invoiceable_line_item_id)
);

create index if not exists financial_invoices_study_idx
  on public.financial_invoices (study_id);
create index if not exists financial_invoices_visit_idx
  on public.financial_invoices (visit_id);
create index if not exists financial_invoices_status_idx
  on public.financial_invoices (invoice_status);
create index if not exists financial_invoices_created_at_idx
  on public.financial_invoices (created_at desc);

create index if not exists financial_invoice_line_items_invoice_idx
  on public.financial_invoice_line_items (invoice_id);
create index if not exists financial_invoice_line_items_study_idx
  on public.financial_invoice_line_items (study_id);
create index if not exists financial_invoice_line_items_visit_idx
  on public.financial_invoice_line_items (visit_id);
create index if not exists financial_invoice_line_items_status_idx
  on public.financial_invoice_line_items (line_status);

drop trigger if exists financial_invoices_enforce_org on public.financial_invoices;
create trigger financial_invoices_enforce_org
before insert or update of organization_id, study_id on public.financial_invoices
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists financial_invoices_set_updated_at on public.financial_invoices;
create trigger financial_invoices_set_updated_at
before update on public.financial_invoices
for each row execute function public.generic_set_updated_at();

drop trigger if exists financial_invoice_line_items_enforce_org on public.financial_invoice_line_items;
create trigger financial_invoice_line_items_enforce_org
before insert or update of organization_id, study_id on public.financial_invoice_line_items
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists financial_invoice_line_items_set_updated_at on public.financial_invoice_line_items;
create trigger financial_invoice_line_items_set_updated_at
before update on public.financial_invoice_line_items
for each row execute function public.generic_set_updated_at();

alter table public.financial_invoices enable row level security;
alter table public.financial_invoice_line_items enable row level security;

drop policy if exists financial_invoices_select on public.financial_invoices;
create policy financial_invoices_select on public.financial_invoices
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoices_insert on public.financial_invoices;
create policy financial_invoices_insert on public.financial_invoices
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoices_update on public.financial_invoices;
create policy financial_invoices_update on public.financial_invoices
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoices_delete on public.financial_invoices;
create policy financial_invoices_delete on public.financial_invoices
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoice_line_items_select on public.financial_invoice_line_items;
create policy financial_invoice_line_items_select on public.financial_invoice_line_items
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoice_line_items_insert on public.financial_invoice_line_items;
create policy financial_invoice_line_items_insert on public.financial_invoice_line_items
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoice_line_items_update on public.financial_invoice_line_items;
create policy financial_invoice_line_items_update on public.financial_invoice_line_items
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoice_line_items_delete on public.financial_invoice_line_items;
create policy financial_invoice_line_items_delete on public.financial_invoice_line_items
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

comment on table public.financial_invoices is
  'Operational invoice queue records derived from invoiceable line items.';
comment on table public.financial_invoice_line_items is
  'Invoice line items copied from invoiceable earned procedures and grouped into invoices.';
