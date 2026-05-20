-- Unblinded site roles for double-blind operational workflows.

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
      'unblinded_coordinator',
      'unblinded_cra',
      'member'
    )
  );
