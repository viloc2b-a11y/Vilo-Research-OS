-- Allow site admins to update organization_members (roles, legacy role) within their org.

alter table public.organization_members
  add column if not exists updated_at timestamptz not null default now();

comment on column public.organization_members.updated_at is
  'Last membership row update (roles or legacy role).';

create or replace function public.touch_organization_member_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organization_members_touch_updated_at on public.organization_members;

create trigger organization_members_touch_updated_at
  before update on public.organization_members
  for each row
  execute function public.touch_organization_member_updated_at();

drop policy if exists organization_members_update_admin on public.organization_members;

create policy organization_members_update_admin on public.organization_members
for update
using (public.user_is_org_admin(organization_id))
with check (public.user_is_org_admin(organization_id));
