-- Create surgical_procedure_library
create table if not exists public.surgical_procedure_library (
  id uuid primary key default gen_random_uuid (),
  code text not null unique,
  label text not null,
  category text,
  source text not null default 'VILO_STANDARD',
  is_active boolean not null default true,
  created_at timestamptz not null default now ()
);

-- Seed surgical procedures
insert into public.surgical_procedure_library (code, label, category) values
  ('APPENDECTOMY', 'Appendectomy', 'General'),
  ('CHOLECYSTECTOMY', 'Cholecystectomy', 'General'),
  ('CABG', 'Coronary Artery Bypass Graft (CABG)', 'Cardiovascular'),
  ('HIP_REPLACEMENT', 'Total Hip Replacement', 'Orthopedic'),
  ('KNEE_REPLACEMENT', 'Total Knee Replacement', 'Orthopedic'),
  ('TONSILLECTOMY', 'Tonsillectomy', 'ENT'),
  ('CATARACT_SURGERY', 'Cataract Surgery', 'Ophthalmology')
on conflict (code) do nothing;

-- Create ae_controlled_terms
create table if not exists public.ae_controlled_terms (
  id uuid primary key default gen_random_uuid (),
  term_group text not null,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now (),
  unique(term_group, code)
);

-- Seed AE severity
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('AE_SEVERITY', 'MILD', 'Mild', 1),
  ('AE_SEVERITY', 'MODERATE', 'Moderate', 2),
  ('AE_SEVERITY', 'SEVERE', 'Severe', 3),
  ('AE_SEVERITY', 'LIFE_THREATENING', 'Life-threatening', 4),
  ('AE_SEVERITY', 'FATAL', 'Fatal', 5)
on conflict (term_group, code) do nothing;

-- Seed AE relatedness
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('AE_RELATEDNESS', 'NOT_RELATED', 'Not Related', 1),
  ('AE_RELATEDNESS', 'UNLIKELY', 'Unlikely Related', 2),
  ('AE_RELATEDNESS', 'POSSIBLY', 'Possibly Related', 3),
  ('AE_RELATEDNESS', 'PROBABLY', 'Probably Related', 4),
  ('AE_RELATEDNESS', 'DEFINITELY', 'Definitely Related', 5)
on conflict (term_group, code) do nothing;

-- Seed AE outcome
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('AE_OUTCOME', 'RECOVERED', 'Recovered/Resolved', 1),
  ('AE_OUTCOME', 'RECOVERING', 'Recovering/Resolving', 2),
  ('AE_OUTCOME', 'NOT_RECOVERED', 'Not Recovered/Not Resolved', 3),
  ('AE_OUTCOME', 'RECOVERED_WITH_SEQUELAE', 'Recovered/Resolved with Sequelae', 4),
  ('AE_OUTCOME', 'FATAL', 'Fatal', 5),
  ('AE_OUTCOME', 'UNKNOWN', 'Unknown', 6)
on conflict (term_group, code) do nothing;

-- Seed AE action taken
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('AE_ACTION_TAKEN', 'DOSE_NOT_CHANGED', 'Dose Not Changed', 1),
  ('AE_ACTION_TAKEN', 'DOSE_REDUCED', 'Dose Reduced', 2),
  ('AE_ACTION_TAKEN', 'DOSE_INCREASED', 'Dose Increased', 3),
  ('AE_ACTION_TAKEN', 'DRUG_INTERRUPTED', 'Drug Interrupted', 4),
  ('AE_ACTION_TAKEN', 'DRUG_WITHDRAWN', 'Drug Withdrawn', 5),
  ('AE_ACTION_TAKEN', 'NOT_APPLICABLE', 'Not Applicable', 6),
  ('AE_ACTION_TAKEN', 'UNKNOWN', 'Unknown', 7)
on conflict (term_group, code) do nothing;

-- Seed SERIOUSNESS
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('SERIOUSNESS', 'YES', 'Yes', 1),
  ('SERIOUSNESS', 'NO', 'No', 2)
on conflict (term_group, code) do nothing;

-- Seed EXPECTEDNESS
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('EXPECTEDNESS', 'EXPECTED', 'Expected', 1),
  ('EXPECTEDNESS', 'UNEXPECTED', 'Unexpected', 2)
on conflict (term_group, code) do nothing;

-- Seed AE TYPE
insert into public.ae_controlled_terms (term_group, code, label, sort_order) values
  ('AE_TYPE', 'ADVERSE_EVENT', 'Adverse Event (AE)', 1),
  ('AE_TYPE', 'SERIOUS_ADVERSE_EVENT', 'Serious Adverse Event (SAE)', 2),
  ('AE_TYPE', 'ADVERSE_DEVICE_EFFECT', 'Adverse Device Effect (ADE)', 3)
on conflict (term_group, code) do nothing;

-- Enable RLS for new tables
alter table public.surgical_procedure_library enable row level security;
alter table public.ae_controlled_terms enable row level security;

drop policy if exists surgical_procedure_library_select_auth on public.surgical_procedure_library;
create policy surgical_procedure_library_select_auth on public.surgical_procedure_library for select to authenticated using (is_active = true);

drop policy if exists ae_controlled_terms_select_auth on public.ae_controlled_terms;
create policy ae_controlled_terms_select_auth on public.ae_controlled_terms for select to authenticated using (is_active = true);
