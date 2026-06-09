-- Phase P4A: Runtime Source Package Signature Placeholders + Versioned Publish

-- ---------------------------------------------------------------------------
-- runtime_source_signature_placeholders
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_source_signature_placeholders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid not null references public.studies (id) on delete cascade,
  source_package_id uuid not null references public.runtime_source_packages (id) on delete cascade,
  visit_shell_id uuid null references public.runtime_source_visit_shells (id) on delete set null,
  procedure_shell_id uuid null references public.runtime_source_procedure_shells (id) on delete set null,
  placeholder_scope text not null,
  required_role text not null,
  signature_meaning text not null,
  required boolean not null default true,
  sequence_order integer not null default 1,
  display_label text not null,
  instructions text null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runtime_source_signature_placeholders_scope_check check (
    placeholder_scope in ('package', 'visit', 'procedure', 'section')
  ),
  constraint runtime_source_signature_placeholders_meaning_check check (
    signature_meaning in ('reviewed', 'approved', 'performed', 'verified', 'certified')
  ),
  constraint runtime_source_signature_placeholders_status_check check (
    status in ('active', 'inactive', 'archived')
  )
);

create index if not exists runtime_source_signature_placeholders_org_idx
  on public.runtime_source_signature_placeholders (organization_id);
create index if not exists runtime_source_signature_placeholders_study_idx
  on public.runtime_source_signature_placeholders (study_id);
create index if not exists runtime_source_signature_placeholders_package_idx
  on public.runtime_source_signature_placeholders (source_package_id);
create index if not exists runtime_source_signature_placeholders_visit_idx
  on public.runtime_source_signature_placeholders (visit_shell_id);
create index if not exists runtime_source_signature_placeholders_procedure_idx
  on public.runtime_source_signature_placeholders (procedure_shell_id);
create index if not exists runtime_source_signature_placeholders_role_idx
  on public.runtime_source_signature_placeholders (required_role);
create index if not exists runtime_source_signature_placeholders_scope_idx
  on public.runtime_source_signature_placeholders (placeholder_scope);
create index if not exists runtime_source_signature_placeholders_status_idx
  on public.runtime_source_signature_placeholders (status);

drop trigger if exists runtime_source_signature_placeholders_set_updated_at
  on public.runtime_source_signature_placeholders;
create trigger runtime_source_signature_placeholders_set_updated_at
before update on public.runtime_source_signature_placeholders
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- runtime_source_package_publications (versioned)
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_source_package_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid not null references public.studies (id) on delete cascade,
  source_package_id uuid not null references public.runtime_source_packages (id) on delete restrict,
  publication_version integer not null,
  publication_status text not null default 'published',
  package_hash text not null,
  published_by uuid not null references auth.users (id) on delete restrict,
  published_at timestamptz not null default now(),
  supersedes_publication_id uuid null references public.runtime_source_package_publications (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint runtime_source_package_publications_status_check check (
    publication_status in ('published', 'superseded', 'archived')
  ),
  constraint runtime_source_package_publications_unique_version unique (study_id, publication_version),
  constraint runtime_source_package_publications_unique_package unique (source_package_id)
);

create index if not exists runtime_source_package_publications_org_idx
  on public.runtime_source_package_publications (organization_id);
create index if not exists runtime_source_package_publications_study_idx
  on public.runtime_source_package_publications (study_id);
create index if not exists runtime_source_package_publications_package_idx
  on public.runtime_source_package_publications (source_package_id);
create index if not exists runtime_source_package_publications_status_idx
  on public.runtime_source_package_publications (publication_status);
create index if not exists runtime_source_package_publications_hash_idx
  on public.runtime_source_package_publications (package_hash);
create index if not exists runtime_source_package_publications_published_at_idx
  on public.runtime_source_package_publications (published_at);

-- ---------------------------------------------------------------------------
-- runtime_source_publication_events (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_source_publication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid not null references public.studies (id) on delete cascade,
  source_package_id uuid not null references public.runtime_source_packages (id) on delete cascade,
  publication_id uuid null references public.runtime_source_package_publications (id) on delete set null,
  event_type text not null,
  actor_id uuid null references auth.users (id) on delete set null,
  event_timestamp timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  state_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint runtime_source_publication_events_type_check check (
    event_type in (
      'signature_placeholder_created',
      'source_package_published',
      'source_package_superseded',
      'source_package_publish_failed'
    )
  )
);

create index if not exists runtime_source_publication_events_org_idx
  on public.runtime_source_publication_events (organization_id);
create index if not exists runtime_source_publication_events_study_idx
  on public.runtime_source_publication_events (study_id);
create index if not exists runtime_source_publication_events_package_idx
  on public.runtime_source_publication_events (source_package_id);
create index if not exists runtime_source_publication_events_publication_idx
  on public.runtime_source_publication_events (publication_id);
create index if not exists runtime_source_publication_events_timestamp_idx
  on public.runtime_source_publication_events (event_timestamp);

-- ---------------------------------------------------------------------------
-- RLS (match runtime source package access patterns)
-- ---------------------------------------------------------------------------

alter table public.runtime_source_signature_placeholders enable row level security;
alter table public.runtime_source_package_publications enable row level security;
alter table public.runtime_source_publication_events enable row level security;

drop policy if exists runtime_source_signature_placeholders_select on public.runtime_source_signature_placeholders;
create policy runtime_source_signature_placeholders_select on public.runtime_source_signature_placeholders
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_signature_placeholders_insert on public.runtime_source_signature_placeholders;
create policy runtime_source_signature_placeholders_insert on public.runtime_source_signature_placeholders
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_signature_placeholders_update on public.runtime_source_signature_placeholders;
create policy runtime_source_signature_placeholders_update on public.runtime_source_signature_placeholders
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_package_publications_select on public.runtime_source_package_publications;
create policy runtime_source_package_publications_select on public.runtime_source_package_publications
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_package_publications_insert on public.runtime_source_package_publications;
create policy runtime_source_package_publications_insert on public.runtime_source_package_publications
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_package_publications_update on public.runtime_source_package_publications;
create policy runtime_source_package_publications_update on public.runtime_source_package_publications
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_publication_events_select on public.runtime_source_publication_events;
create policy runtime_source_publication_events_select on public.runtime_source_publication_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists runtime_source_publication_events_insert on public.runtime_source_publication_events;
create policy runtime_source_publication_events_insert on public.runtime_source_publication_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

