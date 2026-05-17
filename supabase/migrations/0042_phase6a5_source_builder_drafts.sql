-- Phase 6A.5 — Source Builder draft persistence (org-scoped, non-runtime).
-- Operational drafts only; does not affect published source definitions or capture runtime.

create table if not exists public.source_builder_drafts (
  draft_id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  draft_name text not null,
  study_nickname text,
  description text,
  status text not null default 'draft',
  draft_payload jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint source_builder_drafts_name_nonempty check (
    length(
      trim(
        both
        from
          draft_name
      )
    ) > 0
  ),
  constraint source_builder_drafts_status_allowed check (
    status in ('draft', 'deleted')
  ),
  constraint source_builder_drafts_payload_object check (jsonb_typeof(draft_payload) = 'object')
);

comment on table public.source_builder_drafts is
  'Phase 6A.5: coordinator Source Builder workspace drafts. Flexible JSON payload; not regulatory runtime.';

create index if not exists source_builder_drafts_org_status_updated_idx on public.source_builder_drafts (organization_id, status, updated_at desc);

create table if not exists public.source_builder_draft_events (
  event_id uuid primary key default gen_random_uuid (),
  draft_id uuid not null references public.source_builder_drafts (draft_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_payload jsonb,
  occurred_at timestamptz not null default now (),
  constraint source_builder_draft_events_type_allowed check (
    event_type in (
      'draft_created',
      'draft_saved',
      'draft_deleted',
      'draft_restored'
    )
  )
);

comment on table public.source_builder_draft_events is
  'Append-only audit trail for Source Builder draft lifecycle (create/save/delete).';

create index if not exists source_builder_draft_events_draft_occurred_idx on public.source_builder_draft_events (draft_id, occurred_at desc);

create index if not exists source_builder_draft_events_org_occurred_idx on public.source_builder_draft_events (organization_id, occurred_at desc);

-- Align event.organization_id with parent draft.
create or replace function public.source_builder_draft_events_before_write () returns trigger language plpgsql security invoker
set
  search_path = public as $$
declare
  v_org uuid;
begin
  select
    d.organization_id into v_org
  from
    public.source_builder_drafts d
  where
    d.draft_id = new.draft_id;

  if v_org is null then
    raise exception 'source_builder_draft not found for event';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists source_builder_draft_events_before_write on public.source_builder_draft_events;

create trigger source_builder_draft_events_before_write before insert on public.source_builder_draft_events for each row
execute function public.source_builder_draft_events_before_write ();

-- updated_at maintenance
create or replace function public.source_builder_drafts_set_updated_at () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists source_builder_drafts_set_updated_at on public.source_builder_drafts;

create trigger source_builder_drafts_set_updated_at before
update on public.source_builder_drafts for each row
execute function public.source_builder_drafts_set_updated_at ();

alter table public.source_builder_drafts enable row level security;

alter table public.source_builder_draft_events enable row level security;

-- Drafts: org members may read active drafts; insert/update for members (soft delete via status).
drop policy if exists source_builder_drafts_select on public.source_builder_drafts;

create policy source_builder_drafts_select on public.source_builder_drafts for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );

drop policy if exists source_builder_drafts_insert on public.source_builder_drafts;

create policy source_builder_drafts_insert on public.source_builder_drafts for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );

drop policy if exists source_builder_drafts_update on public.source_builder_drafts;

create policy source_builder_drafts_update on public.source_builder_drafts
for update
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  )
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );

-- Events: read for org members; insert for org members (application writes lifecycle rows).
drop policy if exists source_builder_draft_events_select on public.source_builder_draft_events;

create policy source_builder_draft_events_select on public.source_builder_draft_events for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );

drop policy if exists source_builder_draft_events_insert on public.source_builder_draft_events;

create policy source_builder_draft_events_insert on public.source_builder_draft_events for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );
