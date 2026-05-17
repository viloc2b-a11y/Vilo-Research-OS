-- Phase 6B.1B — Idempotent bulk seed support indexes (dedupe keys for upsert scripts).
-- Does not change table architecture. Data loaded via npm run db:seed-phase6b1b-patient-libraries.

create unique index if not exists pathology_library_common_name_icd_unique on public.pathology_library (
  lower(
    trim(
      both
      from
        common_name
    )
  ),
  coalesce(icd10_code, '')
);

create unique index if not exists medication_library_name_route_form_unique on public.medication_library (
  lower(
    trim(
      both
      from
        medication_name
    )
  ),
  coalesce(route, ''),
  coalesce(dosage_form, '')
);

-- Allow dedupe by pathology + medication + relation_type (Phase 6B.1B seed script).
alter table public.pathology_medication_links
drop constraint if exists pathology_medication_links_unique_pair;

create unique index if not exists pathology_medication_links_pathology_med_type_unique on public.pathology_medication_links (
  pathology_id,
  medication_id,
  coalesce(relation_type, '')
);

comment on index public.pathology_library_common_name_icd_unique is
  'Phase 6B.1B: idempotent pathology upsert key (lower common_name + ICD).';

comment on index public.medication_library_name_route_form_unique is
  'Phase 6B.1B: idempotent medication upsert key (lower name + route + dosage form).';
