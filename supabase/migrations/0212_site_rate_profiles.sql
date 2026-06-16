create table site_rate_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_name text not null default 'Default',
  pi_hourly_salary numeric(10,2) not null,
  crc_hourly_salary numeric(10,2) not null,
  rn_hourly_salary numeric(10,2) not null,
  benefits_pct numeric(5,2) not null,
  overhead_pct numeric(5,2) not null,
  margin_pct numeric(5,2) not null,
  billable_time_pct numeric(5,2) not null,
  inflation_pct numeric(5,2) not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index site_rate_profiles_org_default_idx
  on site_rate_profiles (organization_id) where is_default = true;

alter table site_rate_profiles enable row level security;

create policy "org_members_select_rate_profiles"
  on site_rate_profiles for select
  using (
    organization_id in (
      select organization_id from organization_memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "org_financial_roles_manage_rate_profiles"
  on site_rate_profiles for all
  using (
    organization_id in (
      select organization_id from organization_memberships
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'finance', 'site_director')
        and status = 'active'
    )
  );
