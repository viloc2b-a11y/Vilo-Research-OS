-- Multi-role site memberships: roles[] alongside legacy role column.
-- Effective permissions = union of all roles; role column remains primary for RLS helpers.

alter table public.organization_members
  add column if not exists roles text[] not null default '{}';

comment on column public.organization_members.roles is
  'All site roles for this member. Union with legacy role column for effective permissions.';

-- Backfill from legacy single role where roles is empty.
update public.organization_members
set roles = array[role]::text[]
where roles = '{}'::text[] or roles is null;

alter table public.organization_members
  alter column roles set default '{}',
  alter column roles set not null;

-- Each element of roles must be a valid stored organization role.
alter table public.organization_members
  drop constraint if exists organization_members_roles_check;

alter table public.organization_members
  add constraint organization_members_roles_check
  check (
    roles <@ array[
      'owner',
      'admin',
      'site_staff',
      'research_coordinator',
      'data_coordinator',
      'pi_sub_i',
      'read_only',
      'unblinded_coordinator',
      'unblinded_cra',
      'member'
    ]::text[]
  );

-- Keep roles in sync when only legacy role is written (INSERT/UPDATE of role).
create or replace function public.sync_organization_member_roles_from_role()
returns trigger
language plpgsql
as $$
begin
  if new.roles is null or new.roles = '{}'::text[] then
    new.roles := array[new.role]::text[];
  elsif new.role is not null
    and not (new.role = any (new.roles)) then
    new.roles := array_prepend(new.role, new.roles);
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_sync_roles_from_role on public.organization_members;

create trigger organization_members_sync_roles_from_role
  before insert or update of role on public.organization_members
  for each row
  execute function public.sync_organization_member_roles_from_role();
