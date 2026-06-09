-- Phase 17 — CRM + Communications cockpit
-- Native Vilo OS sections:
--   /crm/patients
--   /crm/business-development
--   /communications
--
-- Design goals:
--   * Separate PHI patient recruitment from business development pipeline.
--   * Keep communications linked to CRM entities and studies/tasks.
--   * Reuse existing org/study membership, RLS, and updated_at conventions.
--   * No parallel CTMS, no parallel source of truth.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.crm_patient_stage_enum as enum (
    'lead',
    'contacted',
    'pre_screen',
    'qualified',
    'scheduled',
    'consented',
    'screened',
    'randomized',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_contact_method_enum as enum (
    'email',
    'phone',
    'sms',
    'whatsapp',
    'linkedin',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_patient_contact_permission_enum as enum (
    'unknown',
    'requested',
    'granted',
    'denied',
    'revoked'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_match_status_enum as enum (
    'suggested',
    'reviewed',
    'accepted',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_followup_status_enum as enum (
    'open',
    'in_progress',
    'done',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.bd_company_type_enum as enum (
    'sponsor',
    'cro',
    'lab',
    'biobank',
    'vendor',
    'physician_network',
    'community_partner',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.bd_opportunity_stage_enum as enum (
    'lead',
    'contacted',
    'feasibility_sent',
    'selected',
    'contracting',
    'active',
    'won',
    'lost',
    'paused'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.bd_interaction_channel_enum as enum (
    'email',
    'call',
    'meeting',
    'sms',
    'whatsapp',
    'note',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.bd_task_status_enum as enum (
    'open',
    'in_progress',
    'done',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_sensitivity_enum as enum (
    'patient',
    'business_development',
    'internal'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_review_status_enum as enum (
    'draft',
    'needs_review',
    'approved',
    'sent',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_direction_enum as enum (
    'inbound',
    'outbound',
    'internal',
    'draft'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_status_enum as enum (
    'draft',
    'queued',
    'sent',
    'received',
    'failed',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_provider_enum as enum (
    'mock',
    'ipage'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function public.crm_user_has_org_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and (
        m.role = any(p_roles)
        or exists (
          select 1
          from unnest(coalesce(m.roles, array[]::text[])) role_value
          where role_value = any(p_roles)
        )
      )
  );
$$;

create or replace function public.crm_user_can_access_patient_crm(
  p_organization_id uuid,
  p_study_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_user_has_org_role(
    p_organization_id,
    array['owner','admin','site_staff','research_coordinator','data_coordinator','pi_sub_i']::text[]
  )
  or (
    p_study_id is not null
    and public.user_has_study_access(p_study_id)
  );
$$;

create or replace function public.crm_user_can_manage_patient_crm(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_user_has_org_role(
    p_organization_id,
    array['owner','admin','site_staff','research_coordinator','data_coordinator']::text[]
  );
$$;

create or replace function public.crm_user_can_access_bd_crm(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_user_has_org_role(
    p_organization_id,
    array['owner','admin','site_staff','research_coordinator','data_coordinator','pi_sub_i']::text[]
  );
$$;

create or replace function public.crm_user_can_manage_bd_crm(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_user_has_org_role(
    p_organization_id,
    array['owner','admin','site_staff','research_coordinator','data_coordinator']::text[]
  );
$$;

create or replace function public.crm_user_can_access_communications(
  p_organization_id uuid,
  p_sensitivity public.communication_sensitivity_enum
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_sensitivity = 'patient' then public.crm_user_can_access_patient_crm(p_organization_id)
    else public.crm_user_can_access_bd_crm(p_organization_id)
  end;
$$;

create or replace function public.crm_user_can_manage_communications(
  p_organization_id uuid,
  p_sensitivity public.communication_sensitivity_enum
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_sensitivity = 'patient' then public.crm_user_can_manage_patient_crm(p_organization_id)
    else public.crm_user_can_manage_bd_crm(p_organization_id)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Patient CRM
-- ---------------------------------------------------------------------------

create table if not exists public.patient_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  preferred_contact_method public.crm_contact_method_enum not null default 'phone',
  recruitment_source text,
  stage public.crm_patient_stage_enum not null default 'lead',
  contact_permission public.crm_patient_contact_permission_enum not null default 'unknown',
  contact_permission_notes text,
  consent_to_contact boolean not null default false,
  condition_summary text,
  study_interest_summary text,
  assigned_user_id uuid references auth.users (id) on delete set null,
  next_follow_up_at timestamptz,
  linked_subject_id uuid references public.study_subjects (id) on delete set null,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_leads_org_stage_idx
  on public.patient_leads (organization_id, stage, next_follow_up_at desc, created_at desc)
  where archived_at is null;

create index if not exists patient_leads_study_idx
  on public.patient_leads (study_id, stage, created_at desc)
  where study_id is not null and archived_at is null;

create index if not exists patient_leads_assigned_idx
  on public.patient_leads (assigned_user_id, stage, next_follow_up_at desc)
  where archived_at is null;

drop trigger if exists trg_patient_leads_updated_at on public.patient_leads;
create trigger trg_patient_leads_updated_at
  before update on public.patient_leads
  for each row execute function public.touch_updated_at();

create table if not exists public.patient_contact_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_lead_id uuid not null references public.patient_leads (id) on delete cascade,
  allow_email boolean not null default false,
  allow_phone boolean not null default false,
  allow_sms boolean not null default false,
  allow_whatsapp boolean not null default false,
  allow_calls boolean not null default false,
  permission_status public.crm_patient_contact_permission_enum not null default 'unknown',
  permission_source text,
  granted_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_contact_permissions_patient_idx
  on public.patient_contact_permissions (patient_lead_id, created_at desc);

drop trigger if exists trg_patient_contact_permissions_updated_at on public.patient_contact_permissions;
create trigger trg_patient_contact_permissions_updated_at
  before update on public.patient_contact_permissions
  for each row execute function public.touch_updated_at();

create table if not exists public.patient_conditions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_lead_id uuid not null references public.patient_leads (id) on delete cascade,
  condition_name text not null,
  condition_type text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_conditions_patient_idx
  on public.patient_conditions (patient_lead_id, condition_name);

drop trigger if exists trg_patient_conditions_updated_at on public.patient_conditions;
create trigger trg_patient_conditions_updated_at
  before update on public.patient_conditions
  for each row execute function public.touch_updated_at();

create table if not exists public.patient_study_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_lead_id uuid not null references public.patient_leads (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  match_score numeric(5,2) not null default 0,
  match_status public.crm_match_status_enum not null default 'suggested',
  rationale text,
  recommended_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_study_matches_patient_idx
  on public.patient_study_matches (patient_lead_id, match_status, match_score desc);

create index if not exists patient_study_matches_study_idx
  on public.patient_study_matches (study_id, match_status, match_score desc);

drop trigger if exists trg_patient_study_matches_updated_at on public.patient_study_matches;
create trigger trg_patient_study_matches_updated_at
  before update on public.patient_study_matches
  for each row execute function public.touch_updated_at();

create table if not exists public.patient_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_lead_id uuid not null references public.patient_leads (id) on delete cascade,
  title text not null,
  next_step text,
  due_at timestamptz,
  status public.crm_followup_status_enum not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  owner_user_id uuid references auth.users (id) on delete set null,
  linked_study_id uuid references public.studies (id) on delete set null,
  linked_visit_id uuid references public.visits (id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_followups_patient_idx
  on public.patient_followups (patient_lead_id, status, due_at desc, created_at desc);

create index if not exists patient_followups_owner_idx
  on public.patient_followups (owner_user_id, status, due_at desc)
  where owner_user_id is not null;

drop trigger if exists trg_patient_followups_updated_at on public.patient_followups;
create trigger trg_patient_followups_updated_at
  before update on public.patient_followups
  for each row execute function public.touch_updated_at();

create table if not exists public.patient_navigation_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_lead_id uuid not null references public.patient_leads (id) on delete cascade,
  note text not null,
  note_kind text not null default 'navigation',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_navigation_notes_patient_idx
  on public.patient_navigation_notes (patient_lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Business Development CRM
-- ---------------------------------------------------------------------------

create table if not exists public.bd_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_type public.bd_company_type_enum not null default 'other',
  name text not null,
  website text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bd_companies_org_type_idx
  on public.bd_companies (organization_id, company_type, status, created_at desc)
  where archived_at is null;

create index if not exists bd_companies_name_idx
  on public.bd_companies (organization_id, lower(name))
  where archived_at is null;

drop trigger if exists trg_bd_companies_updated_at on public.bd_companies;
create trigger trg_bd_companies_updated_at
  before update on public.bd_companies
  for each row execute function public.touch_updated_at();

create table if not exists public.bd_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.bd_companies (id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  preferred_contact_method public.crm_contact_method_enum not null default 'email',
  is_primary boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bd_contacts_company_idx
  on public.bd_contacts (company_id, is_primary desc, created_at desc)
  where archived_at is null;

create index if not exists bd_contacts_email_idx
  on public.bd_contacts (organization_id, email)
  where archived_at is null and email is not null;

drop trigger if exists trg_bd_contacts_updated_at on public.bd_contacts;
create trigger trg_bd_contacts_updated_at
  before update on public.bd_contacts
  for each row execute function public.touch_updated_at();

create table if not exists public.bd_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.bd_companies (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  title text not null,
  stage public.bd_opportunity_stage_enum not null default 'lead',
  expected_value numeric(12,2),
  currency text not null default 'USD',
  budget_status text,
  cta_status text,
  owner_user_id uuid references auth.users (id) on delete set null,
  next_follow_up_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bd_opportunities_company_idx
  on public.bd_opportunities (company_id, stage, next_follow_up_at desc, created_at desc)
  where archived_at is null;

create index if not exists bd_opportunities_study_idx
  on public.bd_opportunities (study_id, stage, next_follow_up_at desc)
  where study_id is not null and archived_at is null;

create index if not exists bd_opportunities_owner_idx
  on public.bd_opportunities (owner_user_id, stage, next_follow_up_at desc)
  where owner_user_id is not null and archived_at is null;

drop trigger if exists trg_bd_opportunities_updated_at on public.bd_opportunities;
create trigger trg_bd_opportunities_updated_at
  before update on public.bd_opportunities
  for each row execute function public.touch_updated_at();

create table if not exists public.bd_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.bd_companies (id) on delete cascade,
  contact_id uuid references public.bd_contacts (id) on delete set null,
  opportunity_id uuid references public.bd_opportunities (id) on delete set null,
  channel public.bd_interaction_channel_enum not null default 'note',
  direction text not null default 'internal' check (direction in ('inbound','outbound','internal')),
  subject text,
  summary text,
  body text,
  happened_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bd_interactions_company_idx
  on public.bd_interactions (company_id, happened_at desc);

create index if not exists bd_interactions_opportunity_idx
  on public.bd_interactions (opportunity_id, happened_at desc)
  where opportunity_id is not null;

create table if not exists public.bd_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.bd_companies (id) on delete set null,
  contact_id uuid references public.bd_contacts (id) on delete set null,
  opportunity_id uuid references public.bd_opportunities (id) on delete set null,
  title text not null,
  next_step text,
  due_at timestamptz,
  status public.bd_task_status_enum not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  owner_user_id uuid references auth.users (id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bd_tasks_org_status_idx
  on public.bd_tasks (organization_id, status, due_at desc, created_at desc);

create index if not exists bd_tasks_owner_idx
  on public.bd_tasks (owner_user_id, status, due_at desc)
  where owner_user_id is not null;

drop trigger if exists trg_bd_tasks_updated_at on public.bd_tasks;
create trigger trg_bd_tasks_updated_at
  before update on public.bd_tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Communications
-- ---------------------------------------------------------------------------

create table if not exists public.communications_mailboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mailbox_email text not null,
  display_name text,
  provider public.communication_provider_enum not null default 'mock',
  imap_host text,
  imap_port integer,
  imap_secure boolean not null default true,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean not null default true,
  sync_enabled boolean not null default false,
  sync_status text not null default 'mock' check (sync_status in ('mock', 'pending', 'active', 'blocked', 'error')),
  last_synced_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists communications_mailboxes_org_idx
  on public.communications_mailboxes (organization_id, sync_status, created_at desc)
  where archived_at is null;

create index if not exists communications_mailboxes_email_idx
  on public.communications_mailboxes (organization_id, lower(mailbox_email))
  where archived_at is null;

drop trigger if exists trg_communications_mailboxes_updated_at on public.communications_mailboxes;
create trigger trg_communications_mailboxes_updated_at
  before update on public.communications_mailboxes
  for each row execute function public.touch_updated_at();

create table if not exists public.communications_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mailbox_id uuid references public.communications_mailboxes (id) on delete set null,
  sensitivity public.communication_sensitivity_enum not null default 'business_development',
  thread_key text not null,
  subject text,
  review_status public.communication_review_status_enum not null default 'draft',
  vip_summary text,
  vip_follow_up_draft text,
  patient_lead_id uuid references public.patient_leads (id) on delete set null,
  bd_company_id uuid references public.bd_companies (id) on delete set null,
  bd_contact_id uuid references public.bd_contacts (id) on delete set null,
  bd_opportunity_id uuid references public.bd_opportunities (id) on delete set null,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  last_message_at timestamptz,
  last_message_direction public.communication_direction_enum,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists communications_threads_key_idx
  on public.communications_threads (organization_id, thread_key);

create index if not exists communications_threads_org_idx
  on public.communications_threads (organization_id, review_status, last_message_at desc)
  where archived_at is null;

create index if not exists communications_threads_patient_idx
  on public.communications_threads (patient_lead_id, last_message_at desc)
  where patient_lead_id is not null and archived_at is null;

create index if not exists communications_threads_bd_idx
  on public.communications_threads (bd_company_id, bd_opportunity_id, last_message_at desc)
  where archived_at is null;

drop trigger if exists trg_communications_threads_updated_at on public.communications_threads;
create trigger trg_communications_threads_updated_at
  before update on public.communications_threads
  for each row execute function public.touch_updated_at();

create table if not exists public.communications_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mailbox_id uuid references public.communications_mailboxes (id) on delete set null,
  thread_id uuid not null references public.communications_threads (id) on delete cascade,
  sensitivity public.communication_sensitivity_enum not null default 'business_development',
  direction public.communication_direction_enum not null default 'draft',
  status public.communication_status_enum not null default 'draft',
  channel public.crm_contact_method_enum not null default 'email',
  from_address text,
  to_addresses text[] not null default '{}'::text[],
  cc_addresses text[] not null default '{}'::text[],
  bcc_addresses text[] not null default '{}'::text[],
  subject text,
  body text,
  html_body text,
  provider_message_id text,
  provider_thread_id text,
  patient_lead_id uuid references public.patient_leads (id) on delete set null,
  bd_company_id uuid references public.bd_companies (id) on delete set null,
  bd_contact_id uuid references public.bd_contacts (id) on delete set null,
  bd_opportunity_id uuid references public.bd_opportunities (id) on delete set null,
  study_id uuid references public.studies (id) on delete set null,
  study_subject_id uuid references public.study_subjects (id) on delete set null,
  requires_human_review boolean not null default true,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists communications_messages_thread_idx
  on public.communications_messages (thread_id, created_at desc);

create index if not exists communications_messages_org_idx
  on public.communications_messages (organization_id, status, direction, created_at desc);

create index if not exists communications_messages_sensitivity_idx
  on public.communications_messages (organization_id, sensitivity, created_at desc);

drop trigger if exists trg_communications_messages_updated_at on public.communications_messages;
create trigger trg_communications_messages_updated_at
  before update on public.communications_messages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.patient_leads enable row level security;
alter table public.patient_contact_permissions enable row level security;
alter table public.patient_conditions enable row level security;
alter table public.patient_study_matches enable row level security;
alter table public.patient_followups enable row level security;
alter table public.patient_navigation_notes enable row level security;
alter table public.bd_companies enable row level security;
alter table public.bd_contacts enable row level security;
alter table public.bd_opportunities enable row level security;
alter table public.bd_interactions enable row level security;
alter table public.bd_tasks enable row level security;
alter table public.communications_mailboxes enable row level security;
alter table public.communications_threads enable row level security;
alter table public.communications_messages enable row level security;

-- Patient CRM: PHI-scoped, narrower access.
drop policy if exists patient_leads_select on public.patient_leads;
create policy patient_leads_select on public.patient_leads
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, study_id));

drop policy if exists patient_leads_insert on public.patient_leads;
create policy patient_leads_insert on public.patient_leads
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_leads_update on public.patient_leads;
create policy patient_leads_update on public.patient_leads
for update to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id))
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_leads_delete on public.patient_leads;
create policy patient_leads_delete on public.patient_leads
for delete to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_contact_permissions_select on public.patient_contact_permissions;
create policy patient_contact_permissions_select on public.patient_contact_permissions
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, null));

drop policy if exists patient_contact_permissions_insert on public.patient_contact_permissions;
create policy patient_contact_permissions_insert on public.patient_contact_permissions
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_contact_permissions_update on public.patient_contact_permissions;
create policy patient_contact_permissions_update on public.patient_contact_permissions
for update to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id))
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_conditions_select on public.patient_conditions;
create policy patient_conditions_select on public.patient_conditions
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, null));

drop policy if exists patient_conditions_insert on public.patient_conditions;
create policy patient_conditions_insert on public.patient_conditions
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_conditions_update on public.patient_conditions;
create policy patient_conditions_update on public.patient_conditions
for update to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id))
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_study_matches_select on public.patient_study_matches;
create policy patient_study_matches_select on public.patient_study_matches
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, study_id));

drop policy if exists patient_study_matches_insert on public.patient_study_matches;
create policy patient_study_matches_insert on public.patient_study_matches
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_study_matches_update on public.patient_study_matches;
create policy patient_study_matches_update on public.patient_study_matches
for update to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id))
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_followups_select on public.patient_followups;
create policy patient_followups_select on public.patient_followups
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, null));

drop policy if exists patient_followups_insert on public.patient_followups;
create policy patient_followups_insert on public.patient_followups
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_followups_update on public.patient_followups;
create policy patient_followups_update on public.patient_followups
for update to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id))
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_navigation_notes_select on public.patient_navigation_notes;
create policy patient_navigation_notes_select on public.patient_navigation_notes
for select to authenticated
using (public.crm_user_can_access_patient_crm(organization_id, null));

drop policy if exists patient_navigation_notes_insert on public.patient_navigation_notes;
create policy patient_navigation_notes_insert on public.patient_navigation_notes
for insert to authenticated
with check (public.crm_user_can_manage_patient_crm(organization_id));

drop policy if exists patient_navigation_notes_delete on public.patient_navigation_notes;
create policy patient_navigation_notes_delete on public.patient_navigation_notes
for delete to authenticated
using (public.crm_user_can_manage_patient_crm(organization_id));

-- Business development CRM: broad org access, no PHI.
drop policy if exists bd_companies_select on public.bd_companies;
create policy bd_companies_select on public.bd_companies
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists bd_companies_insert on public.bd_companies;
create policy bd_companies_insert on public.bd_companies
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_companies_update on public.bd_companies;
create policy bd_companies_update on public.bd_companies
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_companies_delete on public.bd_companies;
create policy bd_companies_delete on public.bd_companies
for delete to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_contacts_select on public.bd_contacts;
create policy bd_contacts_select on public.bd_contacts
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists bd_contacts_insert on public.bd_contacts;
create policy bd_contacts_insert on public.bd_contacts
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_contacts_update on public.bd_contacts;
create policy bd_contacts_update on public.bd_contacts
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_contacts_delete on public.bd_contacts;
create policy bd_contacts_delete on public.bd_contacts
for delete to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_opportunities_select on public.bd_opportunities;
create policy bd_opportunities_select on public.bd_opportunities
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists bd_opportunities_insert on public.bd_opportunities;
create policy bd_opportunities_insert on public.bd_opportunities
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_opportunities_update on public.bd_opportunities;
create policy bd_opportunities_update on public.bd_opportunities
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_opportunities_delete on public.bd_opportunities;
create policy bd_opportunities_delete on public.bd_opportunities
for delete to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_interactions_select on public.bd_interactions;
create policy bd_interactions_select on public.bd_interactions
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists bd_interactions_insert on public.bd_interactions;
create policy bd_interactions_insert on public.bd_interactions
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_interactions_update on public.bd_interactions;
create policy bd_interactions_update on public.bd_interactions
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_tasks_select on public.bd_tasks;
create policy bd_tasks_select on public.bd_tasks
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists bd_tasks_insert on public.bd_tasks;
create policy bd_tasks_insert on public.bd_tasks
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_tasks_update on public.bd_tasks;
create policy bd_tasks_update on public.bd_tasks
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists bd_tasks_delete on public.bd_tasks;
create policy bd_tasks_delete on public.bd_tasks
for delete to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id));

-- Communications: route by sensitivity.
drop policy if exists communications_mailboxes_select on public.communications_mailboxes;
create policy communications_mailboxes_select on public.communications_mailboxes
for select to authenticated
using (public.crm_user_can_access_bd_crm(organization_id));

drop policy if exists communications_mailboxes_insert on public.communications_mailboxes;
create policy communications_mailboxes_insert on public.communications_mailboxes
for insert to authenticated
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists communications_mailboxes_update on public.communications_mailboxes;
create policy communications_mailboxes_update on public.communications_mailboxes
for update to authenticated
using (public.crm_user_can_manage_bd_crm(organization_id))
with check (public.crm_user_can_manage_bd_crm(organization_id));

drop policy if exists communications_threads_select on public.communications_threads;
create policy communications_threads_select on public.communications_threads
for select to authenticated
using (public.crm_user_can_access_communications(organization_id, sensitivity));

drop policy if exists communications_threads_insert on public.communications_threads;
create policy communications_threads_insert on public.communications_threads
for insert to authenticated
with check (public.crm_user_can_manage_communications(organization_id, sensitivity));

drop policy if exists communications_threads_update on public.communications_threads;
create policy communications_threads_update on public.communications_threads
for update to authenticated
using (public.crm_user_can_manage_communications(organization_id, sensitivity))
with check (public.crm_user_can_manage_communications(organization_id, sensitivity));

drop policy if exists communications_messages_select on public.communications_messages;
create policy communications_messages_select on public.communications_messages
for select to authenticated
using (public.crm_user_can_access_communications(organization_id, sensitivity));

drop policy if exists communications_messages_insert on public.communications_messages;
create policy communications_messages_insert on public.communications_messages
for insert to authenticated
with check (public.crm_user_can_manage_communications(organization_id, sensitivity));

drop policy if exists communications_messages_update on public.communications_messages;
create policy communications_messages_update on public.communications_messages
for update to authenticated
using (public.crm_user_can_manage_communications(organization_id, sensitivity))
with check (public.crm_user_can_manage_communications(organization_id, sensitivity));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.patient_leads to authenticated;
grant select, insert, update, delete on public.patient_contact_permissions to authenticated;
grant select, insert, update, delete on public.patient_conditions to authenticated;
grant select, insert, update, delete on public.patient_study_matches to authenticated;
grant select, insert, update, delete on public.patient_followups to authenticated;
grant select, insert, update, delete on public.patient_navigation_notes to authenticated;

grant select, insert, update, delete on public.bd_companies to authenticated;
grant select, insert, update, delete on public.bd_contacts to authenticated;
grant select, insert, update, delete on public.bd_opportunities to authenticated;
grant select, insert, update, delete on public.bd_interactions to authenticated;
grant select, insert, update, delete on public.bd_tasks to authenticated;

grant select, insert, update, delete on public.communications_mailboxes to authenticated;
grant select, insert, update, delete on public.communications_threads to authenticated;
grant select, insert, update, delete on public.communications_messages to authenticated;

grant usage on type public.crm_patient_stage_enum to authenticated;
grant usage on type public.crm_contact_method_enum to authenticated;
grant usage on type public.crm_patient_contact_permission_enum to authenticated;
grant usage on type public.crm_match_status_enum to authenticated;
grant usage on type public.crm_followup_status_enum to authenticated;
grant usage on type public.bd_company_type_enum to authenticated;
grant usage on type public.bd_opportunity_stage_enum to authenticated;
grant usage on type public.bd_interaction_channel_enum to authenticated;
grant usage on type public.bd_task_status_enum to authenticated;
grant usage on type public.communication_sensitivity_enum to authenticated;
grant usage on type public.communication_review_status_enum to authenticated;
grant usage on type public.communication_direction_enum to authenticated;
grant usage on type public.communication_status_enum to authenticated;
grant usage on type public.communication_provider_enum to authenticated;

revoke all on function public.crm_user_has_org_role(uuid, text[]) from public;
revoke all on function public.crm_user_can_access_patient_crm(uuid, uuid) from public;
revoke all on function public.crm_user_can_manage_patient_crm(uuid) from public;
revoke all on function public.crm_user_can_access_bd_crm(uuid) from public;
revoke all on function public.crm_user_can_manage_bd_crm(uuid) from public;
revoke all on function public.crm_user_can_access_communications(uuid, public.communication_sensitivity_enum) from public;
revoke all on function public.crm_user_can_manage_communications(uuid, public.communication_sensitivity_enum) from public;

grant execute on function public.crm_user_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.crm_user_can_access_patient_crm(uuid, uuid) to authenticated;
grant execute on function public.crm_user_can_manage_patient_crm(uuid) to authenticated;
grant execute on function public.crm_user_can_access_bd_crm(uuid) to authenticated;
grant execute on function public.crm_user_can_manage_bd_crm(uuid) to authenticated;
grant execute on function public.crm_user_can_access_communications(uuid, public.communication_sensitivity_enum) to authenticated;
grant execute on function public.crm_user_can_manage_communications(uuid, public.communication_sensitivity_enum) to authenticated;

comment on table public.patient_leads is
  'Patient CRM lead pipeline. PHI-sensitive; access is narrower than business development CRM.';
comment on table public.bd_companies is
  'Business development accounts for sponsors, CROs, labs, biobanks, vendors, physician networks, and community partners.';
comment on table public.communications_threads is
  'Threaded communications shell linking CRM, studies, and subjects without becoming a separate mailbox source of truth.';
