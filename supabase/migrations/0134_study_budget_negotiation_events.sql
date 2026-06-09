-- Phase 8.5: Study budget negotiation ledger
-- Append-only negotiation history for sponsor offers, counteroffers, and term decisions.

create table if not exists public.study_budget_negotiation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  protocol_version_id uuid null references public.protocol_runtime_versions (id) on delete set null,
  study_subject_id uuid null references public.study_subjects (id) on delete set null,
  visit_id uuid null references public.visits (id) on delete set null,
  procedure_id uuid null references public.procedure_library (id) on delete set null,
  source_document_id uuid null references public.document_intelligence_documents (id) on delete set null,
  source_chunk_id uuid null references public.document_intelligence_chunks (id) on delete set null,
  event_type text not null,
  title text not null,
  summary text not null,
  reason text null,
  recommended_next_step text null,
  owner_role text not null default 'coordinator',
  negotiation_round integer not null default 1,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_payload jsonb not null default '{}'::jsonb,
  state_hash text not null,
  created_at timestamptz not null default now(),
  constraint study_budget_negotiation_events_type_check check (
    event_type in (
      'sponsor_offer_received',
      'counteroffer_drafted',
      'counteroffer_sent',
      'sponsor_reply_received',
      'term_accepted',
      'term_rejected',
      'term_adjusted',
      'evidence_linked'
    )
  ),
  constraint study_budget_negotiation_events_round_check check (negotiation_round >= 1),
  constraint study_budget_negotiation_events_owner_role_check check (length(owner_role) > 0),
  constraint study_budget_negotiation_events_title_check check (length(title) > 0),
  constraint study_budget_negotiation_events_summary_check check (length(summary) > 0),
  constraint study_budget_negotiation_events_state_hash_check check (length(state_hash) > 0)
);

create index if not exists study_budget_negotiation_events_org_idx
  on public.study_budget_negotiation_events (organization_id);
create index if not exists study_budget_negotiation_events_study_idx
  on public.study_budget_negotiation_events (study_id);
create index if not exists study_budget_negotiation_events_protocol_version_idx
  on public.study_budget_negotiation_events (protocol_version_id);
create index if not exists study_budget_negotiation_events_subject_idx
  on public.study_budget_negotiation_events (study_subject_id);
create index if not exists study_budget_negotiation_events_visit_idx
  on public.study_budget_negotiation_events (visit_id);
create index if not exists study_budget_negotiation_events_procedure_idx
  on public.study_budget_negotiation_events (procedure_id);
create index if not exists study_budget_negotiation_events_type_idx
  on public.study_budget_negotiation_events (event_type);
create index if not exists study_budget_negotiation_events_created_at_idx
  on public.study_budget_negotiation_events (created_at desc);
create index if not exists study_budget_negotiation_events_round_idx
  on public.study_budget_negotiation_events (study_id, negotiation_round desc, created_at desc);

create or replace function public.enforce_study_budget_negotiation_event_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  study_org uuid;
begin
  select s.organization_id into study_org
  from public.studies s
  where s.id = new.study_id;

  if study_org is null then
    raise exception 'study not found for study_id %', new.study_id;
  end if;

  if new.organization_id is distinct from study_org then
    new.organization_id := study_org;
  end if;

  return new;
end;
$$;

drop trigger if exists study_budget_negotiation_events_enforce_org on public.study_budget_negotiation_events;
create trigger study_budget_negotiation_events_enforce_org
before insert or update of organization_id, study_id
on public.study_budget_negotiation_events
for each row execute function public.enforce_study_budget_negotiation_event_org();

alter table public.study_budget_negotiation_events enable row level security;

drop policy if exists study_budget_negotiation_events_select on public.study_budget_negotiation_events;
create policy study_budget_negotiation_events_select on public.study_budget_negotiation_events
for select using (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

drop policy if exists study_budget_negotiation_events_insert on public.study_budget_negotiation_events;
create policy study_budget_negotiation_events_insert on public.study_budget_negotiation_events
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_has_study_access(study_id)
);

comment on table public.study_budget_negotiation_events is
  'Append-only budget negotiation history for sponsor offers, counteroffers, and term decisions. Financial Runtime remains the truth for revenue.';
