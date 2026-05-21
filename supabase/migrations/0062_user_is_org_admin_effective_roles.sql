-- Honor multi-role memberships for site admin RLS helpers (roles[] + legacy role).

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
      and (
        role in ('owner', 'admin')
        or roles && array['owner', 'admin']::text[]
      )
  );
$$;
