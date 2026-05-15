-- Vilo OS: audit foundation (Verdent modules/audit-log)
-- Requires 0001_auth_foundation.sql. Prepared only — apply when approved.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  actor_user_id uuid references auth.users (id),
  action text not null,
  target text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx on public.audit_events (organization_id, created_at desc);

alter table public.audit_events enable row level security;

create policy audit_events_select_admin on public.audit_events
for select using (
  organization_id is not null
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = audit_events.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

-- Inserts via service role or SECURITY DEFINER RPC only (see lib/audit/log.ts)
