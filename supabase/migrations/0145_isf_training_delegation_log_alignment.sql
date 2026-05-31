-- Phase 24: ISF Training and Delegation Log alignment
-- Keeps site-level ISF logs compatible with centralized operational signatures.

ALTER TABLE public.study_delegation_log
  ADD COLUMN IF NOT EXISTS delegatee_name text,
  ADD COLUMN IF NOT EXISTS pi_initials text,
  ADD COLUMN IF NOT EXISTS isf_location text NOT NULL DEFAULT 'Investigator and Site Documentation',
  ADD COLUMN IF NOT EXISTS document_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS date_created date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS last_updated date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.study_protocol_trainings
  ADD COLUMN IF NOT EXISTS instructor_name text,
  ADD COLUMN IF NOT EXISTS instructor_initials text,
  ADD COLUMN IF NOT EXISTS certificate_number text,
  ADD COLUMN IF NOT EXISTS isf_location text NOT NULL DEFAULT 'Training Documentation',
  ADD COLUMN IF NOT EXISTS document_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS date_created date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS last_updated date NOT NULL DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.study_isf_log_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  log_type text NOT NULL CHECK (log_type IN ('delegation', 'training')),
  log_record_id uuid,
  change_date date NOT NULL DEFAULT CURRENT_DATE,
  change_description text NOT NULL,
  changed_by_user_id uuid REFERENCES auth.users(id),
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_isf_log_change_history_study
  ON public.study_isf_log_change_history(study_id, log_type, change_date DESC);

ALTER TABLE public.study_isf_log_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isf_log_change_history_select ON public.study_isf_log_change_history;
CREATE POLICY isf_log_change_history_select ON public.study_isf_log_change_history
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS isf_log_change_history_insert ON public.study_isf_log_change_history;
CREATE POLICY isf_log_change_history_insert ON public.study_isf_log_change_history
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS duty_insert ON public.study_delegation_duties;
CREATE POLICY duty_insert ON public.study_delegation_duties
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS duty_update ON public.study_delegation_duties;
CREATE POLICY duty_update ON public.study_delegation_duties
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS del_log_insert ON public.study_delegation_log;
CREATE POLICY del_log_insert ON public.study_delegation_log
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS del_log_update ON public.study_delegation_log;
CREATE POLICY del_log_update ON public.study_delegation_log
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS del_duty_insert ON public.study_delegation_log_duties;
CREATE POLICY del_duty_insert ON public.study_delegation_log_duties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_delegation_log l
      WHERE l.id = delegation_log_id
        AND l.organization_id IN (SELECT public.user_organization_ids())
        AND public.user_has_study_access(l.study_id)
    )
  );

-- Rebuild training matrix after 0143 replaced primitive signed_at columns
-- with centralized operational_signature_requests references.
CREATE OR REPLACE VIEW public.vw_study_training_matrix AS
SELECT
  a.id AS assignment_id,
  a.organization_id,
  t.study_id,
  a.trainee_user_id,
  t.id AS training_id,
  t.training_title,
  a.training_status,
  trainee_sig.status AS trainee_signature_status,
  trainer_sig.status AS trainer_signature_status,
  (
    a.training_status = 'Completed'
    AND trainee_sig.status = 'signed'
    AND (
      a.trainer_signature_required = false
      OR trainer_sig.status = 'signed'
    )
  ) AS is_eligible
FROM public.study_protocol_training_assignments a
JOIN public.study_protocol_trainings t ON t.id = a.training_id
LEFT JOIN public.operational_signature_requests trainee_sig
  ON trainee_sig.id = a.trainee_signature_request_id
LEFT JOIN public.operational_signature_requests trainer_sig
  ON trainer_sig.id = a.trainer_signature_request_id;

COMMENT ON TABLE public.study_isf_log_change_history IS
  'Version control/change history for ISF delegation and training logs.';

COMMENT ON VIEW public.vw_study_training_matrix IS
  'Training eligibility matrix using centralized operational signature request status.';
