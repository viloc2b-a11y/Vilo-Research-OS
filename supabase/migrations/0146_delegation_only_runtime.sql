-- Delegation-only runtime.
-- Scope: study_delegation_log only. Does not create or alter Training, Visit Runtime, or Procedure tables.

CREATE TABLE IF NOT EXISTS public.study_delegation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES auth.users(id),
  delegatee_name text NOT NULL,
  staff_role text NOT NULL,
  staff_initials text NOT NULL,
  pi_delegator_id uuid NOT NULL REFERENCES auth.users(id),
  pi_initials text NOT NULL,
  task_labels text[] NOT NULL DEFAULT '{}'::text[],
  delegation_date date NOT NULL DEFAULT CURRENT_DATE,
  delegation_start_date date NOT NULL DEFAULT CURRENT_DATE,
  delegation_stop_date date,
  is_ongoing boolean NOT NULL DEFAULT true,
  delegation_status text NOT NULL DEFAULT 'Pending Staff Signature',
  staff_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amendment_required_reason text,
  isf_location text NOT NULL DEFAULT 'Investigator and Site Documentation',
  document_version text NOT NULL DEFAULT '1.0',
  date_created date NOT NULL DEFAULT CURRENT_DATE,
  last_updated date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegation_log_status_check CHECK (
    delegation_status IN (
      'Pending Staff Signature',
      'Pending PI Signature',
      'Ready for PI Signature',
      'Active',
      'Locked',
      'Inactive',
      'Expired',
      'Revoked'
    )
  ),
  CONSTRAINT delegation_task_labels_required CHECK (array_length(task_labels, 1) > 0),
  CONSTRAINT delegation_ongoing_check CHECK (
    (is_ongoing = true AND delegation_stop_date IS NULL)
    OR (is_ongoing = false AND delegation_stop_date IS NOT NULL)
  )
);

ALTER TABLE public.study_delegation_log
  ADD COLUMN IF NOT EXISTS delegatee_name text,
  ADD COLUMN IF NOT EXISTS staff_initials text,
  ADD COLUMN IF NOT EXISTS pi_initials text,
  ADD COLUMN IF NOT EXISTS task_labels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS staff_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amendment_required_reason text,
  ADD COLUMN IF NOT EXISTS isf_location text NOT NULL DEFAULT 'Investigator and Site Documentation',
  ADD COLUMN IF NOT EXISTS document_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS date_created date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS last_updated date NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_study_delegation_log_study
  ON public.study_delegation_log(study_id);
CREATE INDEX IF NOT EXISTS idx_study_delegation_log_staff
  ON public.study_delegation_log(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_delegation_staff_sig_req
  ON public.study_delegation_log(staff_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_delegation_pi_sig_req
  ON public.study_delegation_log(pi_signature_request_id);

CREATE TABLE IF NOT EXISTS public.study_delegation_log_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  delegation_log_id uuid NOT NULL REFERENCES public.study_delegation_log(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_delegation_log_audit_log
  ON public.study_delegation_log_audit(delegation_log_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.study_delegation_log_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.last_updated := CURRENT_DATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_delegation_log_touch_updated_at
  ON public.study_delegation_log;
CREATE TRIGGER study_delegation_log_touch_updated_at
BEFORE UPDATE ON public.study_delegation_log
FOR EACH ROW EXECUTE FUNCTION public.study_delegation_log_touch_updated_at();

CREATE OR REPLACE FUNCTION public.study_delegation_log_prevent_locked_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.delegation_status IN ('Active', 'Locked') THEN
    RAISE EXCEPTION 'delegation log is locked; create an audited amendment/reopen workflow before editing';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_delegation_log_prevent_locked_update
  ON public.study_delegation_log;
CREATE TRIGGER study_delegation_log_prevent_locked_update
BEFORE UPDATE ON public.study_delegation_log
FOR EACH ROW
WHEN (OLD.delegation_status IN ('Active', 'Locked'))
EXECUTE FUNCTION public.study_delegation_log_prevent_locked_mutation();

ALTER TABLE public.study_delegation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_delegation_log_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS del_log_select ON public.study_delegation_log;
CREATE POLICY del_log_select ON public.study_delegation_log
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
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

DROP POLICY IF EXISTS del_log_audit_select ON public.study_delegation_log_audit;
CREATE POLICY del_log_audit_select ON public.study_delegation_log_audit
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS del_log_audit_insert ON public.study_delegation_log_audit;
CREATE POLICY del_log_audit_insert ON public.study_delegation_log_audit
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

COMMENT ON TABLE public.study_delegation_log IS
  'Delegation-only ISF log. Staff/PI signatures are centralized in operational_signature_requests.';
