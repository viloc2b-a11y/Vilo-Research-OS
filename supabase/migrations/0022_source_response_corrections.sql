-- Phase 4B: source_response_corrections — append-only correction metadata (facts live in source_responses).
-- Dependencies: 0021 source_responses, 0010 operational_events, 0002 audit_events.

create table if not exists public.source_response_corrections (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  response_id uuid not null references public.source_responses (id) on delete restrict,
  superseded_response_id uuid not null references public.source_responses (id) on delete restrict,
  correction_type text not null check (
    correction_type in (
      'data_entry_error',
      'transcription_error',
      'new_information',
      'query_resolution',
      'other'
    )
  ),
  correction_reason text not null,
  prior_value_reference text not null,
  corrected_by_user_id uuid not null references auth.users (id),
  corrected_at timestamptz not null default now(),
  operational_event_id uuid references public.operational_events (id) on delete set null,
  audit_event_id uuid references public.audit_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint source_response_corrections_reason_nonempty check (
    length(
      trim(
        both
        from
          correction_reason
      )
    ) > 0
  ),
  constraint source_response_corrections_prior_ref_nonempty check (
    length(
      trim(
        both
        from
          prior_value_reference
      )
    ) > 0
  ),
  constraint source_response_corrections_other_requires_detail check (
    correction_type <> 'other'
    or length(
      trim(
        both
        from
          correction_reason
      )
    ) >= 10
  ),
  constraint source_response_corrections_distinct_responses check (response_id <> superseded_response_id),
  unique (response_id)
);

comment on table public.source_response_corrections is
  'Append-only correction lineage. INSERT only for app roles; links superseded and replacement response rows.';

create index if not exists source_response_corrections_superseded_idx on public.source_response_corrections (superseded_response_id);

create index if not exists source_response_corrections_org_created_idx on public.source_response_corrections (organization_id, created_at desc);

create or replace function public.phase4b_enforce_source_response_correction () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_new record;
  v_old record;
begin
  select
    sr.organization_id,
    sr.response_set_id,
    sr.source_field_id,
    sr.is_submitted into v_new
  from
    public.source_responses sr
  where
    sr.id = new.response_id;

  if v_new.organization_id is null then
    raise exception 'response_id % not found', new.response_id;
  end if;

  select
    sr.organization_id,
    sr.response_set_id,
    sr.source_field_id,
    sr.is_submitted into v_old
  from
    public.source_responses sr
  where
    sr.id = new.superseded_response_id;

  if v_old.organization_id is null then
    raise exception 'superseded_response_id % not found', new.superseded_response_id;
  end if;

  if v_new.organization_id is distinct from v_old.organization_id then
    raise exception 'correction responses must share organization';
  end if;

  if v_new.response_set_id is distinct from v_old.response_set_id
  or v_new.source_field_id is distinct from v_old.source_field_id then
    raise exception 'correction must target same response_set and source_field';
  end if;

  if not v_old.is_submitted then
    raise exception 'only submitted values may be corrected via this path';
  end if;

  new.organization_id := v_new.organization_id;
  new.corrected_by_user_id := coalesce(new.corrected_by_user_id, auth.uid());
  new.corrected_at := coalesce(new.corrected_at, now());

  if new.operational_event_id is null
  and new.audit_event_id is null then
    raise exception 'correction requires operational_event_id and/or audit_event_id reference';
  end if;

  return new;
end;
$$;

drop trigger if exists source_response_corrections_enforce on public.source_response_corrections;

create trigger source_response_corrections_enforce before insert on public.source_response_corrections for each row
execute function public.phase4b_enforce_source_response_correction ();

alter table public.source_response_corrections enable row level security;

drop policy if exists source_response_corrections_select on public.source_response_corrections;

create policy source_response_corrections_select on public.source_response_corrections for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (
          select
            srs.study_id
          from
            public.source_responses sr
            join public.source_response_sets srs on srs.id = sr.response_set_id
          where
            sr.id = response_id
        )
      )
    )
  );

drop policy if exists source_response_corrections_insert on public.source_response_corrections;

create policy source_response_corrections_insert on public.source_response_corrections for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.phase4b_user_can_correct_source (
      (
        select
          srs.study_id
        from
          public.source_responses sr
          join public.source_response_sets srs on srs.id = sr.response_set_id
        where
          sr.id = response_id
      )
    )
  );

-- No UPDATE or DELETE policies (append-only).
