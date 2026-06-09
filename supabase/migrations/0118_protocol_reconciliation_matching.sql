-- Phase P2: Procedure matching + manual reconciliation layer
-- Separate from extraction candidates; append-only reconciliation events.

-- ---------------------------------------------------------------------------
-- protocol_visit_reconciliations
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_visit_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  visit_candidate_id uuid null references public.protocol_runtime_visit_candidates (id) on delete set null,
  visit_code text not null,
  visit_name text not null,
  visit_type text null,
  study_day integer null,
  window_before_days integer null,
  window_after_days integer null,
  reconciliation_status text not null default 'draft',
  reconciliation_source text not null default 'candidate',
  approved_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_visit_reconciliations_status_check check (
    reconciliation_status in ('draft', 'approved', 'rejected', 'needs_review')
  ),
  constraint protocol_visit_reconciliations_source_check check (
    reconciliation_source in ('candidate', 'manual', 'modified')
  )
);

create index if not exists protocol_visit_reconciliations_org_idx
  on public.protocol_visit_reconciliations (organization_id);
create index if not exists protocol_visit_reconciliations_version_idx
  on public.protocol_visit_reconciliations (protocol_version_id);
create index if not exists protocol_visit_reconciliations_candidate_idx
  on public.protocol_visit_reconciliations (visit_candidate_id);
create index if not exists protocol_visit_reconciliations_status_idx
  on public.protocol_visit_reconciliations (reconciliation_status);

drop trigger if exists protocol_visit_reconciliations_set_updated_at on public.protocol_visit_reconciliations;
create trigger protocol_visit_reconciliations_set_updated_at
before update on public.protocol_visit_reconciliations
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- protocol_procedure_reconciliations
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_procedure_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  procedure_candidate_id uuid null references public.protocol_runtime_procedure_candidates (id) on delete set null,
  visit_reconciliation_id uuid null references public.protocol_visit_reconciliations (id) on delete set null,
  procedure_name text not null,
  procedure_category text null,
  matched_procedure_library_id uuid null references public.procedure_library (id) on delete set null,
  matched_blueprint_version_id uuid null references public.procedure_blueprint_versions (id) on delete set null,
  match_confidence numeric(5,2) null,
  matching_method text not null default 'manual',
  reconciliation_status text not null default 'needs_review',
  reconciliation_source text not null default 'candidate',
  required boolean not null default true,
  procedure_order integer null,
  operational_overrides jsonb not null default '{}'::jsonb,
  approved_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_procedure_reconciliations_status_check check (
    reconciliation_status in (
      'needs_review',
      'matched',
      'approved',
      'rejected',
      'manual_mapping_required'
    )
  ),
  constraint protocol_procedure_reconciliations_method_check check (
    matching_method in ('auto_string', 'auto_exact_code', 'manual', 'none')
  ),
  constraint protocol_procedure_reconciliations_source_check check (
    reconciliation_source in ('candidate', 'manual', 'modified')
  )
);

create index if not exists protocol_procedure_reconciliations_org_idx
  on public.protocol_procedure_reconciliations (organization_id);
create index if not exists protocol_procedure_reconciliations_version_idx
  on public.protocol_procedure_reconciliations (protocol_version_id);
create index if not exists protocol_procedure_reconciliations_candidate_idx
  on public.protocol_procedure_reconciliations (procedure_candidate_id);
create index if not exists protocol_procedure_reconciliations_visit_idx
  on public.protocol_procedure_reconciliations (visit_reconciliation_id);
create index if not exists protocol_procedure_reconciliations_status_idx
  on public.protocol_procedure_reconciliations (reconciliation_status);

drop trigger if exists protocol_procedure_reconciliations_set_updated_at on public.protocol_procedure_reconciliations;
create trigger protocol_procedure_reconciliations_set_updated_at
before update on public.protocol_procedure_reconciliations
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- protocol_reconciliation_events (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  visit_reconciliation_id uuid null references public.protocol_visit_reconciliations (id) on delete set null,
  procedure_reconciliation_id uuid null references public.protocol_procedure_reconciliations (id) on delete set null,
  event_type text not null,
  actor_id uuid null references auth.users (id) on delete set null,
  event_timestamp timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  state_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint protocol_reconciliation_events_type_check check (
    event_type in (
      'visit_reconciliation_created',
      'visit_reconciliation_approved',
      'visit_reconciliation_rejected',
      'procedure_match_suggested',
      'procedure_reconciliation_approved',
      'procedure_reconciliation_rejected',
      'manual_mapping_created',
      'procedure_mapping_modified'
    )
  )
);

create index if not exists protocol_reconciliation_events_org_idx
  on public.protocol_reconciliation_events (organization_id);
create index if not exists protocol_reconciliation_events_version_idx
  on public.protocol_reconciliation_events (protocol_version_id);
create index if not exists protocol_reconciliation_events_visit_idx
  on public.protocol_reconciliation_events (visit_reconciliation_id);
create index if not exists protocol_reconciliation_events_procedure_idx
  on public.protocol_reconciliation_events (procedure_reconciliation_id);
create index if not exists protocol_reconciliation_events_timestamp_idx
  on public.protocol_reconciliation_events (event_timestamp);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.protocol_visit_reconciliations enable row level security;
alter table public.protocol_procedure_reconciliations enable row level security;
alter table public.protocol_reconciliation_events enable row level security;

drop policy if exists protocol_visit_reconciliations_select on public.protocol_visit_reconciliations;
create policy protocol_visit_reconciliations_select on public.protocol_visit_reconciliations
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_visit_reconciliations_insert on public.protocol_visit_reconciliations;
create policy protocol_visit_reconciliations_insert on public.protocol_visit_reconciliations
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_visit_reconciliations_update on public.protocol_visit_reconciliations;
create policy protocol_visit_reconciliations_update on public.protocol_visit_reconciliations
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_procedure_reconciliations_select on public.protocol_procedure_reconciliations;
create policy protocol_procedure_reconciliations_select on public.protocol_procedure_reconciliations
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_procedure_reconciliations_insert on public.protocol_procedure_reconciliations;
create policy protocol_procedure_reconciliations_insert on public.protocol_procedure_reconciliations
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_procedure_reconciliations_update on public.protocol_procedure_reconciliations;
create policy protocol_procedure_reconciliations_update on public.protocol_procedure_reconciliations
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_reconciliation_events_select on public.protocol_reconciliation_events;
create policy protocol_reconciliation_events_select on public.protocol_reconciliation_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

drop policy if exists protocol_reconciliation_events_insert on public.protocol_reconciliation_events;
create policy protocol_reconciliation_events_insert on public.protocol_reconciliation_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and prs.organization_id = organization_id
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );
