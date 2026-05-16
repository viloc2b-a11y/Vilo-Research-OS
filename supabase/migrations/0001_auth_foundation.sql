-- Vilo OS: auth foundation (Verdent modules/auth — organization_id tenancy)
-- Idempotent: safe to re-run after partial applies.
--
-- RLS helpers avoid infinite recursion: policies must NOT SELECT organization_members
-- under the same table's RLS. Use SECURITY DEFINER functions to read membership with
-- bypass (controlled) per Supabase / Postgres best practice.

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

-- Membership helpers (SECURITY DEFINER: bypass RLS only inside these functions)
create or replace function public.user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

create or replace function public.user_is_org_admin(_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = _organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.user_organization_ids() from public;
revoke all on function public.user_is_org_admin(uuid) from public;
grant execute on function public.user_organization_ids() to authenticated, anon;
grant execute on function public.user_is_org_admin(uuid) to authenticated, anon;

-- Policies (drop + recreate)
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
on public.organizations
for select
using (id in (select public.user_organization_ids()));

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert with check (id = auth.uid());

drop policy if exists organization_members_select_same_org on public.organization_members;
create policy organization_members_select_same_org on public.organization_members
for select
using (organization_id in (select public.user_organization_ids()));

drop policy if exists organization_members_insert_admin on public.organization_members;
create policy organization_members_insert_admin on public.organization_members
for insert with check (public.user_is_org_admin(organization_id));
