-- Vilo OS: organizations RLS update policy, updated_at trigger, status constraint

-- Allow org admins/owners to update their own organization row
create policy organizations_update_admin
on public.organizations
for update
using (public.user_is_org_admin(id))
with check (public.user_is_org_admin(id));

-- Server-side updated_at (replaces app-layer new Date().toISOString())
create or replace function public.set_organizations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_organizations_updated_at();

-- Status constraint
alter table public.organizations
  add constraint organizations_status_check
  check (status in ('active', 'inactive', 'suspended'));
