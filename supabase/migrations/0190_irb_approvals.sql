-- Phase 19: IRB Approvals registry

CREATE TABLE IF NOT EXISTS public.irb_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('initial','continuing_review','amendment','safety_report','deviation_report')),
  approval_number TEXT,
  approved_date DATE NOT NULL,
  expiration_date DATE,
  submission_date DATE,
  next_renewal_due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','pending_renewal','superseded')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS irb_approvals_study_idx ON public.irb_approvals(study_id);
CREATE INDEX IF NOT EXISTS irb_approvals_org_status_idx ON public.irb_approvals(organization_id, status);

ALTER TABLE public.irb_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS irb_approvals_select ON public.irb_approvals;
CREATE POLICY irb_approvals_select ON public.irb_approvals
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS irb_approvals_insert ON public.irb_approvals;
CREATE POLICY irb_approvals_insert ON public.irb_approvals
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS irb_approvals_update ON public.irb_approvals;
CREATE POLICY irb_approvals_update ON public.irb_approvals
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

COMMENT ON TABLE public.irb_approvals IS
  'IRB approval records per study: initial, continuing review, amendments, safety reports, deviation reports.';
