-- Phase 4B: source_responses — typed atomic capture facts with correction chain pointers.
-- Dependencies: 0020 source_response_sets, 0016 source_fields, 0010 operational_events.
--
-- Value persistence: draft rows may have zero populated slots (autosave / partial capture).
-- Required-field completeness is enforced at submit (4B.1 RPC) + validation_findings engine.
-- is_submitted=true requires exactly one populated slot matching value_type.

-- ---------------------------------------------------------------------------
-- Value-shape helpers (IMMUTABLE — safe for CHECK constraints)
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_response_populated_slot_count (
  _value_text text,
  _value_number numeric,
  _value_boolean boolean,
  _value_date date,
  _value_datetime timestamptz,
  _value_json jsonb
) returns integer language sql immutable
set
  search_path = public as $$
select
  (
    _value_text is not null
  )::integer + (
    _value_number is not null
  )::integer + (
    _value_boolean is not null
  )::integer + (
    _value_date is not null
  )::integer + (
    _value_datetime is not null
  )::integer + (
    _value_json is not null
  )::integer;
$$;

create or replace function public.phase4b_response_value_matches_type (
  _value_type text,
  _value_text text,
  _value_number numeric,
  _value_boolean boolean,
  _value_date date,
  _value_datetime timestamptz,
  _value_json jsonb
) returns boolean language sql immutable
set
  search_path = public as $$
select
  case
    when public.phase4b_response_populated_slot_count (
      _value_text,
      _value_number,
      _value_boolean,
      _value_date,
      _value_datetime,
      _value_json
    ) = 0 then true
    when _value_type in ('text', 'textarea', 'dropdown_single', 'radio', 'file_reference', 'signature_reference') then _value_text is not null
    when _value_type in ('integer', 'decimal', 'calculated') then _value_number is not null
    when _value_type = 'boolean' then _value_boolean is not null
    when _value_type = 'date' then _value_date is not null
    when _value_type = 'datetime' then _value_datetime is not null
    when _value_type in ('dropdown_multi', 'checkbox', 'nested_list', 'table') then _value_json is not null
    else false
  end;
$$;

comment on function public.phase4b_response_populated_slot_count (text, numeric, boolean, date, timestamptz, jsonb) is
  'Count of populated value_* columns. Draft rows may be 0; submitted rows must be 1 (see submitted_typed_value CHECK).';

comment on function public.phase4b_response_value_matches_type (text, text, numeric, boolean, date, timestamptz, jsonb) is
  'When any slot is populated, it must align with value_type. Empty draft rows pass.';

-- ---------------------------------------------------------------------------
-- Correction-chain demotion (SECURITY DEFINER — bypasses RLS for is_current flip only)
-- ---------------------------------------------------------------------------

create or replace function public.phase4b_demote_prior_current_response (
  _response_set_id uuid,
  _source_field_id uuid,
  _superseded_response_id uuid
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_study_id uuid;
  v_prior uuid;
begin
  if auth.uid () is null then
    raise exception 'authentication required for correction-chain demotion';
  end if;

  select
    srs.study_id into v_study_id
  from
    public.source_response_sets srs
  where
    srs.id = _response_set_id;

  if v_study_id is null then
    raise exception 'response_set_id % not found', _response_set_id;
  end if;

  if not public.phase4b_user_can_correct_source (v_study_id) then
    raise exception 'not authorized to demote current response for study %', v_study_id;
  end if;

  select
    sr.id into v_prior
  from
    public.source_responses sr
  where
    sr.response_set_id = _response_set_id
    and sr.source_field_id = _source_field_id
    and sr.is_current = true
  for update;

  if v_prior is null then
    return null;
  end if;

  if v_prior is distinct from _superseded_response_id then
    raise exception 'superseded_response_id % is not the current head (current %)', _superseded_response_id, v_prior;
  end if;

  if not exists (
    select
      1
    from
      public.source_responses sr
    where
      sr.id = _superseded_response_id
      and sr.is_submitted = true
  ) then
    raise exception 'only submitted values may be superseded via correction chain';
  end if;

  perform set_config ('phase4b.internal_demotion', v_prior::text, true);

  update public.source_responses
  set
    is_current = false
  where
    id = v_prior
    and is_current = true;

  perform set_config ('phase4b.internal_demotion', '', true);

  return v_prior;
end;
$$;

comment on function public.phase4b_demote_prior_current_response (uuid, uuid, uuid) is
  'Append-only correction support: flips is_current on prior row only. Called from BEFORE INSERT trigger and Phase 4B.1 correction RPC. Does not mutate value_* columns.';

revoke all on function public.phase4b_demote_prior_current_response (uuid, uuid, uuid) from public;

grant execute on function public.phase4b_demote_prior_current_response (uuid, uuid, uuid) to authenticated;

revoke all on function public.phase4b_response_populated_slot_count (text, numeric, boolean, date, timestamptz, jsonb) from public;

grant execute on function public.phase4b_response_populated_slot_count (text, numeric, boolean, date, timestamptz, jsonb) to authenticated;

revoke all on function public.phase4b_response_value_matches_type (text, text, numeric, boolean, date, timestamptz, jsonb) from public;

grant execute on function public.phase4b_response_value_matches_type (text, text, numeric, boolean, date, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- source_responses
-- ---------------------------------------------------------------------------

create table if not exists public.source_responses (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  response_set_id uuid not null references public.source_response_sets (id) on delete restrict,
  source_definition_version_id uuid not null references public.source_definition_versions (id) on delete restrict,
  source_field_id uuid not null references public.source_fields (id) on delete restrict,
  procedure_execution_id uuid not null references public.procedure_executions (id) on delete cascade,
  response_sequence integer not null default 1 check (response_sequence > 0),
  is_current boolean not null default true,
  originator_user_id uuid not null references auth.users (id),
  originator_role text not null,
  captured_at timestamptz not null default now(),
  value_type text not null check (
    value_type in (
      'text',
      'textarea',
      'integer',
      'decimal',
      'boolean',
      'date',
      'datetime',
      'dropdown_single',
      'dropdown_multi',
      'checkbox',
      'radio',
      'nested_list',
      'table',
      'file_reference',
      'signature_reference',
      'calculated'
    )
  ),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_datetime timestamptz,
  value_json jsonb,
  unit text,
  normalized_value text,
  source_system text,
  source_device_id text,
  is_submitted boolean not null default false,
  submitted_at timestamptz,
  supersedes_response_id uuid references public.source_responses (id) on delete restrict,
  correction_chain_root_id uuid references public.source_responses (id) on delete restrict,
  operational_event_id uuid references public.operational_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint source_responses_originator_role_nonempty check (length(trim(originator_role)) > 0),
  constraint source_responses_submitted_attribution check (
    (not is_submitted)
    or submitted_at is not null
  ),
  constraint source_responses_value_json_allowlist check (
    value_json is null
    or value_type in ('dropdown_multi', 'checkbox', 'nested_list', 'table')
  ),
  constraint source_responses_scalar_slots_exclusive check (
    public.phase4b_response_populated_slot_count (
      value_text,
      value_number,
      value_boolean,
      value_date,
      value_datetime,
      value_json
    ) <= 1
  ),
  constraint source_responses_submitted_typed_value check (
    (not is_submitted)
    or (
      public.phase4b_response_populated_slot_count (
        value_text,
        value_number,
        value_boolean,
        value_date,
        value_datetime,
        value_json
      ) = 1
      and public.phase4b_response_value_matches_type (
        value_type,
        value_text,
        value_number,
        value_boolean,
        value_date,
        value_datetime,
        value_json
      )
    )
  ),
  unique (response_set_id, source_field_id, response_sequence)
);

comment on table public.source_responses is
  'Immutable-after-submit field facts. Corrections insert new rows; is_current marks regulatory-visible value.';

comment on column public.source_responses.is_submitted is
  'When true, value_* payload is frozen and submitted_typed_value CHECK requires one typed slot. Draft rows may have zero slots until submit validation (4B.1 RPC).';

comment on constraint source_responses_scalar_slots_exclusive on public.source_responses is
  'At most one value_* column populated at a time. Zero slots allowed for draft autosave / partial workflows.';

comment on constraint source_responses_submitted_typed_value on public.source_responses is
  'Regulatory fact rows require typed value at submit. Required-field completeness remains submit RPC + validation_findings.';

comment on column public.source_responses.value_json is
  'Allowed only for dropdown_multi, checkbox, nested_list, table — validated shapes per source_fields; not a form blob.';

create unique index if not exists source_responses_one_current_per_field_uidx on public.source_responses (response_set_id, source_field_id)
where
  is_current = true;

create index if not exists source_responses_response_set_idx on public.source_responses (response_set_id);

create index if not exists source_responses_procedure_execution_idx on public.source_responses (procedure_execution_id);

create index if not exists source_responses_source_field_idx on public.source_responses (source_field_id);

create index if not exists source_responses_chain_root_idx on public.source_responses (correction_chain_root_id);

create index if not exists source_responses_supersedes_idx on public.source_responses (supersedes_response_id);

create index if not exists source_responses_set_field_sequence_idx on public.source_responses (response_set_id, source_field_id, response_sequence);

create or replace function public.phase4b_enforce_source_response_row () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_set record;
  v_field_version uuid;
  v_visit_id uuid;
  v_visit_locked boolean;
  v_slot_count integer;
begin
  select
    srs.organization_id,
    srs.study_id,
    srs.visit_id,
    srs.procedure_execution_id,
    srs.source_definition_version_id,
    srs.status into v_set
  from
    public.source_response_sets srs
  where
    srs.id = new.response_set_id;

  if v_set.organization_id is null then
    raise exception 'response_set_id % not found', new.response_set_id;
  end if;

  new.organization_id := v_set.organization_id;
  new.procedure_execution_id := v_set.procedure_execution_id;
  new.source_definition_version_id := v_set.source_definition_version_id;
  v_visit_id := v_set.visit_id;

  select
    sf.source_definition_version_id into v_field_version
  from
    public.source_fields sf
  where
    sf.id = new.source_field_id;

  if v_field_version is null then
    raise exception 'source_field_id % not found', new.source_field_id;
  end if;

  if v_field_version is distinct from new.source_definition_version_id then
    raise exception 'source_field does not belong to bound source_definition_version';
  end if;

  if tg_op = 'INSERT'
  and new.supersedes_response_id is not null
  and new.correction_chain_root_id is null then
    select
      coalesce(sr.correction_chain_root_id, sr.id) into new.correction_chain_root_id
    from
      public.source_responses sr
    where
      sr.id = new.supersedes_response_id;
  end if;

  if tg_op = 'INSERT' then
    new.originator_user_id := coalesce(new.originator_user_id, auth.uid());
    new.captured_at := coalesce(new.captured_at, now());

    if new.supersedes_response_id is not null then
      if not exists (
        select
          1
        from
          public.source_responses prior
        where
          prior.id = new.supersedes_response_id
          and prior.response_set_id = new.response_set_id
          and prior.source_field_id = new.source_field_id
      ) then
        raise exception 'supersedes_response_id must reference same set and field';
      end if;

      perform public.phase4b_demote_prior_current_response (
        new.response_set_id,
        new.source_field_id,
        new.supersedes_response_id
      );

      new.response_sequence := coalesce(
        (
          select
            max(sr.response_sequence) + 1
          from
            public.source_responses sr
          where
            sr.response_set_id = new.response_set_id
            and sr.source_field_id = new.source_field_id
        ),
        1
      );
      new.is_current := true;
    elsif new.is_current then
      if exists (
        select
          1
        from
          public.source_responses sr
        where
          sr.response_set_id = new.response_set_id
          and sr.source_field_id = new.source_field_id
          and sr.is_current = true
      ) then
        raise exception 'only one is_current response per field per set';
      end if;
    end if;

    v_visit_locked := public.phase4b_visit_is_locked (v_visit_id);

    if v_visit_locked
    and new.supersedes_response_id is null
    and not new.is_submitted then
      raise exception 'visit is locked; draft capture blocked (use correction/addendum RPC in Phase 4B.1)';
    end if;

    v_slot_count := public.phase4b_response_populated_slot_count (
      new.value_text,
      new.value_number,
      new.value_boolean,
      new.value_date,
      new.value_datetime,
      new.value_json
    );

    if new.is_submitted
    and v_slot_count <> 1 then
      raise exception 'submitted source_responses require exactly one populated value slot';
    end if;

    if v_slot_count > 0
    and not public.phase4b_response_value_matches_type (
      new.value_type,
      new.value_text,
      new.value_number,
      new.value_boolean,
      new.value_date,
      new.value_datetime,
      new.value_json
    ) then
      raise exception 'populated value does not match value_type %', new.value_type;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if current_setting ('phase4b.internal_demotion', true) = old.id::text
    and new.is_current = false
    and old.is_current = true then
      return new;
    end if;

    if new.is_current is distinct from old.is_current then
      raise exception 'is_current may only change via phase4b_demote_prior_current_response or regulated correction INSERT';
    end if;

    if old.is_submitted
    and (
      new.value_text is distinct from old.value_text
      or new.value_number is distinct from old.value_number
      or new.value_boolean is distinct from old.value_boolean
      or new.value_date is distinct from old.value_date
      or new.value_datetime is distinct from old.value_datetime
      or new.value_json is distinct from old.value_json
      or new.normalized_value is distinct from old.normalized_value
      or new.unit is distinct from old.unit
    ) then
      raise exception 'submitted source_responses are immutable; use correction workflow';
    end if;

    if public.phase4b_visit_is_locked (v_visit_id)
    and not old.is_submitted
    and new.supersedes_response_id is null then
      raise exception 'visit is locked; draft edits blocked';
    end if;

    if new.is_submitted
    and not old.is_submitted then
      if public.phase4b_response_populated_slot_count (
        new.value_text,
        new.value_number,
        new.value_boolean,
        new.value_date,
        new.value_datetime,
        new.value_json
      ) <> 1 then
        raise exception 'cannot submit response without exactly one typed value slot';
      end if;
    end if;

    v_slot_count := public.phase4b_response_populated_slot_count (
      new.value_text,
      new.value_number,
      new.value_boolean,
      new.value_date,
      new.value_datetime,
      new.value_json
    );

    if v_slot_count > 0
    and not public.phase4b_response_value_matches_type (
      new.value_type,
      new.value_text,
      new.value_number,
      new.value_boolean,
      new.value_date,
      new.value_datetime,
      new.value_json
    ) then
      raise exception 'populated value does not match value_type %', new.value_type;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists source_responses_enforce_row on public.source_responses;

create trigger source_responses_enforce_row before insert
or
update on public.source_responses for each row
execute function public.phase4b_enforce_source_response_row ();

create or replace function public.phase4b_finalize_response_chain_root (_response_id uuid) returns void language plpgsql security definer
set
  search_path = public as $$
begin
  update public.source_responses
  set
    correction_chain_root_id = _response_id
  where
    id = _response_id
    and correction_chain_root_id is null;
end;
$$;

comment on function public.phase4b_finalize_response_chain_root (uuid) is
  'Sets correction_chain_root_id to self on first insert. SECURITY DEFINER avoids RLS edge cases on self-UPDATE.';

revoke all on function public.phase4b_finalize_response_chain_root (uuid) from public;

grant execute on function public.phase4b_finalize_response_chain_root (uuid) to authenticated;

create or replace function public.phase4b_source_responses_after_insert () returns trigger language plpgsql security invoker
set
  search_path = public as $$
begin
  if new.correction_chain_root_id is null then
    perform public.phase4b_finalize_response_chain_root (new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists source_responses_after_insert on public.source_responses;

create trigger source_responses_after_insert
after insert on public.source_responses for each row
execute function public.phase4b_source_responses_after_insert ();

alter table public.source_responses enable row level security;

drop policy if exists source_responses_select on public.source_responses;

create policy source_responses_select on public.source_responses for
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

drop policy if exists source_responses_insert on public.source_responses;

create policy source_responses_insert on public.source_responses for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and (
      (
        public.user_can_manage_subject_enrollment (
          (
            select
              srs.study_id
            from
              public.source_response_sets srs
            where
              srs.id = response_set_id
          )
        )
        and not public.phase4b_visit_is_locked (
          (
            select
              srs.visit_id
            from
              public.source_response_sets srs
            where
              srs.id = response_set_id
          )
        )
      )
      or (
        supersedes_response_id is not null
        and public.phase4b_user_can_correct_source (
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
    )
  );

drop policy if exists source_responses_update on public.source_responses;

create policy source_responses_update on public.source_responses for
update using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and is_submitted = false
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
  and not public.phase4b_visit_is_locked (
    (
      select
        srs.visit_id
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
    and is_submitted = false
  );

-- No DELETE policy.
