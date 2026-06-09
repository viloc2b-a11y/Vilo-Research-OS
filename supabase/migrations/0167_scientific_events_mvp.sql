-- Phase 17C — Scientific Events MVP

do $$ begin
  create type public.scientific_event_status_enum as enum (
    'draft',
    'scheduled',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.scientific_event_type_enum as enum (
    'scientific_webinar',
    'physician_education',
    'patient_education',
    'sponsor_meeting',
    'cro_meeting',
    'community_outreach',
    'recruitment_event',
    'internal_event'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.scientific_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text unique,
  title text not null,
  subtitle text,
  description text,
  event_type public.scientific_event_type_enum not null,
  event_date date not null,
  event_time time without time zone,
  timezone text,
  location text,
  virtual_link text,
  stream_provider text,
  stream_embed_url text,
  replay_embed_url text,
  hero_image_url text,
  sponsor_organization_id uuid references public.contact_organizations (id) on delete set null,
  publisher_organization_id uuid references public.contact_organizations (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  status public.scientific_event_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_scientific_events_updated_at on public.scientific_events;
create trigger trg_scientific_events_updated_at
  before update on public.scientific_events
  for each row execute function public.touch_updated_at();

do $$ begin
  create type public.event_registration_status_enum as enum (
    'invited',
    'registered',
    'declined',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_attendance_status_enum as enum (
    'attended',
    'no_show',
    'pending'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.scientific_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scientific_events (id) on delete cascade,
  contact_person_id uuid references public.contact_people (id) on delete set null,
  contact_organization_id uuid references public.contact_organizations (id) on delete set null,
  role text,
  registration_status public.event_registration_status_enum not null default 'invited',
  attendance_status public.event_attendance_status_enum not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_participant_target check (
    (contact_person_id is not null and contact_organization_id is null) or
    (contact_person_id is null and contact_organization_id is not null)
  )
);

-- Ensure a person or org is only added once per event
create unique index if not exists scientific_event_participants_person_idx on public.scientific_event_participants (event_id, contact_person_id) where contact_person_id is not null;
create unique index if not exists scientific_event_participants_org_idx on public.scientific_event_participants (event_id, contact_organization_id) where contact_organization_id is not null;

drop trigger if exists trg_scientific_event_participants_updated_at on public.scientific_event_participants;
create trigger trg_scientific_event_participants_updated_at
  before update on public.scientific_event_participants
  for each row execute function public.touch_updated_at();

-- RLS

alter table public.scientific_events enable row level security;
alter table public.scientific_event_participants enable row level security;

-- Events Policies
drop policy if exists scientific_events_select on public.scientific_events;
create policy scientific_events_select on public.scientific_events
for select using (public.contact_runtime_user_can_access(organization_id));

drop policy if exists scientific_events_insert on public.scientific_events;
create policy scientific_events_insert on public.scientific_events
for insert with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists scientific_events_update on public.scientific_events;
create policy scientific_events_update on public.scientific_events
for update using (public.contact_runtime_user_can_manage(organization_id))
with check (public.contact_runtime_user_can_manage(organization_id));

drop policy if exists scientific_events_delete on public.scientific_events;
create policy scientific_events_delete on public.scientific_events
for delete using (public.contact_runtime_user_can_manage(organization_id));

-- Participants Policies
-- Participants inherit organization access implicitly from the event they belong to.
-- Since the schema doesn't have organization_id on participants, we join or rely on RLS through event_id.
-- Let's add organization_id to participants for simpler RLS, or join the events table.
-- Given Supabase's preference for simple RLS, adding organization_id to child tables is often best. Let's alter the table to add it if it's easier, or just use a join.

-- Alternatively, join with scientific_events for RLS:
drop policy if exists scientific_event_participants_select on public.scientific_event_participants;
create policy scientific_event_participants_select on public.scientific_event_participants
for select using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_participants.event_id 
    and public.contact_runtime_user_can_access(e.organization_id)
  )
);

drop policy if exists scientific_event_participants_insert on public.scientific_event_participants;
create policy scientific_event_participants_insert on public.scientific_event_participants
for insert with check (
  exists (
    select 1 from public.scientific_events e 
    where e.id = event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

drop policy if exists scientific_event_participants_update on public.scientific_event_participants;
create policy scientific_event_participants_update on public.scientific_event_participants
for update using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_participants.event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
)
with check (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_participants.event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

drop policy if exists scientific_event_participants_delete on public.scientific_event_participants;
create policy scientific_event_participants_delete on public.scientific_event_participants
for delete using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_participants.event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

-- Questions
create table if not exists public.scientific_event_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scientific_events (id) on delete cascade,
  participant_id uuid not null references public.scientific_event_participants (id) on delete cascade,
  question_text text not null,
  answered boolean not null default false,
  answered_at timestamptz,
  submitted_at timestamptz not null default now()
);

-- Attendance Sessions (Watch time tracking)
create table if not exists public.scientific_event_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scientific_events (id) on delete cascade,
  participant_id uuid not null references public.scientific_event_participants (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  total_seconds integer not null default 0,
  is_replay boolean not null default false
);

alter table public.scientific_event_questions enable row level security;
alter table public.scientific_event_attendance_sessions enable row level security;

-- Policies for Questions and Sessions (inherited via event)
drop policy if exists scientific_event_questions_select on public.scientific_event_questions;
create policy scientific_event_questions_select on public.scientific_event_questions
for select using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_questions.event_id 
    and public.contact_runtime_user_can_access(e.organization_id)
  )
);

drop policy if exists scientific_event_questions_insert on public.scientific_event_questions;
create policy scientific_event_questions_insert on public.scientific_event_questions
for insert with check (
  exists (
    select 1 from public.scientific_events e 
    where e.id = event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

drop policy if exists scientific_event_questions_update on public.scientific_event_questions;
create policy scientific_event_questions_update on public.scientific_event_questions
for update using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_questions.event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

drop policy if exists scientific_event_sessions_select on public.scientific_event_attendance_sessions;
create policy scientific_event_sessions_select on public.scientific_event_attendance_sessions
for select using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_attendance_sessions.event_id 
    and public.contact_runtime_user_can_access(e.organization_id)
  )
);

drop policy if exists scientific_event_sessions_insert on public.scientific_event_attendance_sessions;
create policy scientific_event_sessions_insert on public.scientific_event_attendance_sessions
for insert with check (
  exists (
    select 1 from public.scientific_events e 
    where e.id = event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

drop policy if exists scientific_event_sessions_update on public.scientific_event_attendance_sessions;
create policy scientific_event_sessions_update on public.scientific_event_attendance_sessions
for update using (
  exists (
    select 1 from public.scientific_events e 
    where e.id = scientific_event_attendance_sessions.event_id 
    and public.contact_runtime_user_can_manage(e.organization_id)
  )
);

-- Grants
grant select, insert, update, delete on public.scientific_events to authenticated;
grant select, insert, update, delete on public.scientific_event_participants to authenticated;
grant select, insert, update, delete on public.scientific_event_questions to authenticated;
grant select, insert, update, delete on public.scientific_event_attendance_sessions to authenticated;
