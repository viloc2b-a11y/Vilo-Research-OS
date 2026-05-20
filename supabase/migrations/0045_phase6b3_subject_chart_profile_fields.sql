-- Phase 6B.3 — Subject Chart / Subject Profile shell fields.
-- Minimal additive profile fields for coordinator-facing subject chart.

alter table public.study_subjects
  add column if not exists randomization_number text,
  add column if not exists first_name text,
  add column if not exists middle_initial text,
  add column if not exists last_name text,
  add column if not exists initials text,
  add column if not exists gender text,
  add column if not exists date_of_birth date;

alter table public.study_subjects
  drop constraint if exists study_subjects_enrollment_status_check;

alter table public.study_subjects
  add constraint study_subjects_enrollment_status_check
  check (
    enrollment_status in (
      'screening',
      'screen_failed',
      'enrolled',
      'randomized',
      'completed',
      'withdrawn'
    )
  );

comment on column public.study_subjects.subject_identifier is
  'Coordinator-facing subject number / site subject identifier.';

comment on column public.study_subjects.randomization_arm is
  'Coordinator-facing study arm. Named from the Phase 2 enrollment registry.';

