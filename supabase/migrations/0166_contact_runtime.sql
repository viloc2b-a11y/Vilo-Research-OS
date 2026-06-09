-- Phase 17B — Contact Runtime foundation
-- Canonical contact layer for people, organizations, relationships, roles, referrals,
-- and attachments to communications/tasks. Existing CRM surfaces remain as views.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.contact_role_type_enum as enum (
    'patient',
    'candidate',
    'subject',
    'physician',
    'investigator',
    'sponsor_contact',
    'cro_contact',
    'vendor_contact',
    'laboratory_contact',
    'referral_partner',
    'community_partner',
    'employee',
    'coordinator'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function public.contact_runtime_user_can_access(
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

create or replace function public.contact_runtime_user_can_manage(
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

-- ---------------------------------------------------------------------------
-- Core canonical tables
-- ---------------------------------------------------------------------------

create table if not exists public.contact_people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_patient_lead_id uuid references public.patient_leads (id) on delete set null,
  source_bd_contact_id uuid references public.bd_contacts (id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  preferred_name text,
  email text,
  phone text,
  alternate_phone text,
  language text,
  notes text,
  status text not null default 'active',
  owner_user_id uuid references auth.users (id) on delete set null,
  backup_owner_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contact_people_source_patient_lead_uidx
  on public.contact_people (organization_id, source_patient_lead_id)
  where source_patient_lead_id is not null;

create unique index if not exists contact_people_source_bd_contact_uidx
  on public.contact_people (organization_id, source_bd_contact_id)
  where source_bd_contact_id is not null;

create index if not exists contact_people_org_name_idx
  on public.contact_people (organization_id, lower(first_name), lower(last_name));

drop trigger if exists trg_contact_people_updated_at on public.contact_people;
create trigger trg_contact_people_updated_at
  before update on public.contact_people
  for each row execute function public.touch_updated_at();

create table if not exists public.contact_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_bd_company_id uuid references public.bd_companies (id) on delete set null,
  organization_name text not null,
  organization_type public.bd_company_type_enum not null default 'other',
  website text,
  phone text,
  email text,
  address text,
  notes text,
  status text not null default 'active',
  owner_user_id uuid references auth.users (id) on delete set null,
  backup_owner_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contact_organizations_source_bd_company_uidx
  on public.contact_organizations (organization_id, source_bd_company_id)
  where source_bd_company_id is not null;

create index if not exists contact_organizations_org_name_idx
  on public.contact_organizations (organization_id, lower(organization_name));

drop trigger if exists trg_contact_organizations_updated_at on public.contact_organizations;
create trigger trg_contact_organizations_updated_at
  before update on public.contact_organizations
  for each row execute function public.touch_updated_at();

create table if not exists public.contact_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.contact_people (id) on delete cascade,
  contact_organization_id uuid not null references public.contact_organizations (id) on delete cascade,
  relationship_type text not null,
  title text,
  start_date date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contact_relationships_unique_idx
  on public.contact_relationships (organization_id, person_id, contact_organization_id, relationship_type, coalesce(end_date, 'infinity'::date));

drop trigger if exists trg_contact_relationships_updated_at on public.contact_relationships;
create trigger trg_contact_relationships_updated_at
  before update on public.contact_relationships
  for each row execute function public.touch_updated_at();

create table if not exists public.contact_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null references public.contact_people (id) on delete cascade,
  role_type public.contact_role_type_enum not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contact_roles_unique_idx
  on public.contact_roles (organization_id, person_id, role_type)
  where active;

drop trigger if exists trg_contact_roles_updated_at on public.contact_roles;
create trigger trg_contact_roles_updated_at
  before update on public.contact_roles
  for each row execute function public.touch_updated_at();

create table if not exists public.contact_referral_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  referring_person_id uuid references public.contact_people (id) on delete set null,
  referring_organization_id uuid references public.contact_organizations (id) on delete set null,
  receiving_site_id uuid not null references public.organizations (id) on delete cascade,
  active boolean not null default true,
  notes text,
  referrals_generated integer not null default 0,
  enrollments_generated integer not null default 0,
  randomizations_generated integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_contact_referrals_updated_at on public.contact_referral_relationships;
create trigger trg_contact_referrals_updated_at
  before update on public.contact_referral_relationships
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Attach contact IDs to existing runtime tables
-- ---------------------------------------------------------------------------

alter table public.communications_threads
  add column if not exists contact_person_id uuid references public.contact_people (id) on delete set null,
  add column if not exists contact_organization_id uuid references public.contact_organizations (id) on delete set null;

alter table public.patient_followups
  add column if not exists contact_person_id uuid references public.contact_people (id) on delete set null,
  add column if not exists contact_organization_id uuid references public.contact_organizations (id) on delete set null;

alter table public.bd_tasks
  add column if not exists contact_person_id uuid references public.contact_people (id) on delete set null,
  add column if not exists contact_organization_id uuid references public.contact_organizations (id) on delete set null;

create index if not exists communications_threads_contact_person_idx
  on public.communications_threads (contact_person_id, last_message_at desc);

create index if not exists communications_threads_contact_org_idx
  on public.communications_threads (contact_organization_id, last_message_at desc);

create index if not exists patient_followups_contact_person_idx
  on public.patient_followups (contact_person_id, due_at desc)
  where contact_person_id is not null;

create index if not exists bd_tasks_contact_person_idx
  on public.bd_tasks (contact_person_id, due_at desc)
  where contact_person_id is not null;

create index if not exists bd_tasks_contact_org_idx
  on public.bd_tasks (contact_organization_id, due_at desc)
  where contact_organization_id is not null;

-- ---------------------------------------------------------------------------
-- Backfill canonical contact runtime from existing CRM records
-- ---------------------------------------------------------------------------

insert into public.contact_people (
  organization_id,
  source_patient_lead_id,
  first_name,
  last_name,
  preferred_name,
  email,
  phone,
  alternate_phone,
  language,
  notes,
  status,
  owner_user_id,
  backup_owner_user_id
)
select
  pl.organization_id,
  pl.id,
  nullif(split_part(coalesce(pl.full_name, ''), ' ', 1), ''),
  nullif(regexp_replace(coalesce(pl.full_name, ''), '^\S+\s*', ''), ''),
  null,
  pl.email,
  pl.phone,
  null,
  null,
  pl.notes,
  coalesce(pl.stage, 'lead'),
  pl.assigned_user_id,
  null
from public.patient_leads pl
where pl.archived_at is null
on conflict (organization_id, source_patient_lead_id) where source_patient_lead_id is not null
do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  preferred_name = excluded.preferred_name,
  email = excluded.email,
  phone = excluded.phone,
  notes = excluded.notes,
  status = excluded.status,
  owner_user_id = excluded.owner_user_id,
  updated_at = now();

insert into public.contact_roles (organization_id, person_id, role_type, active)
select
  cp.organization_id,
  cp.id,
  'patient'::public.contact_role_type_enum,
  true
from public.contact_people cp
where cp.source_patient_lead_id is not null
on conflict do nothing;

insert into public.contact_roles (organization_id, person_id, role_type, active)
select
  cp.organization_id,
  cp.id,
  'candidate'::public.contact_role_type_enum,
  true
from public.contact_people cp
where cp.source_patient_lead_id is not null
on conflict do nothing;

insert into public.contact_organizations (
  organization_id,
  source_bd_company_id,
  organization_name,
  organization_type,
  website,
  phone,
  email,
  address,
  notes,
  status,
  owner_user_id,
  backup_owner_user_id
)
select
  bc.organization_id,
  bc.id,
  bc.name,
  coalesce(bc.company_type, 'other')::public.bd_company_type_enum,
  bc.website,
  null,
  null,
  null,
  bc.notes,
  coalesce(bc.status, 'active'),
  null,
  null
from public.bd_companies bc
where bc.archived_at is null
on conflict (organization_id, source_bd_company_id) where source_bd_company_id is not null
do update set
  organization_name = excluded.organization_name,
  organization_type = excluded.organization_type,
  website = excluded.website,
  notes = excluded.notes,
  status = excluded.status,
  updated_at = now();

insert into public.contact_people (
  organization_id,
  source_bd_contact_id,
  first_name,
  last_name,
  preferred_name,
  email,
  phone,
  alternate_phone,
  language,
  notes,
  status,
  owner_user_id,
  backup_owner_user_id
)
select
  bc.organization_id,
  bc.id,
  nullif(split_part(coalesce(bc.full_name, ''), ' ', 1), ''),
  nullif(regexp_replace(coalesce(bc.full_name, ''), '^\S+\s*', ''), ''),
  null,
  bc.email,
  bc.phone,
  null,
  null,
  bc.notes,
  coalesce(bc.preferred_contact_method, 'email'),
  null,
  null
from public.bd_contacts bc
on conflict (organization_id, source_bd_contact_id) where source_bd_contact_id is not null
do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  phone = excluded.phone,
  notes = excluded.notes,
  status = excluded.status,
  updated_at = now();

insert into public.contact_relationships (
  organization_id,
  person_id,
  contact_organization_id,
  relationship_type,
  title,
  active
)
select
  bc.organization_id,
  cp.id,
  co.id,
  coalesce(nullif(bc.role_title, ''), co.organization_type::text || ' contact'),
  bc.role_title,
  true
from public.bd_contacts bc
join public.contact_people cp
  on cp.organization_id = bc.organization_id
 and cp.source_bd_contact_id = bc.id
join public.contact_organizations co
  on co.organization_id = bc.organization_id
 and co.source_bd_company_id = bc.company_id
on conflict do nothing;

insert into public.contact_roles (organization_id, person_id, role_type, active)
select
  bc.organization_id,
  cp.id,
  case co.organization_type
    when 'sponsor' then 'sponsor_contact'::public.contact_role_type_enum
    when 'cro' then 'cro_contact'::public.contact_role_type_enum
    when 'lab' then 'laboratory_contact'::public.contact_role_type_enum
    when 'biobank' then 'vendor_contact'::public.contact_role_type_enum
    when 'vendor' then 'vendor_contact'::public.contact_role_type_enum
    when 'physician_network' then 'physician'::public.contact_role_type_enum
    when 'community_partner' then 'community_partner'::public.contact_role_type_enum
    else 'employee'::public.contact_role_type_enum
  end,
  true
from public.bd_contacts bc
join public.contact_people cp
  on cp.organization_id = bc.organization_id
 and cp.source_bd_contact_id = bc.id
join public.contact_organizations co
  on co.organization_id = bc.organization_id
 and co.source_bd_company_id = bc.company_id
on conflict do nothing;

update public.communications_threads ct
set contact_person_id = cp.id
from public.contact_people cp
where ct.contact_person_id is null
  and ct.organization_id = cp.organization_id
  and (
    (ct.patient_lead_id is not null and cp.source_patient_lead_id = ct.patient_lead_id)
    or (ct.bd_contact_id is not null and cp.source_bd_contact_id = ct.bd_contact_id)
  );

update public.communications_threads ct
set contact_organization_id = co.id
from public.contact_organizations co
where ct.contact_organization_id is null
  and ct.organization_id = co.organization_id
  and ct.bd_company_id = co.source_bd_company_id;

update public.patient_followups pf
set contact_person_id = cp.id
from public.contact_people cp
where pf.contact_person_id is null
  and pf.organization_id = cp.organization_id
  and pf.patient_lead_id = cp.source_patient_lead_id;

update public.bd_tasks bt
set contact_person_id = cp.id
from public.contact_people cp
where bt.contact_person_id is null
  and bt.organization_id = cp.organization_id
  and bt.contact_id = cp.source_bd_contact_id;

update public.bd_tasks bt
set contact_organization_id = co.id
from public.contact_organizations co
where bt.contact_organization_id is null
  and bt.organization_id = co.organization_id
  and bt.company_id = co.source_bd_company_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.contact_people enable row level security;
alter table public.contact_organizations enable row level security;
alter table public.contact_relationships enable row level security;
alter table public.contact_roles enable row level security;
alter table public.contact_referral_relationships enable row level security;

drop policy if exists contact_people_select on public.contact_people;
create policy contact_people_select on public.contact_people
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists contact_people_insert on public.contact_people;
create policy contact_people_insert on public.contact_people
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_people_update on public.contact_people;
create policy contact_people_update on public.contact_people
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_people_delete on public.contact_people;
create policy contact_people_delete on public.contact_people
for delete using (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_organizations_select on public.contact_organizations;
create policy contact_organizations_select on public.contact_organizations
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists contact_organizations_insert on public.contact_organizations;
create policy contact_organizations_insert on public.contact_organizations
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_organizations_update on public.contact_organizations;
create policy contact_organizations_update on public.contact_organizations
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_organizations_delete on public.contact_organizations;
create policy contact_organizations_delete on public.contact_organizations
for delete using (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_relationships_select on public.contact_relationships;
create policy contact_relationships_select on public.contact_relationships
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists contact_relationships_insert on public.contact_relationships;
create policy contact_relationships_insert on public.contact_relationships
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_relationships_update on public.contact_relationships;
create policy contact_relationships_update on public.contact_relationships
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_relationships_delete on public.contact_relationships;
create policy contact_relationships_delete on public.contact_relationships
for delete using (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_roles_select on public.contact_roles;
create policy contact_roles_select on public.contact_roles
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists contact_roles_insert on public.contact_roles;
create policy contact_roles_insert on public.contact_roles
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_roles_update on public.contact_roles;
create policy contact_roles_update on public.contact_roles
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_roles_delete on public.contact_roles;
create policy contact_roles_delete on public.contact_roles
for delete using (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_referrals_select on public.contact_referral_relationships;
create policy contact_referrals_select on public.contact_referral_relationships
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists contact_referrals_insert on public.contact_referral_relationships;
create policy contact_referrals_insert on public.contact_referral_relationships
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_referrals_update on public.contact_referral_relationships;
create policy contact_referrals_update on public.contact_referral_relationships
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists contact_referrals_delete on public.contact_referral_relationships;
create policy contact_referrals_delete on public.contact_referral_relationships
for delete using (public.contact_runtime_user_can_manage(organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.contact_people to authenticated;
grant select, insert, update, delete on public.contact_organizations to authenticated;
grant select, insert, update, delete on public.contact_relationships to authenticated;
grant select, insert, update, delete on public.contact_roles to authenticated;
grant select, insert, update, delete on public.contact_referral_relationships to authenticated;
