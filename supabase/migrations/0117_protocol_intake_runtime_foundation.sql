-- Phase P1: Protocol Intake Runtime Foundation
-- Human-supervised extraction storage. Not an AI autonomous compiler.

-- ---------------------------------------------------------------------------
-- protocol_runtime_studies (registry)
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_studies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  protocol_number text not null,
  protocol_title text not null,
  sponsor_name text null,
  therapeutic_area text null,
  phase text null,
  indication text null,
  protocol_status text not null default 'draft',
  current_protocol_version_id uuid null,
  source_document_id uuid null references public.compliance_runtime_documents (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_runtime_studies_status_check check (
    protocol_status in (
      'draft',
      'under_review',
      'runtime_mapping',
      'ready_for_generation',
      'published',
      'archived'
    )
  )
);

create index if not exists protocol_runtime_studies_org_idx
  on public.protocol_runtime_studies (organization_id);
create index if not exists protocol_runtime_studies_protocol_number_idx
  on public.protocol_runtime_studies (protocol_number);
create index if not exists protocol_runtime_studies_sponsor_idx
  on public.protocol_runtime_studies (sponsor_name);
create index if not exists protocol_runtime_studies_status_idx
  on public.protocol_runtime_studies (protocol_status);

drop trigger if exists protocol_runtime_studies_set_updated_at on public.protocol_runtime_studies;
create trigger protocol_runtime_studies_set_updated_at
before update on public.protocol_runtime_studies
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- protocol_runtime_versions (immutable-ish: identity fields immutable)
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_versions (
  id uuid primary key default gen_random_uuid(),
  protocol_runtime_study_id uuid not null references public.protocol_runtime_studies (id) on delete cascade,
  version_label text not null,
  amendment_number text null,
  version_date date null,
  source_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  raw_text jsonb not null default '{}'::jsonb,
  extraction_status text not null default 'pending',
  extraction_metadata jsonb not null default '{}'::jsonb,
  previous_version_id uuid null references public.protocol_runtime_versions (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint protocol_runtime_versions_extraction_status_check check (
    extraction_status in ('pending', 'extracting', 'review_required', 'ready', 'failed')
  )
);

alter table public.protocol_runtime_studies
  add constraint protocol_runtime_studies_current_version_fkey
  foreign key (current_protocol_version_id) references public.protocol_runtime_versions (id);

create index if not exists protocol_runtime_versions_study_idx
  on public.protocol_runtime_versions (protocol_runtime_study_id);
create index if not exists protocol_runtime_versions_version_label_idx
  on public.protocol_runtime_versions (version_label);
create index if not exists protocol_runtime_versions_amendment_idx
  on public.protocol_runtime_versions (amendment_number);
create index if not exists protocol_runtime_versions_status_idx
  on public.protocol_runtime_versions (extraction_status);

create or replace function public.enforce_protocol_runtime_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow extraction pipeline to update raw_text and extraction fields.
  if new.protocol_runtime_study_id is distinct from old.protocol_runtime_study_id then
    raise exception 'protocol_runtime_versions are immutable (protocol_runtime_study_id)';
  end if;
  if new.version_label is distinct from old.version_label then
    raise exception 'protocol_runtime_versions are immutable (version_label)';
  end if;
  if new.amendment_number is distinct from old.amendment_number then
    raise exception 'protocol_runtime_versions are immutable (amendment_number)';
  end if;
  if new.version_date is distinct from old.version_date then
    raise exception 'protocol_runtime_versions are immutable (version_date)';
  end if;
  if new.source_document_id is distinct from old.source_document_id then
    raise exception 'protocol_runtime_versions are immutable (source_document_id)';
  end if;
  if new.previous_version_id is distinct from old.previous_version_id then
    raise exception 'protocol_runtime_versions are immutable (previous_version_id)';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'protocol_runtime_versions are immutable (created_by)';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'protocol_runtime_versions are immutable (created_at)';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_protocol_runtime_version_immutability() from public;
grant execute on function public.enforce_protocol_runtime_version_immutability() to authenticated;

drop trigger if exists protocol_runtime_versions_immutability on public.protocol_runtime_versions;
create trigger protocol_runtime_versions_immutability
before update on public.protocol_runtime_versions
for each row execute function public.enforce_protocol_runtime_version_immutability();

-- ---------------------------------------------------------------------------
-- protocol_runtime_sections
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_sections (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  section_code text null,
  section_title text not null,
  section_type text not null,
  sequence_order integer not null,
  extracted_text text not null,
  extraction_confidence numeric(5,2) null,
  requires_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint protocol_runtime_sections_type_check check (
    section_type in (
      'schedule_of_activities',
      'visit_schedule',
      'procedure_section',
      'eligibility',
      'safety',
      'labs',
      'endpoints',
      'ip_management',
      'statistics',
      'other'
    )
  )
);

create index if not exists protocol_runtime_sections_version_idx
  on public.protocol_runtime_sections (protocol_version_id);
create index if not exists protocol_runtime_sections_type_idx
  on public.protocol_runtime_sections (section_type);
create index if not exists protocol_runtime_sections_order_idx
  on public.protocol_runtime_sections (sequence_order);

-- ---------------------------------------------------------------------------
-- protocol_runtime_visit_candidates
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_visit_candidates (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  visit_code text null,
  visit_name text not null,
  visit_type text null,
  study_day integer null,
  window_before_days integer null,
  window_after_days integer null,
  extracted_from_section_id uuid null references public.protocol_runtime_sections (id) on delete set null,
  confidence_score numeric(5,2) null,
  reconciliation_status text not null default 'unreviewed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint protocol_runtime_visit_candidates_status_check check (
    reconciliation_status in ('unreviewed', 'matched', 'modified', 'rejected', 'approved')
  )
);

create index if not exists protocol_runtime_visit_candidates_version_idx
  on public.protocol_runtime_visit_candidates (protocol_version_id);
create index if not exists protocol_runtime_visit_candidates_name_idx
  on public.protocol_runtime_visit_candidates (visit_name);
create index if not exists protocol_runtime_visit_candidates_status_idx
  on public.protocol_runtime_visit_candidates (reconciliation_status);

-- ---------------------------------------------------------------------------
-- protocol_runtime_procedure_candidates
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_procedure_candidates (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete cascade,
  visit_candidate_id uuid null references public.protocol_runtime_visit_candidates (id) on delete set null,
  procedure_name text not null,
  procedure_category text null,
  extracted_text text null,
  confidence_score numeric(5,2) null,
  matched_procedure_library_id uuid null references public.procedure_library (id) on delete set null,
  matched_blueprint_version_id uuid null references public.procedure_blueprint_versions (id) on delete set null,
  reconciliation_status text not null default 'unreviewed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint protocol_runtime_procedure_candidates_status_check check (
    reconciliation_status in ('unreviewed', 'matched', 'modified', 'rejected', 'approved')
  )
);

create index if not exists protocol_runtime_procedure_candidates_version_idx
  on public.protocol_runtime_procedure_candidates (protocol_version_id);
create index if not exists protocol_runtime_procedure_candidates_visit_candidate_idx
  on public.protocol_runtime_procedure_candidates (visit_candidate_id);
create index if not exists protocol_runtime_procedure_candidates_matched_procedure_idx
  on public.protocol_runtime_procedure_candidates (matched_procedure_library_id);
create index if not exists protocol_runtime_procedure_candidates_status_idx
  on public.protocol_runtime_procedure_candidates (reconciliation_status);

-- ---------------------------------------------------------------------------
-- protocol_runtime_amendment_links
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_runtime_amendment_links (
  id uuid primary key default gen_random_uuid(),
  protocol_runtime_study_id uuid not null references public.protocol_runtime_studies (id) on delete cascade,
  previous_protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete restrict,
  new_protocol_version_id uuid not null references public.protocol_runtime_versions (id) on delete restrict,
  amendment_type text not null default 'protocol_amendment',
  amendment_summary text null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint protocol_runtime_amendment_links_type_check check (
    amendment_type in (
      'protocol_amendment',
      'administrative_update',
      'ib_update',
      'soa_change',
      'safety_update',
      'other'
    )
  )
);

create index if not exists protocol_runtime_amendment_links_study_idx
  on public.protocol_runtime_amendment_links (protocol_runtime_study_id);
create index if not exists protocol_runtime_amendment_links_prev_idx
  on public.protocol_runtime_amendment_links (previous_protocol_version_id);
create index if not exists protocol_runtime_amendment_links_new_idx
  on public.protocol_runtime_amendment_links (new_protocol_version_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.protocol_runtime_studies enable row level security;
alter table public.protocol_runtime_versions enable row level security;
alter table public.protocol_runtime_sections enable row level security;
alter table public.protocol_runtime_visit_candidates enable row level security;
alter table public.protocol_runtime_procedure_candidates enable row level security;
alter table public.protocol_runtime_amendment_links enable row level security;

-- Studies: org membership; if study_id is set, require study access.
create policy protocol_runtime_studies_select on public.protocol_runtime_studies
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy protocol_runtime_studies_insert on public.protocol_runtime_studies
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy protocol_runtime_studies_update on public.protocol_runtime_studies
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

-- Child tables: access via parent protocol_runtime_studies join.
create policy protocol_runtime_versions_select on public.protocol_runtime_versions
  for select using (
    exists (
      select 1
      from public.protocol_runtime_studies prs
      where prs.id = protocol_runtime_study_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_versions_insert on public.protocol_runtime_versions
  for insert with check (
    exists (
      select 1
      from public.protocol_runtime_studies prs
      where prs.id = protocol_runtime_study_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_versions_update on public.protocol_runtime_versions
  for update using (
    exists (
      select 1
      from public.protocol_runtime_studies prs
      where prs.id = protocol_runtime_study_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_sections_select on public.protocol_runtime_sections
  for select using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_sections_insert on public.protocol_runtime_sections
  for insert with check (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_sections_delete on public.protocol_runtime_sections
  for delete using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_visit_candidates_select on public.protocol_runtime_visit_candidates
  for select using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_visit_candidates_insert on public.protocol_runtime_visit_candidates
  for insert with check (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_visit_candidates_delete on public.protocol_runtime_visit_candidates
  for delete using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_procedure_candidates_select on public.protocol_runtime_procedure_candidates
  for select using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_procedure_candidates_insert on public.protocol_runtime_procedure_candidates
  for insert with check (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_procedure_candidates_delete on public.protocol_runtime_procedure_candidates
  for delete using (
    exists (
      select 1
      from public.protocol_runtime_versions prv
      inner join public.protocol_runtime_studies prs on prs.id = prv.protocol_runtime_study_id
      where prv.id = protocol_version_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_amendment_links_select on public.protocol_runtime_amendment_links
  for select using (
    exists (
      select 1
      from public.protocol_runtime_studies prs
      where prs.id = protocol_runtime_study_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

create policy protocol_runtime_amendment_links_insert on public.protocol_runtime_amendment_links
  for insert with check (
    exists (
      select 1
      from public.protocol_runtime_studies prs
      where prs.id = protocol_runtime_study_id
        and public.user_has_active_organization_membership(prs.organization_id)
        and (prs.study_id is null or public.user_has_study_access(prs.study_id))
    )
  );

