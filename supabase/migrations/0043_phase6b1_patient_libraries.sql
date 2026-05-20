-- Phase 6B.1 — Pathology + medication lookup libraries and subject medical history / ConMed.
-- Global reference tables; subject facts are org-scoped. Coordinator lookup only — not clinical decision support.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Global lookup: pathology_library
-- ---------------------------------------------------------------------------
create table if not exists public.pathology_library (
  pathology_id uuid primary key default gen_random_uuid (),
  external_seed_id integer,
  system text not null,
  common_name text not null,
  medical_name text,
  icd10_code text,
  synonyms text,
  chronic_acute text,
  sex_specific text,
  pediatric_use boolean not null default false,
  active_flag boolean not null default true,
  created_at timestamptz not null default now (),
  constraint pathology_library_common_name_nonempty check (
    length(
      trim(
        both
        from
          common_name
      )
    ) > 0
  ),
  constraint pathology_library_system_nonempty check (
    length(
      trim(
        both
        from
          system
      )
    ) > 0
  )
);

comment on table public.pathology_library is
  'Global coordinator lookup for medical history conditions. Not a billing ICD engine.';

create index if not exists pathology_library_common_name_idx on public.pathology_library (common_name);

create index if not exists pathology_library_medical_name_idx on public.pathology_library (medical_name);

create index if not exists pathology_library_icd10_code_idx on public.pathology_library (icd10_code);

create index if not exists pathology_library_system_idx on public.pathology_library (system);

create unique index if not exists pathology_library_external_seed_id_key on public.pathology_library (external_seed_id)
where
  external_seed_id is not null;

create unique index if not exists pathology_library_system_medical_icd_active_key on public.pathology_library (
  system,
  medical_name,
  coalesce(icd10_code, '')
)
where
  active_flag = true
  and medical_name is not null;

-- Trigram search on common_name + synonyms (coordinator typeahead)
create index if not exists pathology_library_common_name_trgm_idx on public.pathology_library using gin (common_name gin_trgm_ops);

create index if not exists pathology_library_synonyms_trgm_idx on public.pathology_library using gin (synonyms gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Global lookup: medication_library
-- ---------------------------------------------------------------------------
create table if not exists public.medication_library (
  medication_id uuid primary key default gen_random_uuid (),
  external_seed_id integer,
  medication_name text not null,
  brand_name text,
  drug_class text,
  route text,
  dosage_form text,
  active_flag boolean not null default true,
  created_at timestamptz not null default now (),
  constraint medication_library_name_nonempty check (
    length(
      trim(
        both
        from
          medication_name
      )
    ) > 0
  )
);

comment on table public.medication_library is
  'Global coordinator lookup for concomitant medications. Not prescribing logic.';

create index if not exists medication_library_medication_name_idx on public.medication_library (medication_name);

create index if not exists medication_library_brand_name_idx on public.medication_library (brand_name);

create index if not exists medication_library_drug_class_idx on public.medication_library (drug_class);

create unique index if not exists medication_library_external_seed_id_key on public.medication_library (external_seed_id)
where
  external_seed_id is not null;

create index if not exists medication_library_medication_name_trgm_idx on public.medication_library using gin (medication_name gin_trgm_ops);

create index if not exists medication_library_brand_name_trgm_idx on public.medication_library using gin (brand_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Suggested pathology ↔ medication links (not recommendations)
-- ---------------------------------------------------------------------------
create table if not exists public.pathology_medication_links (
  link_id uuid primary key default gen_random_uuid (),
  pathology_id uuid not null references public.pathology_library (pathology_id) on delete cascade,
  medication_id uuid not null references public.medication_library (medication_id) on delete cascade,
  relation_rank integer,
  relation_type text,
  active_flag boolean not null default true,
  notes text,
  created_at timestamptz not null default now (),
  constraint pathology_medication_links_unique_pair unique (pathology_id, medication_id)
);

comment on table public.pathology_medication_links is
  'Optional coordinator hints linking conditions to commonly documented meds. Not clinical recommendations.';

create index if not exists pathology_medication_links_pathology_idx on public.pathology_medication_links (pathology_id);

create index if not exists pathology_medication_links_medication_idx on public.pathology_medication_links (medication_id);

-- ---------------------------------------------------------------------------
-- Subject medical history (org-scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.subject_medical_history (
  subject_history_id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  pathology_id uuid references public.pathology_library (pathology_id) on delete set null,
  custom_condition_name text,
  onset_date date,
  approximate_onset boolean not null default false,
  ongoing boolean not null default true,
  end_date date,
  clinically_significant boolean,
  comments text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint subject_medical_history_condition_source check (
    pathology_id is not null
    or (
      custom_condition_name is not null
      and length(
        trim(
          both
          from
            custom_condition_name
        )
      ) > 0
    )
  ),
  constraint subject_medical_history_end_after_onset check (
    end_date is null
    or onset_date is null
    or end_date >= onset_date
  )
);

comment on table public.subject_medical_history is
  'Per-subject medical history rows. Library selection or custom condition text.';

create index if not exists subject_medical_history_org_subject_idx on public.subject_medical_history (organization_id, study_subject_id);

create index if not exists subject_medical_history_pathology_idx on public.subject_medical_history (pathology_id);

-- ---------------------------------------------------------------------------
-- Subject concomitant medications (org-scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.subject_concomitant_medications (
  conmed_id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  medication_id uuid references public.medication_library (medication_id) on delete set null,
  custom_medication_name text,
  indication_history_id uuid references public.subject_medical_history (subject_history_id) on delete set null,
  indication_text text,
  dose text,
  dose_unit text,
  frequency text,
  route text,
  start_date date,
  ongoing boolean not null default true,
  stop_date date,
  comments text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint subject_conmed_medication_source check (
    medication_id is not null
    or (
      custom_medication_name is not null
      and length(
        trim(
          both
          from
            custom_medication_name
        )
      ) > 0
    )
  ),
  constraint subject_conmed_stop_after_start check (
    stop_date is null
    or start_date is null
    or stop_date >= start_date
  )
);

comment on table public.subject_concomitant_medications is
  'Per-subject concomitant medication rows. Library selection or custom med name.';

create index if not exists subject_concomitant_medications_org_subject_idx on public.subject_concomitant_medications (organization_id, study_subject_id);

create index if not exists subject_concomitant_medications_medication_idx on public.subject_concomitant_medications (medication_id);

create index if not exists subject_concomitant_medications_indication_idx on public.subject_concomitant_medications (indication_history_id);

-- ---------------------------------------------------------------------------
-- Triggers: align organization_id / validate subject scope
-- ---------------------------------------------------------------------------
create or replace function public.phase6b1_enforce_subject_medical_history_row () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_org uuid;
  v_study uuid;
begin
  select
    ss.organization_id,
    ss.study_id into v_org,
    v_study
  from
    public.study_subjects ss
  where
    ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_medical_history';
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  return new;
end;
$$;

create or replace function public.phase6b1_enforce_subject_conmed_row () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_org uuid;
  v_subject uuid;
  v_hist_subject uuid;
  v_hist_org uuid;
begin
  select
    ss.organization_id,
    ss.id into v_org,
    v_subject
  from
    public.study_subjects ss
  where
    ss.id = new.study_subject_id;

  if v_org is null then
    raise exception 'study_subject not found for subject_concomitant_medications';
  end if;

  if new.organization_id is distinct from v_org then
    new.organization_id := v_org;
  end if;

  if new.indication_history_id is not null then
    select
      smh.study_subject_id,
      smh.organization_id into v_hist_subject,
      v_hist_org
    from
      public.subject_medical_history smh
    where
      smh.subject_history_id = new.indication_history_id;

    if v_hist_subject is null then
      raise exception 'indication_history_id not found';
    end if;

    if v_hist_subject is distinct from new.study_subject_id then
      raise exception 'indication_history_id must belong to the same study_subject';
    end if;

    if v_hist_org is distinct from new.organization_id then
      raise exception 'indication_history_id organization mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subject_medical_history_enforce_subject on public.subject_medical_history;

create trigger subject_medical_history_enforce_subject before insert
or
update on public.subject_medical_history for each row
execute function public.phase6b1_enforce_subject_medical_history_row ();

drop trigger if exists subject_concomitant_medications_enforce_subject on public.subject_concomitant_medications;

create trigger subject_concomitant_medications_enforce_subject before insert
or
update on public.subject_concomitant_medications for each row
execute function public.phase6b1_enforce_subject_conmed_row ();

drop trigger if exists subject_medical_history_set_updated_at on public.subject_medical_history;

create trigger subject_medical_history_set_updated_at before
update on public.subject_medical_history for each row
execute function public.generic_set_updated_at ();

drop trigger if exists subject_concomitant_medications_set_updated_at on public.subject_concomitant_medications;

create trigger subject_concomitant_medications_set_updated_at before
update on public.subject_concomitant_medications for each row
execute function public.generic_set_updated_at ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pathology_library enable row level security;

alter table public.medication_library enable row level security;

alter table public.pathology_medication_links enable row level security;

alter table public.subject_medical_history enable row level security;

alter table public.subject_concomitant_medications enable row level security;

-- Global libraries: read-only for authenticated users
drop policy if exists pathology_library_select_authenticated on public.pathology_library;

create policy pathology_library_select_authenticated on public.pathology_library for
select
  to authenticated using (true);

drop policy if exists medication_library_select_authenticated on public.medication_library;

create policy medication_library_select_authenticated on public.medication_library for
select
  to authenticated using (true);

drop policy if exists pathology_medication_links_select_authenticated on public.pathology_medication_links;

create policy pathology_medication_links_select_authenticated on public.pathology_medication_links for
select
  to authenticated using (active_flag = true);

-- Subject medical history
drop policy if exists subject_medical_history_select on public.subject_medical_history;

create policy subject_medical_history_select on public.subject_medical_history for
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
            ss.study_id
          from
            public.study_subjects ss
          where
            ss.id = study_subject_id
        )
      )
    )
  );

drop policy if exists subject_medical_history_insert on public.subject_medical_history;

create policy subject_medical_history_insert on public.subject_medical_history for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  );

drop policy if exists subject_medical_history_update on public.subject_medical_history;

create policy subject_medical_history_update on public.subject_medical_history
for update
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  )
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  );

drop policy if exists subject_medical_history_delete on public.subject_medical_history;

create policy subject_medical_history_delete on public.subject_medical_history for delete using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and (
    public.user_is_org_admin (organization_id)
    or public.user_is_study_admin (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  )
);

-- Subject concomitant medications
drop policy if exists subject_concomitant_medications_select on public.subject_concomitant_medications;

create policy subject_concomitant_medications_select on public.subject_concomitant_medications for
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
            ss.study_id
          from
            public.study_subjects ss
          where
            ss.id = study_subject_id
        )
      )
    )
  );

drop policy if exists subject_concomitant_medications_insert on public.subject_concomitant_medications;

create policy subject_concomitant_medications_insert on public.subject_concomitant_medications for insert
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  );

drop policy if exists subject_concomitant_medications_update on public.subject_concomitant_medications;

create policy subject_concomitant_medications_update on public.subject_concomitant_medications
for update
  using (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  )
with
  check (
    organization_id in (
      select
        public.user_organization_ids ()
    )
    and public.user_can_manage_subject_enrollment (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  );

drop policy if exists subject_concomitant_medications_delete on public.subject_concomitant_medications;

create policy subject_concomitant_medications_delete on public.subject_concomitant_medications for delete using (
  organization_id in (
    select
      public.user_organization_ids ()
  )
  and (
    public.user_is_org_admin (organization_id)
    or public.user_is_study_admin (
      (
        select
          ss.study_id
        from
          public.study_subjects ss
        where
          ss.id = study_subject_id
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Seed: pathology (fixture + Headache) — only when table is empty (idempotent)
-- ---------------------------------------------------------------------------
insert into
  public.pathology_library (
    external_seed_id,
    system,
    common_name,
    medical_name,
    icd10_code,
    synonyms,
    chronic_acute,
    sex_specific,
    pediatric_use,
    active_flag
  )
select
  v.external_seed_id,
  v.system,
  v.common_name,
  v.medical_name,
  v.icd10_code,
  v.synonyms,
  v.chronic_acute,
  v.sex_specific,
  v.pediatric_use,
  v.active_flag
from
  (
    values
      (
        1,
        'Cardiovascular',
    'High blood pressure',
    'Essential hypertension',
    'I10',
    'HTN, hypertension',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    2,
    'Respiratory',
    'Asthma',
    'Asthma, unspecified',
    'J45.909',
    'Bronchial asthma',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    3,
    'Endocrine',
    'Diabetes',
    'Type 2 diabetes mellitus without complications',
    'E11.9',
    'T2DM, type 2 diabetes',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    4,
    'Digestive',
    'GERD',
    'Gastro-esophageal reflux disease without esophagitis',
    'K21.9',
    'Acid reflux, heartburn',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    5,
    'Musculoskeletal',
    'Osteoarthritis',
    'Osteoarthritis, unspecified site',
    'M19.90',
    'Arthritis, joint pain',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    6,
    'Mental',
    'Depression',
    'Major depressive disorder, single episode, unspecified',
    'F32.9',
    'Depression, MDD',
    'Chronic',
    'Both',
    true,
    true
  ),
  (
    7,
    'Nervous system',
    'Headache',
    'Headache, unspecified',
    'R51.9',
    'Head pain, cephalalgia, migraine',
    'Both',
    'Both',
        true,
        true
      )
  ) as v (
    external_seed_id,
    system,
    common_name,
    medical_name,
    icd10_code,
    synonyms,
    chronic_acute,
    sex_specific,
    pediatric_use,
    active_flag
  )
where
  not exists (select 1 from public.pathology_library limit 1);

-- ---------------------------------------------------------------------------
-- Seed: medications (includes Metformin) — only when table is empty
-- ---------------------------------------------------------------------------
insert into
  public.medication_library (
    external_seed_id,
    medication_name,
    brand_name,
    drug_class,
    route,
    dosage_form,
    active_flag
  )
select
  v.external_seed_id,
  v.medication_name,
  v.brand_name,
  v.drug_class,
  v.route,
  v.dosage_form,
  v.active_flag
from
  (
    values
      (1, 'Metformin', 'Glucophage', 'Biguanide antidiabetic', 'oral', 'tablet', true),
  (2, 'Ibuprofen', 'Advil', 'NSAID', 'oral', 'tablet', true),
  (3, 'Acetaminophen', 'Tylenol', 'Analgesic', 'oral', 'tablet', true),
  (4, 'Lisinopril', 'Prinivil', 'ACE inhibitor', 'oral', 'tablet', true),
  (5, 'Omeprazole', 'Prilosec', 'Proton pump inhibitor', 'oral', 'capsule', true),
  (6, 'Atorvastatin', 'Lipitor', 'HMG-CoA reductase inhibitor', 'oral', 'tablet', true),
  (7, 'Albuterol', 'ProAir', 'Short-acting beta agonist', 'inhalation', 'inhaler', true),
  (8, 'Sertraline', 'Zoloft', 'SSRI', 'oral', 'tablet', true),
  (9, 'Amoxicillin', 'Amoxil', 'Penicillin antibiotic', 'oral', 'capsule', true),
      (10, 'Aspirin', 'Bayer Aspirin', 'Antiplatelet / analgesic', 'oral', 'tablet', true)
  ) as v (
    external_seed_id,
    medication_name,
    brand_name,
    drug_class,
    route,
    dosage_form,
    active_flag
  )
where
  not exists (select 1 from public.medication_library limit 1);

-- ---------------------------------------------------------------------------
-- Seed: suggested pathology ↔ medication links (skip when links already exist)
-- ---------------------------------------------------------------------------
insert into
  public.pathology_medication_links (
    pathology_id,
    medication_id,
    relation_rank,
    relation_type,
    notes,
    active_flag
  )
select
  p.pathology_id,
  m.medication_id,
  v.relation_rank,
  v.relation_type,
  'Coordinator suggestion only — not a clinical recommendation.',
  true
from
  (
    values
      (3, 1, 1, 'common_concomitant'),
      (7, 2, 1, 'common_concomitant'),
      (7, 3, 2, 'common_concomitant'),
      (1, 4, 1, 'common_concomitant'),
      (4, 5, 1, 'common_concomitant'),
      (2, 7, 1, 'common_concomitant'),
      (6, 8, 1, 'common_concomitant'),
      (1, 6, 2, 'common_concomitant')
  ) as v (pathology_seed_id, medication_seed_id, relation_rank, relation_type)
  join public.pathology_library p on p.external_seed_id = v.pathology_seed_id
  join public.medication_library m on m.external_seed_id = v.medication_seed_id
where
  not exists (select 1 from public.pathology_medication_links limit 1)
on conflict (pathology_id, medication_id) do
update
set
  relation_rank = excluded.relation_rank,
  relation_type = excluded.relation_type,
  notes = excluded.notes,
  active_flag = excluded.active_flag;
