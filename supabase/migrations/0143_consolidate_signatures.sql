-- Phase 23: Consolidate Signature Implementations
-- This migration drops primitive signature text fields and replaces them with
-- references to the centralized operational_signature_requests platform.

-- 1. Update Protocol Delegation Log
ALTER TABLE public.study_delegation_log
  DROP COLUMN IF EXISTS staff_signed_at,
  DROP COLUMN IF EXISTS pi_signed_at,
  ADD COLUMN IF NOT EXISTS staff_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delegation_staff_sig_req ON public.study_delegation_log(staff_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_delegation_pi_sig_req ON public.study_delegation_log(pi_signature_request_id);


-- 2. Update Protocol Training Assignments Log
-- 0139 creates this view over primitive signed_at fields. Drop it before
-- removing those fields, then rebuild it against centralized signatures.
DROP VIEW IF EXISTS public.vw_study_training_matrix;

ALTER TABLE public.study_protocol_training_assignments
  DROP COLUMN IF EXISTS trainee_signature,
  DROP COLUMN IF EXISTS trainee_signed_at,
  DROP COLUMN IF EXISTS trainer_signature,
  DROP COLUMN IF EXISTS trainer_signed_at,
  DROP COLUMN IF EXISTS pi_signature,
  DROP COLUMN IF EXISTS pi_signed_at,
  ADD COLUMN IF NOT EXISTS trainee_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trainer_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ptraining_trainee_sig_req ON public.study_protocol_training_assignments(trainee_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_ptraining_trainer_sig_req ON public.study_protocol_training_assignments(trainer_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_ptraining_pi_sig_req ON public.study_protocol_training_assignments(pi_signature_request_id);

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

COMMENT ON VIEW public.vw_study_training_matrix IS
  'Training eligibility matrix using centralized operational signature request status.';

-- Note: The operational_signature_requests table has status 'signed' when complete.
-- Triggers and server actions will now query the centralized signature service
-- using these foreign keys to determine signature completion, instead of relying
-- on primitive string fields.
