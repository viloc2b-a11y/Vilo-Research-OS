-- Phase 6B.4: coordinator operational visit grid fields on public.visits

alter table public.visit_definitions
  add column if not exists target_day integer;

comment on column public.visit_definitions.target_day is
  'Protocol target day for schedule display (e.g. Day 1, Day 14).';

alter table public.visits
  add column if not exists visit_day integer,
  add column if not exists window_start date,
  add column if not exists window_end date,
  add column if not exists source_status text not null default 'not_started',
  add column if not exists edc_status text not null default 'pending',
  add column if not exists qc_status text not null default 'pending',
  add column if not exists review_status text not null default 'pending',
  add column if not exists subject_payment text not null default 'pending',
  add column if not exists coordinator_note text;

alter table public.visits drop constraint if exists visits_source_status_check;
alter table public.visits add constraint visits_source_status_check check (
  source_status in ('not_started', 'draft', 'submitted', 'corrected', 'signed')
);

alter table public.visits drop constraint if exists visits_edc_status_check;
alter table public.visits add constraint visits_edc_status_check check (
  edc_status in ('pending', 'entered', 'verified')
);

alter table public.visits drop constraint if exists visits_qc_status_check;
alter table public.visits add constraint visits_qc_status_check check (
  qc_status in ('pending', 'entered', 'verified')
);

alter table public.visits drop constraint if exists visits_review_status_check;
alter table public.visits add constraint visits_review_status_check check (
  review_status in ('pending', 'in_review', 'complete')
);

alter table public.visits drop constraint if exists visits_subject_payment_check;
alter table public.visits add constraint visits_subject_payment_check check (
  subject_payment in ('pending', 'scheduled', 'paid', 'waived', 'n/a')
);

alter table public.visits drop constraint if exists visits_visit_status_check;

alter table public.visits add constraint visits_visit_status_check check (
  visit_status in (
    'scheduled',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'missed',
    'out_of_window',
    'locked'
  )
);

create index if not exists visits_subject_scheduled_idx
  on public.visits (study_subject_id, scheduled_date);
