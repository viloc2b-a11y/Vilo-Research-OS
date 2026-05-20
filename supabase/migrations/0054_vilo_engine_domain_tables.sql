-- Vilo Engine domain tables — sourcePath-aligned capture domains with study-scoped RLS.
-- Maps: demo/pregnancy → vilo_demographics, vitals → vilo_vitals, proc → vilo_procedures,
--       finding → vilo_findings, tnm → vilo_tnm, lab → vilo_plasma_aliquots,
--       supply → vilo_ip_supply, site → vilo_site_delegation.

-- ---------------------------------------------------------------------------
-- Shared scope enforcement (organization / study / subject from visit when set)
-- ---------------------------------------------------------------------------

create or replace function public.vilo_engine_enforce_row_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_study uuid;
  v_subject uuid;
begin
  if new.visit_id is not null then
    select v.organization_id, v.study_id, v.study_subject_id
      into v_org, v_study, v_subject
    from public.visits v
    where v.id = new.visit_id;

    if v_org is null then
      raise exception 'visit_id not found';
    end if;

    if new.organization_id is distinct from v_org then
      new.organization_id := v_org;
    end if;
    if new.study_id is distinct from v_study then
      new.study_id := v_study;
    end if;
    if new.study_subject_id is distinct from v_subject then
      new.study_subject_id := v_subject;
    end if;
  else
    select ss.organization_id, ss.study_id
      into v_org, v_study
    from public.study_subjects ss
    where ss.id = new.study_subject_id;

    if v_org is null then
      raise exception 'study_subject_id not found';
    end if;

    if new.organization_id is distinct from v_org then
      new.organization_id := v_org;
    end if;
    if new.study_id is distinct from v_study then
      new.study_id := v_study;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Demographics (demo.*, pregnancy.*)
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_demographics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  birth_year integer check (birth_year is null or birth_year between 1900 and 2100),
  sex text check (sex is null or sex in ('Male', 'Female')),
  childbearing_potential text check (childbearing_potential is null or childbearing_potential in ('Yes', 'No')),
  pregnancy_test_result text check (
    pregnancy_test_result is null
    or pregnancy_test_result in ('Negative', 'Positive', 'Not done')
  ),
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_demographics_subject_idx
  on public.vilo_demographics (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Vitals
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_vitals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  sys_bp numeric check (sys_bp is null or (sys_bp >= 70 and sys_bp <= 250)),
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_vitals_subject_idx
  on public.vilo_vitals (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Procedures (BBPS)
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  bbps_right text check (bbps_right is null or bbps_right in ('0', '1', '2', '3')),
  bbps_transverse text check (bbps_transverse is null or bbps_transverse in ('0', '1', '2', '3')),
  bbps_left text check (bbps_left is null or bbps_left in ('0', '1', '2', '3')),
  bbps_total integer,
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_procedures_subject_idx
  on public.vilo_procedures (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Findings
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  finding_type text check (
    finding_type is null or finding_type in ('POLYP', 'AA', 'CRC', 'OTHER')
  ),
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_findings_subject_idx
  on public.vilo_findings (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- TNM
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_tnm (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  tnm_m_status text check (
    tnm_m_status is null or tnm_m_status in ('M0', 'M1', 'M1a', 'M1b', 'Mx')
  ),
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_tnm_subject_idx
  on public.vilo_tnm (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Plasma aliquots / central lab
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_plasma_aliquots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  hemolysis_grade text check (
    hemolysis_grade is null
    or hemolysis_grade in ('1_NONE', '2_SLIGHT', '3_MODERATE', '4_HEMOLYZED')
  ),
  aliquot_count integer check (aliquot_count is null or (aliquot_count >= 1 and aliquot_count <= 10)),
  sample_status text check (sample_status is null or sample_status in ('ACCEPTED', 'REJECTED', 'PENDING')),
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_plasma_aliquots_subject_idx
  on public.vilo_plasma_aliquots (study_subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- IP supply
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_ip_supply (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  procedure_execution_id uuid references public.procedure_executions (id) on delete set null,
  ip_kit_id text not null,
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_ip_supply_kit_idx
  on public.vilo_ip_supply (study_id, ip_kit_id);

-- ---------------------------------------------------------------------------
-- Site delegation
-- ---------------------------------------------------------------------------

create table if not exists public.vilo_site_delegation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  delegation_role text check (
    delegation_role is null or delegation_role in ('PI', 'SUB-I', 'CRC', 'Pharmacist')
  ),
  signature_state text not null default 'UNSIGNED'
    check (signature_state in ('UNSIGNED', 'SIGNED', 'BROKEN', 'LOCKED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vilo_site_delegation_study_idx
  on public.vilo_site_delegation (study_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: scope + updated_at
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'vilo_demographics',
    'vilo_vitals',
    'vilo_procedures',
    'vilo_findings',
    'vilo_tnm',
    'vilo_plasma_aliquots',
    'vilo_ip_supply',
    'vilo_site_delegation'
  ]
  loop
    execute format('drop trigger if exists %I_enforce_scope on public.%I', t, t);
    execute format(
      'create trigger %I_enforce_scope before insert or update of organization_id, study_id, study_subject_id, visit_id on public.%I for each row execute function public.vilo_engine_enforce_row_scope()',
      t,
      t
    );
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.generic_set_updated_at()',
      t,
      t
    );
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS policies (study-scoped read; coordinator write)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'vilo_demographics',
    'vilo_vitals',
    'vilo_procedures',
    'vilo_findings',
    'vilo_tnm',
    'vilo_plasma_aliquots',
    'vilo_ip_supply',
    'vilo_site_delegation'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      $p$
      create policy %I_select on public.%I
      for select using (
        organization_id in (select public.user_organization_ids())
        and (
          public.user_is_org_admin(organization_id)
          or public.user_has_study_access(study_id)
        )
      )
      $p$,
      t,
      t
    );

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      $p$
      create policy %I_insert on public.%I
      for insert with check (
        organization_id in (select public.user_organization_ids())
        and public.user_can_manage_subject_enrollment(study_id)
      )
      $p$,
      t,
      t
    );

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      $p$
      create policy %I_update on public.%I
      for update using (
        organization_id in (select public.user_organization_ids())
        and public.user_can_manage_subject_enrollment(study_id)
      ) with check (
        organization_id in (select public.user_organization_ids())
        and public.user_can_manage_subject_enrollment(study_id)
      )
      $p$,
      t,
      t
    );

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      $p$
      create policy %I_delete on public.%I
      for delete using (
        organization_id in (select public.user_organization_ids())
        and (
          public.user_is_org_admin(organization_id)
          or public.user_is_study_admin(study_id)
        )
      )
      $p$,
      t,
      t
    );
  end loop;
end;
$$;

comment on table public.vilo_demographics is
  'Vilo Engine demographics domain (sourcePath demo.*, pregnancy.*).';
comment on table public.vilo_vitals is
  'Vilo Engine vitals domain (sourcePath vitals.*).';
comment on table public.vilo_procedures is
  'Vilo Engine procedures domain (sourcePath proc.*).';
comment on table public.vilo_findings is
  'Vilo Engine findings domain (sourcePath finding.*).';
comment on table public.vilo_tnm is
  'Vilo Engine TNM domain (sourcePath tnm.*).';
comment on table public.vilo_plasma_aliquots is
  'Vilo Engine plasma / central lab domain (sourcePath lab.*).';
comment on table public.vilo_ip_supply is
  'Vilo Engine IP supply domain (sourcePath supply.*).';
comment on table public.vilo_site_delegation is
  'Vilo Engine site delegation domain (sourcePath site.delegation.*).';
