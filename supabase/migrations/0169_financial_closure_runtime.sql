create table if not exists public.financial_invoiceable_line_items (
  id uuid primary key default gen_random_uuid(),
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
  billable_to text not null default 'sponsor',
  quantity numeric(10,4) not null default 1,
  unit_cost numeric(12,2) not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  invoice_status text not null default 'invoiceable'
    check (invoice_status in ('invoiceable', 'draft', 'sent', 'paid', 'void')),
  source_state text not null default 'earned'
    check (source_state in ('earned')),
  source_financial_version integer not null,
  source_computed_at timestamptz not null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, procedure_execution_id)
);

create index if not exists financial_invoiceable_line_items_study_idx
  on public.financial_invoiceable_line_items (study_id);
create index if not exists financial_invoiceable_line_items_visit_idx
  on public.financial_invoiceable_line_items (visit_id);
create index if not exists financial_invoiceable_line_items_status_idx
  on public.financial_invoiceable_line_items (invoice_status);
create index if not exists financial_invoiceable_line_items_study_status_idx
  on public.financial_invoiceable_line_items (study_id, invoice_status);
create index if not exists financial_invoiceable_line_items_created_at_idx
  on public.financial_invoiceable_line_items (created_at desc);

drop trigger if exists financial_invoiceable_line_items_enforce_org on public.financial_invoiceable_line_items;
create trigger financial_invoiceable_line_items_enforce_org
before insert or update of organization_id, study_id on public.financial_invoiceable_line_items
for each row execute function public.enforce_row_study_organization_consistency();

drop trigger if exists financial_invoiceable_line_items_set_updated_at on public.financial_invoiceable_line_items;
create trigger financial_invoiceable_line_items_set_updated_at
before update on public.financial_invoiceable_line_items
for each row execute function public.generic_set_updated_at();

alter table public.financial_invoiceable_line_items enable row level security;

drop policy if exists financial_invoiceable_line_items_select on public.financial_invoiceable_line_items;
create policy financial_invoiceable_line_items_select on public.financial_invoiceable_line_items
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoiceable_line_items_insert on public.financial_invoiceable_line_items;
create policy financial_invoiceable_line_items_insert on public.financial_invoiceable_line_items
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoiceable_line_items_update on public.financial_invoiceable_line_items;
create policy financial_invoiceable_line_items_update on public.financial_invoiceable_line_items
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists financial_invoiceable_line_items_delete on public.financial_invoiceable_line_items;
create policy financial_invoiceable_line_items_delete on public.financial_invoiceable_line_items
for delete using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

comment on table public.financial_invoiceable_line_items is
  'Operational invoiceable line items materialized from earned procedure execution and budget evidence.';
