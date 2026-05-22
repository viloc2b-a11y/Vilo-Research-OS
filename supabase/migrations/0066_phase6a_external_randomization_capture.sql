-- Phase 6A: External randomization record capture only.
-- Vilo OS records IWRS/RTSM confirmation evidence; it does not randomize subjects.

alter table public.study_subjects
  add column if not exists randomization_date_time timestamptz,
  add column if not exists external_iwrs_rtsm_reference text;

comment on column public.study_subjects.randomization_date_time is
  'External IWRS/RTSM randomization date/time recorded by the site. Vilo OS does not assign randomization.';

comment on column public.study_subjects.external_iwrs_rtsm_reference is
  'External IWRS/RTSM/sponsor confirmation reference recorded by the site.';
