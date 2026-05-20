-- Expand organization_members.role for site-level RBAC foundation.
-- Keeps legacy `member` for existing rows; application normalizes member -> research_coordinator.

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (
    role in (
      'owner',
      'admin',
      'site_staff',
      'research_coordinator',
      'pi_sub_i',
      'read_only',
      'member'
    )
  );

comment on column public.organization_members.role is
  'Site-level role: owner | admin | site_staff | research_coordinator | pi_sub_i | read_only. Legacy member allowed until migrated.';
