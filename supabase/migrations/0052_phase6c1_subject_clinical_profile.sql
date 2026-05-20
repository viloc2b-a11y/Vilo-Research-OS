-- Phase 6C.1 — Subject Longitudinal Clinical Profile
-- Extends Phase 6B.1 subject_medical_history + subject_concomitant_medications.
-- Adds: subject_allergies, subject_surgical_history, subject_lifestyle,
--       subject_clinical_profile_events (immutable ALCOA+ audit log).
-- Idempotent: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- 1. Extend subject_medical_history
-- ---------------------------------------------------------------------------

alter table public.subject_medical_history
  add column if not exists severity text,
  add column if not exists source_attribution text,
  add column if not exists source_document_ref text,
  add column if not exists verified_by uuid references auth.users (id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists status text not null default 'active';

-- Add check constraints idempotently
alter table public.subject_medical_history
  drop constraint if exists subject_medical_history_severity_check;
alter table public.subject_medical_history
  add constraint subject_medical_history_severity_check
  check (severity is null or severity in ('mild', 'moderate', 'severe', 'life-threatening'));

alter table public.subject_medical_history
  drop constraint if exists subject_medical_history_status_check;
alter table public.subject_medical_history
  add constraint subject_medical_history_status_check
  check (status in ('active', 'resolved', 'inactive'));

comment on column public.subject_medical_history.severity is
  'Coordinator-assessed severity. Controlled enum: mild | moderate | severe | life-threatening.';
comment on column public.subject_medical_history.source_attribution is
  'Where this entry originated (e.g. "Visit 1 intake form", "prior medical records").';
comment on column public.subject_medical_history.source_document_ref is
  'Optional reference to a specific document or attachment.';
comment on column public.subject_medical_history.verified_by is
  'User (CRA/PI) who verified this entry.';
comment on column public.subject_medical_history.verified_at is
  'Timestamp of verification.';
comment on column public.subject_medical_history.status is
  'Lifecycle status: active | resolved | inactive.';

-- ---------------------------------------------------------------------------
-- 2. Extend subject_concomitant_medications
-- ---------------------------------------------------------------------------

alter table public.subject_concomitant_medications
  add column if not exists prn boolean not null default false,
  add column if not exists reason_stopped text,
  add column if not exists source_attribution text,
  add column if not exists source_document_ref text,
  add column if not exists verified_by uuid references auth.users (id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists status text not null default 'active';

alter table public.subject_concomitant_medications
  drop constraint if exists subject_conmed_status_check;
alter table public.subject_concomitant_medications
  add constraint subject_conmed_status_check
  check (status in ('active', 'discontinued', 'on_hold'));

comment on column public.subject_concomitant_medications.prn is
  'Pro re nata: medication taken as needed rather than on a fixed schedule.';
comment on column public.subject_concomitant_medications.reason_stopped is
  'Free-text reason the medication was discontinued.';
comment on column public.subject_concomitant_medications.source_attribution is
  'Where this entry originated.';
comment on column public.subject_concomitant_medications.source_document_ref is
  'Optional reference to a specific document or attachment.';
comment on column public.subject_concomitant_medications.verified_by is
  'User (CRA/PI) who verified this entry.';
comment on column public.subject_concomitant_medications.verified_at is
  'Timestamp of verification.';
comment on column public.subject_concomitant_medications.status is
  'Lifecycle status: active | discontinued | on_hold.';

-- ---------------------------------------------------------------------------
-- 3. subject_allergies
-- ---------------------------------------------------------------------------

create table if not exists public.subject_allergies (
  allergy_id          uuid primary key default gen_random_uuid (),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  study_subject_id    uuid not null references public.study_subjects (id) on delete cascade,
  allergen            text not null,
  allergen_type       text,
  reaction            text,
  severity            text,
  status              text not null default 'active',
  onset_date          date,
  approximate_onset   boolean not null default false,
  source_attribution  text,
  source_document_ref text,
  comments            text,
  verified_by         uuid references auth.users (id) on delete set null,
  verified_at         timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now (),
  updated_at          timestamptz not null default now (),
  constraint subject_allergies_allergen_nonempty check (
    length(trim(both from allergen)) > 0
  ),
  constraint subject_allergies_allergen_type_check check (
    allergen_type is null
    or allergen_type in ('drug', 'food', 'environmental', 'contrast', 'latex', 'other')
  ),
  constraint subject_allergies_severity_check check (
    severity is null
    or severity in ('mild', 'moderate', 'severe', 'life-threatening', 'unknown')
  ),
  constraint subject_allergies_status_check check (
    status in ('active', 'inactive', 'unconfirmed')
  )
);

comment on table public.subject_allergies is
  'Per-subject allergy and adverse reaction records. Free-text allergen; no library yet.';
comment on column public.subject_allergies.allergen_type is
  'drug | food | environmental | contrast | latex | other';
comment on column public.subject_allergies.severity is
  'mild | moderate | severe | life-threatening | unknown';
comment on column public.subject_allergies.status is
  'active | inactive | unconfirmed';

create index if not exists subject_allergies_org_subject_idx
  on public.subject_allergies (organization_id, study_subject_id);

-- ---------------------------------------------------------------------------
-- 4. subject_surgical_history
-- ---------------------------------------------------------------------------

create table if not exists public.subject_surgical_history (
  surgical_history_id uuid primary key default gen_random_uuid (),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  study_subject_id    uuid not null references public.study_subjects (id) on delete cascade,
  procedure_name      text not null,
  approximate_date    date,
  date_precision      text not null default 'exact',
  outcome             text,
  comments            text,
  source_attribution  text,
  source_document_ref text,
  verified_by         uuid references auth.users (id) on delete set null,
  verified_at         timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now (),
  updated_at          timestamptz not null default now (),
  constraint subject_surgical_history_procedure_nonempty check (
    length(trim(both from procedure_name)) > 0
  ),
  constraint subject_surgical_history_date_precision_check check (
    date_precision in ('exact', 'month', 'year', 'decade', 'unknown')
  )
);

comment on table public.subject_surgical_history is
  'Per-subject surgical and procedure history.';
comment on column public.subject_surgical_history.date_precision is
  'Granularity of approximate_date: exact | month | year | decade | unknown.';

create index if not exists subject_surgical_history_org_subject_idx
  on public.subject_surgical_history (organization_id, study_subject_id);

-- ---------------------------------------------------------------------------
-- 5. subject_lifestyle  (one row per study_subject — upsert pattern)
-- ---------------------------------------------------------------------------

create table if not exists public.subject_lifestyle (
  lifestyle_id            uuid primary key default gen_random_uuid (),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  study_subject_id        uuid not null references public.study_subjects (id) on delete cascade,
  -- Tobacco
  tobacco_status          text,
  tobacco_type            text,
  tobacco_packs_per_day   numeric(5, 2),
  tobacco_years           numeric(5, 1),
  tobacco_quit_year       integer,
  -- Alcohol
  alcohol_status          text,
  alcohol_drinks_per_week numeric(5, 1),
  -- Substance use
  substance_use_status    text,
  substance_use_details   text,
  -- Exercise
  exercise_frequency      text,
  exercise_details        text,
  -- General
  comments                text,
  source_attribution      text,
  last_updated_by         uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now (),
  updated_at              timestamptz not null default now (),
  constraint subject_lifestyle_unique_subject unique (study_subject_id),
  constraint subject_lifestyle_tobacco_status_check check (
    tobacco_status is null
    or tobacco_status in ('never', 'current', 'former', 'unknown')
  ),
  constraint subject_lifestyle_alcohol_status_check check (
    alcohol_status is null
    or alcohol_status in ('never', 'current', 'former', 'unknown')
  ),
  constraint subject_lifestyle_substance_use_status_check check (
    substance_use_status is null
    or substance_use_status in ('none', 'current', 'former', 'unknown')
  ),
  constraint subject_lifestyle_exercise_frequency_check check (
    exercise_frequency is null
    or exercise_frequency in ('none', 'occasional', 'moderate', 'frequent', 'unknown')
  )
);

comment on table public.subject_lifestyle is
  'Per-subject lifestyle and risk factor snapshot. One row per study_subject (upsert).';
comment on column public.subject_lifestyle.tobacco_status is
  'never | current | former | unknown';
comment on column public.subject_lifestyle.alcohol_status is
  'never | current | former | unknown';
comment on column public.subject_lifestyle.substance_use_status is
  'none | current | former | unknown';
comment on column public.subject_lifestyle.exercise_frequency is
  'none | occasional | moderate | frequent | unknown';

create index if not exists subject_lifestyle_org_subject_idx
  on public.subject_lifestyle (organization_id, study_subject_id);

-- ---------------------------------------------------------------------------
-- 6. subject_clinical_profile_events  (immutable ALCOA+ audit log)
-- ---------------------------------------------------------------------------

create table if not exists public.subject_clinical_profile_events (
  event_id           uuid primary key default gen_random_uuid (),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  study_subject_id   uuid not null references public.study_subjects (id) on delete cascade,
  section            text not null,
  record_id          uuid not null,
  event_type         text not null,
  actor_id           uuid not null references auth.users (id) on delete restrict,
  actor_role         text,
  occurred_at        timestamptz not null default now (),
  before_snapshot    jsonb,
  after_snapshot     jsonb not null,
  change_reason      text,
  source_attribution text,
  created_at         timestamptz not null default now (),
  constraint subject_clinical_profile_events_section_check check (
    section in (
      'medical_history', 'conmeds', 'allergies', 'surgical_history', 'lifestyle'
    )
  ),
  constraint subject_clinical_profile_events_event_type_check check (
    event_type in ('created', 'updated', 'verified', 'status_changed', 'deleted')
  )
);

comment on table public.subject_clinical_profile_events is
  'Immutable ALCOA+ audit event log for all subject clinical profile mutations. Append-only — no UPDATE or DELETE permitted.';
comment on column public.subject_clinical_profile_events.section is
  'Which profile section was changed: medical_history | conmeds | allergies | surgical_history | lifestyle.';
comment on column public.subject_clinical_profile_events.record_id is
  'PK of the modified record in its source table (loose FK, not enforced).';
comment on column public.subject_clinical_profile_events.before_snapshot is
  'Full JSON snapshot of the record before change. NULL on create events.';
comment on column public.subject_clinical_profile_events.after_snapshot is
  'Full JSON snapshot of the record after change. Required on all events.';
comment on column public.subject_clinical_profile_events.change_reason is
  'Required for updated / status_changed events. Coordinator-supplied reason.';

create index if not exists subject_clinical_profile_events_subject_section_idx
  on public.subject_clinical_profile_events (study_subject_id, section, occurred_at desc);

create index if not exists subject_clinical_profile_events_record_idx
  on public.subject_clinical_profile_events (record_id, occurred_at desc);

create index if not exists subject_clinical_profile_events_org_idx
  on public.subject_clinical_profile_events (organization_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 7. Org-scope enforcement triggers (new tables)
-- ---------------------------------------------------------------------------

create or replace function public.phase6c1_enforce_subject_allergies_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select ss.organization_id into v_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_allergies';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

create or replace function public.phase6c1_enforce_subject_surgical_history_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select ss.organization_id into v_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_surgical_history';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

create or replace function public.phase6c1_enforce_subject_lifestyle_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select ss.organization_id into v_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_lifestyle';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

create or replace function public.phase6c1_enforce_subject_profile_events_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select ss.organization_id into v_org
  from public.study_subjects ss
  where ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_clinical_profile_events';
  end if;

  new.organization_id := v_org;
  -- Enforce: occurred_at must be DB-side now() on insert
  new.occurred_at := now();
  new.created_at  := now();
  return new;
end;
$$;

-- Trigger: block any UPDATE on the events table (belt + suspenders with RLS)
create or replace function public.phase6c1_block_profile_events_update ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'subject_clinical_profile_events is append-only. Updates are not permitted. (ALCOA+)';
end;
$$;

-- subject_allergies
drop trigger if exists subject_allergies_enforce_subject on public.subject_allergies;
create trigger subject_allergies_enforce_subject
  before insert or update of organization_id, study_subject_id
  on public.subject_allergies
  for each row execute function public.phase6c1_enforce_subject_allergies_row ();

drop trigger if exists subject_allergies_set_updated_at on public.subject_allergies;
create trigger subject_allergies_set_updated_at
  before update on public.subject_allergies
  for each row execute function public.generic_set_updated_at ();

-- subject_surgical_history
drop trigger if exists subject_surgical_history_enforce_subject on public.subject_surgical_history;
create trigger subject_surgical_history_enforce_subject
  before insert or update of organization_id, study_subject_id
  on public.subject_surgical_history
  for each row execute function public.phase6c1_enforce_subject_surgical_history_row ();

drop trigger if exists subject_surgical_history_set_updated_at on public.subject_surgical_history;
create trigger subject_surgical_history_set_updated_at
  before update on public.subject_surgical_history
  for each row execute function public.generic_set_updated_at ();

-- subject_lifestyle
drop trigger if exists subject_lifestyle_enforce_subject on public.subject_lifestyle;
create trigger subject_lifestyle_enforce_subject
  before insert or update of organization_id, study_subject_id
  on public.subject_lifestyle
  for each row execute function public.phase6c1_enforce_subject_lifestyle_row ();

drop trigger if exists subject_lifestyle_set_updated_at on public.subject_lifestyle;
create trigger subject_lifestyle_set_updated_at
  before update on public.subject_lifestyle
  for each row execute function public.generic_set_updated_at ();

-- subject_clinical_profile_events
drop trigger if exists subject_clinical_profile_events_enforce_row on public.subject_clinical_profile_events;
create trigger subject_clinical_profile_events_enforce_row
  before insert
  on public.subject_clinical_profile_events
  for each row execute function public.phase6c1_enforce_subject_profile_events_row ();

drop trigger if exists subject_clinical_profile_events_block_update on public.subject_clinical_profile_events;
create trigger subject_clinical_profile_events_block_update
  before update
  on public.subject_clinical_profile_events
  for each row execute function public.phase6c1_block_profile_events_update ();

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------

alter table public.subject_allergies enable row level security;
alter table public.subject_surgical_history enable row level security;
alter table public.subject_lifestyle enable row level security;
alter table public.subject_clinical_profile_events enable row level security;

-- subject_allergies
drop policy if exists subject_allergies_select on public.subject_allergies;
create policy subject_allergies_select on public.subject_allergies
  for select using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

drop policy if exists subject_allergies_insert on public.subject_allergies;
create policy subject_allergies_insert on public.subject_allergies
  for insert with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_allergies_update on public.subject_allergies;
create policy subject_allergies_update on public.subject_allergies
  for update using (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  ) with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_allergies_delete on public.subject_allergies;
create policy subject_allergies_delete on public.subject_allergies
  for delete using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_is_study_admin (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

-- subject_surgical_history
drop policy if exists subject_surgical_history_select on public.subject_surgical_history;
create policy subject_surgical_history_select on public.subject_surgical_history
  for select using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

drop policy if exists subject_surgical_history_insert on public.subject_surgical_history;
create policy subject_surgical_history_insert on public.subject_surgical_history
  for insert with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_surgical_history_update on public.subject_surgical_history;
create policy subject_surgical_history_update on public.subject_surgical_history
  for update using (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  ) with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_surgical_history_delete on public.subject_surgical_history;
create policy subject_surgical_history_delete on public.subject_surgical_history
  for delete using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_is_study_admin (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

-- subject_lifestyle
drop policy if exists subject_lifestyle_select on public.subject_lifestyle;
create policy subject_lifestyle_select on public.subject_lifestyle
  for select using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

drop policy if exists subject_lifestyle_insert on public.subject_lifestyle;
create policy subject_lifestyle_insert on public.subject_lifestyle
  for insert with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

drop policy if exists subject_lifestyle_update on public.subject_lifestyle;
create policy subject_lifestyle_update on public.subject_lifestyle
  for update using (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  ) with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

-- subject_clinical_profile_events — APPEND ONLY
-- SELECT: org member with study access
-- INSERT: org member with enrollment management rights
-- UPDATE: BLOCKED
-- DELETE: BLOCKED

drop policy if exists subject_clinical_profile_events_select on public.subject_clinical_profile_events;
create policy subject_clinical_profile_events_select on public.subject_clinical_profile_events
  for select using (
    organization_id in (select public.user_organization_ids ())
    and (
      public.user_is_org_admin (organization_id)
      or public.user_has_study_access (
        (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
      )
    )
  );

drop policy if exists subject_clinical_profile_events_insert on public.subject_clinical_profile_events;
create policy subject_clinical_profile_events_insert on public.subject_clinical_profile_events
  for insert with check (
    organization_id in (select public.user_organization_ids ())
    and public.user_can_manage_subject_enrollment (
      (select ss.study_id from public.study_subjects ss where ss.id = study_subject_id)
    )
  );

-- Explicit block policies for UPDATE and DELETE (append-only enforcement)
drop policy if exists subject_clinical_profile_events_update on public.subject_clinical_profile_events;
create policy subject_clinical_profile_events_update on public.subject_clinical_profile_events
  for update using (false);

drop policy if exists subject_clinical_profile_events_delete on public.subject_clinical_profile_events;
create policy subject_clinical_profile_events_delete on public.subject_clinical_profile_events
  for delete using (false);
