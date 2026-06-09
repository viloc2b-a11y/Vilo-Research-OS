-- 0162_signature_engine_unification.sql
-- Unified platform-wide signature engine.
-- Reuses operational_signature_requests / operational_signatures / operational_signature_events
-- and adds credential + policy layers without creating module-specific signature systems.

create table if not exists public.signature_credentials (
  credential_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  signature_pin_hash text not null,
  pin_created_at timestamptz not null default now(),
  pin_updated_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  locked_until timestamptz null,
  requires_reset boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  constraint signature_credentials_failed_attempts_check check (failed_attempts >= 0),
  constraint signature_credentials_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists signature_credentials_user_unique_idx
  on public.signature_credentials(user_id);
create index if not exists signature_credentials_active_idx
  on public.signature_credentials(active, locked_until);

create table if not exists public.signature_policies (
  policy_code text primary key,
  policy_name text not null,
  description text null,
  allowed_roles jsonb not null default '[]'::jsonb,
  mfa_required boolean not null default false,
  co_signature_required boolean not null default false,
  signature_meaning_required boolean not null default true,
  subject_involvement_required boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signature_policies_allowed_roles_object check (jsonb_typeof(allowed_roles) = 'array'),
  constraint signature_policies_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists signature_policies_active_idx
  on public.signature_policies(policy_code)
  where active = true;

insert into public.signature_policies (
  policy_code,
  policy_name,
  description,
  allowed_roles,
  mfa_required,
  co_signature_required,
  signature_meaning_required,
  subject_involvement_required,
  metadata
)
values
  (
    'standard_signature',
    'Standard Signature',
    'Default operational signature policy for routine review, approval, acknowledgement, and execution sign-off.',
    '[]'::jsonb,
    false,
    false,
    true,
    false,
    '{"examples":["eSource completion","PI review","AE review","visit sign-off","training acknowledgement","delegation log","pharmacy review"]}'::jsonb
  ),
  (
    'critical_signature',
    'Critical Signature',
    'High-risk signature policy for study closeout, regulatory certification, unblinding, and critical deviations.',
    '[]'::jsonb,
    true,
    false,
    true,
    false,
    '{"examples":["study closure","regulatory certification","unblinding","critical deviation","high-risk action"]}'::jsonb
  ),
  (
    'subject_consent',
    'Subject Consent',
    'Signature policy for subject consent workflows where patient or guardian participation is required.',
    '[]'::jsonb,
    false,
    false,
    true,
    true,
    '{"examples":["eConsent","reconsent","consent evidence capture"]}'::jsonb
  ),
  (
    'reconsent',
    'Reconsent',
    'Policy used when an existing subject must acknowledge a new consent version or protocol amendment.',
    '[]'::jsonb,
    false,
    false,
    true,
    true,
    '{"examples":["amendment consent","new information reconsent"]}'::jsonb
  ),
  (
    'co_signature',
    'Co-signature',
    'Policy for sequential or paired sign-off where a second signer is required before downstream execution.',
    '[]'::jsonb,
    true,
    true,
    true,
    false,
    '{"examples":["coordinator -> PI","pharmacist review","medical monitor review"]}'::jsonb
  )
on conflict (policy_code) do update set
  policy_name = excluded.policy_name,
  description = excluded.description,
  allowed_roles = excluded.allowed_roles,
  mfa_required = excluded.mfa_required,
  co_signature_required = excluded.co_signature_required,
  signature_meaning_required = excluded.signature_meaning_required,
  subject_involvement_required = excluded.subject_involvement_required,
  metadata = excluded.metadata,
  updated_at = now();

alter table public.operational_signature_requests
  add column if not exists signature_policy_code text not null default 'standard_signature',
  add column if not exists requested_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists module text null,
  add column if not exists entity_type text null,
  add column if not exists entity_id uuid null;

alter table public.operational_signatures
  add column if not exists signer_name_snapshot text null,
  add column if not exists signer_role_snapshot text null,
  add column if not exists verification_method text not null default 'signature_pin',
  add column if not exists signed_content_version text not null default '1',
  add column if not exists session_id text null,
  add column if not exists audit_trail_id uuid null,
  add column if not exists signature_policy_code text not null default 'standard_signature',
  add column if not exists module text null,
  add column if not exists entity_type text null,
  add column if not exists entity_id uuid null;

create index if not exists operational_signature_requests_policy_idx
  on public.operational_signature_requests(signature_policy_code);
create index if not exists operational_signatures_policy_idx
  on public.operational_signatures(signature_policy_code);
create index if not exists signature_credentials_user_active_idx
  on public.signature_credentials(user_id, active, locked_until);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists signature_policies_touch_updated_at on public.signature_policies;
create trigger signature_policies_touch_updated_at
before update on public.signature_policies
for each row execute function public.touch_updated_at();

alter table public.signature_credentials enable row level security;
alter table public.signature_policies enable row level security;

drop policy if exists signature_credentials_select on public.signature_credentials;
create policy signature_credentials_select on public.signature_credentials
  for select using (auth.uid() = user_id);

drop policy if exists signature_credentials_insert on public.signature_credentials;
create policy signature_credentials_insert on public.signature_credentials
  for insert with check (auth.uid() = user_id);

drop policy if exists signature_credentials_update on public.signature_credentials;
create policy signature_credentials_update on public.signature_credentials
  for update using (auth.uid() = user_id);

drop policy if exists signature_policies_select on public.signature_policies;
create policy signature_policies_select on public.signature_policies
  for select using (active = true);

comment on table public.signature_credentials is
  'Platform-wide signature credential layer. PIN is distinct from login password and is used by the shared Signature Engine.';

comment on table public.signature_policies is
  'Platform-wide signature policy registry for the shared Signature Engine.';
