-- Phase 4B: source_response_sets — runtime capture container per procedure execution + instrument version.
-- Dependencies: 0008 visits, 0009 procedure_executions, 0015 source_definition_versions, 0018 procedure_executions.source_definition_version_id.
-- No capture RPCs in this migration (Phase 4B.1). Phase 3C RPC bodies unchanged.

-- ---------------------------------------------------------------------------
-- Shared helpers (SECURITY INVOKER) used by RLS in 0020–0024
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_visit_is_locked (_visit_id uuid) returns boolean language sql stable security invoker
set
  search_path = public as $$
select
  exists (
    select
      1
    from
      public.visits v
    where
      v.id = _visit_id
      and v.visit_status = 'locked'
  );
$$;

create or replace function public.phase4b_user_can_correct_source (_study_id uuid) returns boolean language sql stable security definer
set
  search_path = public as $$
select
  public.user_is_org_admin (
    (
      select
        s.organization_id
      from
        public.studies s
      where
        s.id = _study_id
    )
  )
  or exists (
    select
      1
    from
      public.study_members sm
    where
      sm.study_id = _study_id
      and sm.user_id = auth.uid ()
      and sm.role in ('study_admin', 'coordinator')
  );
$$;

comment on function public.phase4b_visit_is_locked (uuid) is 'True when visit_status is locked (Phase 3C). Blocks draft capture via RLS; correction/addendum paths use dedicated policies.';

comment on function public.phase4b_user_can_correct_source (uuid) is 'Roles permitted to append corrections/addenda (Phase 4B.1 RPCs will enforce reason/provenance).';

revoke all on function public.phase4b_visit_is_locked (uuid) from public;

grant execute on function public.phase4b_visit_is_locked (uuid) to authenticated;

revoke all on function public.phase4b_user_can_correct_source (uuid) from public;

grant execute on function public.phase4b_user_can_correct_source (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- source_response_sets
-- ---------------------------------------------------------------------------

create table if not exists public.source_response_sets (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete restrict,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  procedure_execution_id uuid not null references public.procedure_executions (id) on delete cascade,
  source_definition_version_id uuid not null references public.source_definition_versions (id) on delete restrict,
  status text not null default 'draft' check (
    status in (
      'draft',
      'in_progress',
      'submitted',
      'pending_review',
      'reviewed',
      'signed',
      'locked',
      'corrected',
      'addended',
      'archived'
    )
  ),
  source_origin text not null default 'manual' check (
    source_origin in ('manual', 'imported', 'device', 'system')
  ),
  opened_by_user_id uuid not null references auth.users (id),
  opened_at timestamptz not null default now(),
  submitted_by_user_id uuid references auth.users (id),
  submitted_at timestamptz,
  reviewed_by_user_id uuid references auth.users (id),
  reviewed_at timestamptz,
  signed_by_user_id uuid references auth.users (id),
  signed_at timestamptz,
  locked_by_user_id uuid references auth.users (id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now (),
  constraint source_response_sets_review_before_sign check (
    signed_at is null
    or reviewed_at is null
    or reviewed_at <= signed_at
  ),
  constraint source_response_sets_submitted_attribution check (
    (
      status not in ('submitted', 'pending_review', 'reviewed', 'signed', 'locked', 'corrected', 'addended')
    )
    or (
      submitted_by_user_id is not null
      and submitted_at is not null
    )
  ),
  constraint source_response_sets_reviewed_attribution check (
    (status not in ('reviewed', 'signed', 'locked', 'corrected', 'addended'))
    or (
      reviewed_by_user_id is not null
      and reviewed_at is not null
    )
  ),
  constraint source_response_sets_signed_attribution check (
    (status not in ('signed', 'locked', 'corrected', 'addended'))
    or (
      signed_by_user_id is not null
      and signed_at is not null
    )
  )
);

comment on table public.source_response_sets is
  'Runtime eSource capture episode. Authoring UI is not the system of record; persisted sets + responses are.';

comment on column public.source_response_sets.reviewed_by_user_id is
  'CRC/QA/PI review lane — distinct from signed_by_* (investigator attestation, Phase 4E).';

create index if not exists source_response_sets_org_study_idx on public.source_response_sets (organization_id, study_id);

create index if not exists source_response_sets_visit_idx on public.source_response_sets (visit_id);

create index if not exists source_response_sets_subject_idx on public.source_response_sets (study_subject_id);

create index if not exists source_response_sets_procedure_execution_idx on public.source_response_sets (procedure_execution_id);

create index if not exists source_response_sets_sdv_idx on public.source_response_sets (source_definition_version_id);

create index if not exists source_response_sets_status_idx on public.source_response_sets (study_id, status);

create unique index if not exists source_response_sets_active_execution_version_uidx on public.source_response_sets (procedure_execution_id, source_definition_version_id)
where
  status <> 'archived';

create or replace function public.phase4b_enforce_source_response_set_lineage () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_pe_org uuid;
  v_pe_study uuid;
  v_pe_visit uuid;
  v_pe_subject uuid;
  v_pe_sdv uuid;
  v_visit_status text;
  v_sdv_study uuid;
  v_sdv_lc text;
begin
  select
    pe.organization_id,
    pe.study_id,
    pe.visit_id,
    v.study_subject_id,
    pe.source_definition_version_id,
    v.visit_status into v_pe_org,
    v_pe_study,
    v_pe_visit,
    v_pe_subject,
    v_pe_sdv,
    v_visit_status
  from
    public.procedure_executions pe
    join public.visits v on v.id = pe.visit_id
  where
    pe.id = new.procedure_execution_id;

  if v_pe_study is null then
    raise exception 'procedure_execution_id % not found', new.procedure_execution_id;
  end if;

  new.organization_id := v_pe_org;
  new.study_id := v_pe_study;
  new.visit_id := v_pe_visit;
  new.study_subject_id := v_pe_subject;

  if new.visit_id is distinct from v_pe_visit then
    raise exception 'visit_id must match procedure_execution.visit_id';
  end if;

  select
    sdv.study_id,
    sdv.lifecycle_status into v_sdv_study,
    v_sdv_lc
  from
    public.source_definition_versions sdv
  where
    sdv.id = new.source_definition_version_id;

  if v_sdv_study is null then
    raise exception 'source_definition_version_id % not found', new.source_definition_version_id;
  end if;

  if v_sdv_lc is distinct from 'published' then
    raise exception 'source_response_sets may only bind published source_definition_versions (got %)', v_sdv_lc;
  end if;

  if v_sdv_study is distinct from v_pe_study then
    raise exception 'source_definition_version must belong to execution study';
  end if;

  if v_pe_sdv is not null
  and v_pe_sdv is distinct from new.source_definition_version_id then
    raise exception 'source_definition_version_id must match procedure_executions.source_definition_version_id once bound';
  end if;

  if tg_op = 'INSERT' then
    new.opened_by_user_id := coalesce(new.opened_by_user_id, auth.uid());
    new.opened_at := coalesce(new.opened_at, now());
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('locked', 'archived')
    and new.status is distinct from old.status then
      null;
    elsif old.status in ('locked', 'archived') then
      raise exception 'source_response_set % is %; metadata frozen except archival transition', old.id, old.status;
    end if;

    if new.status = 'reviewed'
    and (
      new.reviewed_by_user_id is null
      or new.reviewed_at is null
    ) then
      raise exception 'reviewed status requires reviewed_by_user_id and reviewed_at';
    end if;

    if new.status = 'signed'
    and (
      new.signed_by_user_id is null
      or new.signed_at is null
    ) then
      raise exception 'signed status requires signed_by_user_id and signed_at';
    end if;

    if new.status = 'submitted'
    and (
      new.submitted_by_user_id is null
      or new.submitted_at is null
    ) then
      raise exception 'submitted status requires submitted_by_user_id and submitted_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists source_response_sets_enforce_lineage on public.source_response_sets;

create trigger source_response_sets_enforce_lineage before insert
or
update on public.source_response_sets for each row
execute function public.phase4b_enforce_source_response_set_lineage ();

drop trigger if exists source_response_sets_set_updated_at on public.source_response_sets;

create trigger source_response_sets_set_updated_at before
update on public.source_response_sets for each row
execute function public.generic_set_updated_at ();

alter table public.source_response_sets enable row level security;

drop policy if exists source_response_sets_select on public.source_response_sets;

create policy source_response_sets_select on public.source_response_sets for
select
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (study_id)
    )
  );

drop policy if exists source_response_sets_insert on public.source_response_sets;

create policy source_response_sets_insert on public.source_response_sets for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (study_id)
    and not public.phase4b_visit_is_locked (visit_id)
  );

drop policy if exists source_response_sets_update on public.source_response_sets;

create policy source_response_sets_update on public.source_response_sets for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and public.user_can_manage_subject_enrollment (study_id)
  and status in ('draft', 'in_progress', 'submitted', 'pending_review', 'reviewed', 'signed', 'corrected', 'addended')
)
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (study_id)
  );

-- No DELETE policy — clinical runtime sets are not deleted by app roles.

-- ---------------------------------------------------------------------------
-- Phase 4B.1 backlog (planning only — not implemented in DDL)
-- ---------------------------------------------------------------------------
-- response_origin_mode on source_responses (enum, planned):
--   manual | imported | derived | calculated | device | migrated
-- Purpose: FDA/audit differentiation of human-entered vs imported vs system-derived
-- vs migrated legacy values. Complements source_response_sets.source_origin.
-- Implement in Phase 4B.1 capture/correction RPCs; no column in 4B baseline schema.
