-- K5: Operational eSignature runtime foundation.
-- Operational signatures are separate from Evidence Signoff and do not mutate evidence,
-- reconciliation, source publication, runtime source, visit execution, or locked snapshots.

create table if not exists public.operational_signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  subject_id uuid null,
  visit_id uuid null,
  source_package_id uuid null,
  published_source_id uuid null,
  locked_snapshot_id uuid null,
  artifact_type text not null,
  artifact_id uuid not null,
  required_role text not null,
  signature_meaning text not null,
  status text not null default 'pending',
  requested_by uuid null references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint operational_signature_requests_meaning_check check (
    signature_meaning in (
      'completed_by',
      'reviewed_by',
      'approved_by',
      'acknowledged_by',
      'pi_review',
      'si_review',
      'query_closure',
      'lock_approval'
    )
  ),
  constraint operational_signature_requests_status_check check (
    status in ('pending', 'signed', 'cancelled', 'superseded')
  ),
  constraint operational_signature_requests_artifact_type_check check (
    length(trim(artifact_type)) > 0
  ),
  constraint operational_signature_requests_required_role_check check (
    length(trim(required_role)) > 0
  ),
  constraint operational_signature_requests_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists operational_signature_requests_org_idx
  on public.operational_signature_requests (organization_id);
create index if not exists operational_signature_requests_study_idx
  on public.operational_signature_requests (study_id);
create index if not exists operational_signature_requests_status_idx
  on public.operational_signature_requests (status);
create index if not exists operational_signature_requests_artifact_idx
  on public.operational_signature_requests (artifact_type, artifact_id);

create table if not exists public.operational_signatures (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.operational_signature_requests (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  subject_id uuid null,
  visit_id uuid null,
  source_package_id uuid null,
  published_source_id uuid null,
  locked_snapshot_id uuid null,
  artifact_type text not null,
  artifact_id uuid not null,
  required_role text not null,
  signer_user_id uuid not null references auth.users (id) on delete restrict,
  signer_role text not null,
  signature_meaning text not null,
  signed_artifact_hash text not null,
  signed_at timestamptz not null default now(),
  ip_address inet null,
  user_agent text null,
  status text not null default 'signed',
  supersedes_signature_id uuid null references public.operational_signatures (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  constraint operational_signatures_meaning_check check (
    signature_meaning in (
      'completed_by',
      'reviewed_by',
      'approved_by',
      'acknowledged_by',
      'pi_review',
      'si_review',
      'query_closure',
      'lock_approval'
    )
  ),
  constraint operational_signatures_status_check check (
    status in ('signed', 'superseded')
  ),
  constraint operational_signatures_hash_check check (
    length(trim(signed_artifact_hash)) >= 32
  ),
  constraint operational_signatures_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create unique index if not exists operational_signatures_request_once_idx
  on public.operational_signatures (request_id)
  where status = 'signed';
create index if not exists operational_signatures_org_idx
  on public.operational_signatures (organization_id);
create index if not exists operational_signatures_study_idx
  on public.operational_signatures (study_id);
create index if not exists operational_signatures_artifact_idx
  on public.operational_signatures (artifact_type, artifact_id);
create index if not exists operational_signatures_signed_at_idx
  on public.operational_signatures (signed_at);

create table if not exists public.operational_signature_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  request_id uuid null references public.operational_signature_requests (id) on delete restrict,
  signature_id uuid null references public.operational_signatures (id) on delete restrict,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid null references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint operational_signature_events_type_check check (
    length(trim(event_type)) > 0
  ),
  constraint operational_signature_events_payload_object check (
    jsonb_typeof(event_payload) = 'object'
  ),
  constraint operational_signature_events_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists operational_signature_events_org_idx
  on public.operational_signature_events (organization_id);
create index if not exists operational_signature_events_study_idx
  on public.operational_signature_events (study_id);
create index if not exists operational_signature_events_request_idx
  on public.operational_signature_events (request_id);
create index if not exists operational_signature_events_signature_idx
  on public.operational_signature_events (signature_id);
create index if not exists operational_signature_events_occurred_at_idx
  on public.operational_signature_events (occurred_at);

create or replace function public.operational_signatures_deny_completed_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed' then
    raise exception 'completed operational signatures are append-only; record a superseding event instead';
  end if;
  raise exception 'operational signatures are append-only';
end;
$$;

drop trigger if exists operational_signatures_deny_completed_update
  on public.operational_signatures;
create trigger operational_signatures_deny_completed_update
before update or delete on public.operational_signatures
for each row execute function public.operational_signatures_deny_completed_mutation();

create or replace function public.operational_signature_events_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'operational signature events are append-only';
end;
$$;

drop trigger if exists operational_signature_events_deny_update
  on public.operational_signature_events;
create trigger operational_signature_events_deny_update
before update or delete on public.operational_signature_events
for each row execute function public.operational_signature_events_deny_mutation();

alter table public.operational_signature_requests enable row level security;
alter table public.operational_signatures enable row level security;
alter table public.operational_signature_events enable row level security;

create policy operational_signature_requests_select
  on public.operational_signature_requests
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signature_requests_insert
  on public.operational_signature_requests
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signature_requests_update
  on public.operational_signature_requests
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signatures_select
  on public.operational_signatures
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signatures_insert
  on public.operational_signatures
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signature_events_select
  on public.operational_signature_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy operational_signature_events_insert
  on public.operational_signature_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
