-- Phase 22: Subject Enrollment & Profile Extension

-- 1. Extend study_subjects with required contact and demographic fields
ALTER TABLE public.study_subjects
  ADD COLUMN IF NOT EXISTS screening_number text,
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS screening_date date,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('Male', 'Female', 'Unknown', 'Undifferentiated')),
  ADD COLUMN IF NOT EXISTS race text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS primary_language text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS preferred_contact_method text,
  ADD COLUMN IF NOT EXISTS permission_to_text boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS permission_to_email boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS best_time_to_contact text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_email text,
  ADD COLUMN IF NOT EXISTS assigned_coordinator_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recruitment_source text,
  ADD COLUMN IF NOT EXISTS enrollment_notes text;

-- 2. Add Unique Constraints for numbers within a study
-- Only enforce uniqueness if the field is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_subjects_subject_id_study ON public.study_subjects(study_id, subject_identifier) WHERE subject_identifier IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_subjects_screening_id_study ON public.study_subjects(study_id, screening_number) WHERE screening_number IS NOT NULL;
