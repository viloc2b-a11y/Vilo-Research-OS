-- Vilo OS: auth foundation (Verdent modules/auth — organization_id tenancy)
-- Prepared only. Apply manually when approved.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'read_only')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx on public.organization_members (user_id);
create index if not exists organization_members_org_id_idx on public.organization_members (organization_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_select_member
on public.organizations
for select
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

create policy profiles_select_self on public.profiles
for select using (id = auth.uid());

create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_self on public.profiles
for insert with check (id = auth.uid());

create policy organization_members_select_same_org on public.organization_members
for select using (
  exists (
    select 1 from public.organization_members me
    where me.organization_id = organization_members.organization_id
      and me.user_id = auth.uid()
  )
);

create policy organization_members_insert_admin on public.organization_members
for insert with check (
  exists (
    select 1 from public.organization_members me
    where me.organization_id = organization_members.organization_id
      and me.user_id = auth.uid()
      and me.role in ('owner', 'admin')
  )
);
