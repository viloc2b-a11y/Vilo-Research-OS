-- Blinded data/eSource coordination role (no admin, no unblinded by default).
-- Adds optional multi-role support via organization_members.roles while preserving
-- the legacy role column used by existing RLS/display flows.

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add column if not exists roles text[];

alter table public.organization_members
  add constraint organization_members_role_check
  check (
    role in (
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
    )
  );

alter table public.organization_members
  drop constraint if exists organization_members_roles_check;

alter table public.organization_members
  add constraint organization_members_roles_check
  check (
    roles is null
    or roles <@ array[
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

comment on column public.organization_members.role is
  'Legacy primary site role used by existing RLS/display flows. Effective app permissions merge this value with roles[].';

comment on column public.organization_members.roles is
  'Optional multi-role site assignments. Effective app permissions are the union of role and roles[].';
