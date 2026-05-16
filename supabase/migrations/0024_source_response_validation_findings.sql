-- Phase 4B: source_response_validation_findings — edit-check / DQ findings (distinct from corrections).
-- Dependencies: 0020 source_response_sets, 0021 source_responses.

create table if not exists public.source_response_validation_findings (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  response_set_id uuid not null references public.source_response_sets (id) on delete cascade,
  response_id uuid references public.source_responses (id) on delete set null,
  finding_type text not null check (
    finding_type in ('range', 'required', 'consistency', 'format', 'custom')
  ),
  severity text not null check (severity in ('info', 'warning', 'error')),
  rule_code text not null,
  message text not null,
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved', 'waived')
  ),
  created_at timestamptz not null default now(),
  resolved_by_user_id uuid references auth.users (id),
  resolved_at timestamptz,
  resolution_reason text,
  constraint source_response_validation_findings_message_nonempty check (
    length(
      trim(
        both
        from
          message
      )
    ) > 0
  ),
  constraint source_response_validation_findings_rule_code_nonempty check (
    length(
      trim(
        both
        from
          rule_code
      )
    ) > 0
  ),
  constraint source_response_validation_findings_resolution check (
    status in ('open', 'acknowledged')
    or (
      resolved_by_user_id is not null
      and resolved_at is not null
      and resolution_reason is not null
      and length(
        trim(
          both
          from
            resolution_reason
        )
      ) > 0
    )
  )
);

comment on table public.source_response_validation_findings is
  'Validation/DQ findings; resolving does not silently mutate source_responses — corrections or waivers with reason.';

create index if not exists source_response_validation_findings_open_idx on public.source_response_validation_findings (response_set_id, status)
where
  status = 'open';

create index if not exists source_response_validation_findings_set_idx on public.source_response_validation_findings (response_set_id);

create index if not exists source_response_validation_findings_response_idx on public.source_response_validation_findings (response_id)
where
  response_id is not null;

create or replace function public.phase4b_enforce_validation_finding () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_org uuid;
  v_set_field uuid;
begin
  select
    srs.organization_id into v_org
  from
    public.source_response_sets srs
  where
    srs.id = new.response_set_id;

  if v_org is null then
    raise exception 'response_set_id % not found', new.response_set_id;
  end if;

  new.organization_id := v_org;

  if new.response_id is not null then
    select
      sr.response_set_id into v_set_field
    from
      public.source_responses sr
    where
      sr.id = new.response_id;

    if v_set_field is null then
      raise exception 'response_id % not found', new.response_id;
    end if;

    if v_set_field is distinct from new.response_set_id then
      raise exception 'response_id must belong to response_set_id';
    end if;
  end if;

  if tg_op = 'UPDATE'
  and new.status in ('resolved', 'waived')
  and (
    new.resolved_by_user_id is null
    or new.resolved_at is null
    or new.resolution_reason is null
  ) then
    raise exception 'resolved/waived findings require resolver attribution and resolution_reason';
  end if;

  return new;
end;
$$;

drop trigger if exists source_response_validation_findings_enforce on public.source_response_validation_findings;

create trigger source_response_validation_findings_enforce before insert
or
update on public.source_response_validation_findings for each row
execute function public.phase4b_enforce_validation_finding ();

alter table public.source_response_validation_findings enable row level security;

drop policy if exists source_response_validation_findings_select on public.source_response_validation_findings;

create policy source_response_validation_findings_select on public.source_response_validation_findings for
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
            public.source_response_sets srs
          where
            srs.id = response_set_id
        )
      )
    )
  );

drop policy if exists source_response_validation_findings_insert on public.source_response_validation_findings;

create policy source_response_validation_findings_insert on public.source_response_validation_findings for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          srs.study_id
        from
          public.source_response_sets srs
        where
          srs.id = response_set_id
      )
    )
  );

drop policy if exists source_response_validation_findings_update on public.source_response_validation_findings;

create policy source_response_validation_findings_update on public.source_response_validation_findings for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_manage_subject_enrollment (
    (
      select
        srs.study_id
      from
        public.source_response_sets srs
      where
        srs.id = response_set_id
    )
  )
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
  );
