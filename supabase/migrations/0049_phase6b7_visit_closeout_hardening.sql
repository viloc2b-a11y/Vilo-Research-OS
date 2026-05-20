-- Phase 6B.7: visit closeout operational traceability (timeline + reopen audit)

create table if not exists public.visit_closeout_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'note_saved',
      'coordinator_signed',
      'coordinator_reopened',
      'investigator_signed',
      'investigator_reopened'
    )
  ),
  actor_user_id uuid references auth.users (id),
  actor_name text,
  event_at timestamptz not null default now(),
  reopen_reason text
);

create index if not exists visit_closeout_events_visit_idx
  on public.visit_closeout_events (visit_id, event_at asc);

create or replace function public.enforce_visit_closeout_event_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select v.organization_id into v_org from public.visits v where v.id = new.visit_id;
  if v_org is null then
    raise exception 'visit not found';
  end if;
  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists visit_closeout_events_enforce_scope on public.visit_closeout_events;
create trigger visit_closeout_events_enforce_scope
before insert or update of visit_id, organization_id on public.visit_closeout_events
for each row execute function public.enforce_visit_closeout_event_scope();

alter table public.visit_closeout_events enable row level security;

drop policy if exists visit_closeout_events_select on public.visit_closeout_events;
create policy visit_closeout_events_select on public.visit_closeout_events
for select using (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_closeout_events.visit_id
      and (
        public.user_is_org_admin(v.organization_id)
        or public.user_has_study_access(v.study_id)
      )
  )
);

drop policy if exists visit_closeout_events_insert on public.visit_closeout_events;
create policy visit_closeout_events_insert on public.visit_closeout_events
for insert with check (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_closeout_events.visit_id
      and public.user_can_manage_subject_enrollment(v.study_id)
  )
);

comment on table public.visit_closeout_events is
  'Operational visit closeout timeline (not a full audit engine).';
