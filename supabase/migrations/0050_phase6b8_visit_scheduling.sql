-- Phase 6B.8: subject visit scheduling, protocol windows, reminders, operational calendar

-- Protocol window offsets relative to target visit day (e.g. Day 4 with -1/+2)
alter table public.visit_definitions
  add column if not exists window_min_offset integer not null default -1,
  add column if not exists window_max_offset integer not null default 2;

comment on column public.visit_definitions.window_min_offset is
  'Days before target_date that scheduling is allowed (negative = earlier).';
comment on column public.visit_definitions.window_max_offset is
  'Days after target_date that scheduling is allowed (positive = later).';

-- Schedule anchor for auto-generated visit matrix (Day 1 = anchor)
alter table public.study_subjects
  add column if not exists schedule_anchor_date date,
  add column if not exists visit_schedule_generated_at timestamptz;

comment on column public.study_subjects.schedule_anchor_date is
  'Protocol Day 1 anchor for generated subject visit schedule.';
comment on column public.study_subjects.visit_schedule_generated_at is
  'When the coordinator visit schedule was auto-generated (idempotency marker).';

alter table public.visits
  add column if not exists target_date date,
  add column if not exists window_status text not null default 'inside_window',
  add column if not exists confirmation_status text not null default 'pending',
  add column if not exists out_of_window_reason text,
  add column if not exists out_of_window_override_at timestamptz,
  add column if not exists out_of_window_override_by uuid references auth.users (id),
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_by uuid references auth.users (id),
  add column if not exists sms_reminder_sent_at timestamptz,
  add column if not exists phone_reminder_logged_at timestamptz;

-- Allow unscheduled visits until coordinator picks a date (generated rows default to target_date)
alter table public.visits alter column scheduled_date drop not null;

alter table public.visits drop constraint if exists visits_window_status_check;
alter table public.visits add constraint visits_window_status_check check (
  window_status in ('inside_window', 'warning', 'outside_window')
);

alter table public.visits drop constraint if exists visits_confirmation_status_check;
alter table public.visits add constraint visits_confirmation_status_check check (
  confirmation_status in ('pending', 'confirmed', 'reminder_sent')
);

alter table public.visits drop constraint if exists visits_visit_status_check;
alter table public.visits add constraint visits_visit_status_check check (
  visit_status in (
    'scheduled',
    'confirmed',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'missed',
    'out_of_window',
    'locked'
  )
);

-- Backfill target_date from scheduled_date where missing
update public.visits
set target_date = coalesce(target_date, scheduled_date, window_start, current_date)
where target_date is null;

update public.visits
set window_start = coalesce(window_start, target_date),
    window_end = coalesce(window_end, target_date)
where window_start is null or window_end is null;

update public.visits
set scheduled_date = coalesce(scheduled_date, target_date)
where scheduled_date is null and target_date is not null;

create index if not exists visits_subject_target_date_idx
  on public.visits (study_subject_id, target_date);

create index if not exists visits_org_scheduled_status_idx
  on public.visits (organization_id, scheduled_date, visit_status);

-- Lightweight reminder audit (no Twilio orchestration)
create table if not exists public.visit_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('sms', 'phone')),
  sent_by uuid references auth.users (id),
  sent_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists visit_reminders_visit_id_idx on public.visit_reminders (visit_id);
create index if not exists visit_reminders_org_sent_at_idx on public.visit_reminders (organization_id, sent_at desc);

create or replace function public.enforce_visit_reminder_org_consistency()
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

drop trigger if exists visit_reminders_enforce_org on public.visit_reminders;
create trigger visit_reminders_enforce_org
before insert or update of visit_id, organization_id on public.visit_reminders
for each row execute function public.enforce_visit_reminder_org_consistency();

alter table public.visit_reminders enable row level security;

drop policy if exists visit_reminders_select on public.visit_reminders;
create policy visit_reminders_select on public.visit_reminders
for select using (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_reminders.visit_id
      and (
        public.user_is_org_admin(v.organization_id)
        or public.user_has_study_access(v.study_id)
      )
  )
);

drop policy if exists visit_reminders_insert on public.visit_reminders;
create policy visit_reminders_insert on public.visit_reminders
for insert with check (
  organization_id in (select public.user_organization_ids())
  and exists (
    select 1 from public.visits v
    where v.id = visit_reminders.visit_id
      and public.user_can_manage_subject_enrollment(v.study_id)
  )
);
