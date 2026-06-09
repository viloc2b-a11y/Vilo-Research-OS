-- Phase 17: Study Setup Wizard Foundation (P0 Blockers)
-- Extends existing study_members for Delegation Log and adds Enrollment Configuration.

-- 1. Extend study_members for Delegation Log
ALTER TABLE public.study_members
  ADD COLUMN IF NOT EXISTS clinical_role text,
  ADD COLUMN IF NOT EXISTS delegation_scope text,
  ADD COLUMN IF NOT EXISTS can_perform boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_sign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unblinded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delegation_start_date date,
  ADD COLUMN IF NOT EXISTS delegation_end_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pi_approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pi_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pi_approved_at timestamptz;

-- 2. Create Study Enrollment Configs
CREATE TABLE IF NOT EXISTS public.study_enrollment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE UNIQUE,
  enrollment_target integer,
  site_enrollment_cap integer,
  screening_number_format text NOT NULL DEFAULT 'SCR-{N}',
  subject_number_format text NOT NULL DEFAULT 'SUB-{N}',
  randomization_required boolean NOT NULL DEFAULT false,
  randomization_number_format text,
  randomization_method text,
  randomization_ratio text,
  stratification_factors text[],
  enrollment_start_date date,
  enrollment_end_date date,
  screen_failure_handling text,
  replacement_subject_allowed boolean NOT NULL DEFAULT false,
  cohort_enrollment_support boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_enrollment_configs_org ON public.study_enrollment_configs(organization_id);

ALTER TABLE public.study_enrollment_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrollment_configs_select ON public.study_enrollment_configs;
CREATE POLICY enrollment_configs_select ON public.study_enrollment_configs
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS enrollment_configs_insert ON public.study_enrollment_configs;
CREATE POLICY enrollment_configs_insert ON public.study_enrollment_configs
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_is_study_admin(study_id)
  );

DROP POLICY IF EXISTS enrollment_configs_update ON public.study_enrollment_configs;
CREATE POLICY enrollment_configs_update ON public.study_enrollment_configs
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_is_study_admin(study_id)
  );

-- 3. Trigger for updated_at
DROP TRIGGER IF EXISTS set_study_enrollment_configs_updated_at ON public.study_enrollment_configs;
CREATE TRIGGER set_study_enrollment_configs_updated_at
  BEFORE UPDATE ON public.study_enrollment_configs
  FOR EACH ROW EXECUTE FUNCTION public.studies_set_updated_at();

-- 4. Study Status transition 'setup_in_progress', 'ready_for_activation'
-- Actually, the constraint in 0003 is: check (status in ('draft', 'active', 'paused', 'closed'))
-- We need to drop and recreate the constraint to allow setup_in_progress, ready_for_activation
ALTER TABLE public.studies DROP CONSTRAINT IF EXISTS studies_status_check;
ALTER TABLE public.studies ADD CONSTRAINT studies_status_check CHECK (status IN ('draft', 'setup_in_progress', 'ready_for_activation', 'active', 'paused', 'closed', 'archived'));
