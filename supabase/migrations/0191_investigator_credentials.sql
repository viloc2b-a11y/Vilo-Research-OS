-- Phase 19: Investigator credentials registry

CREATE TABLE IF NOT EXISTS public.investigator_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('cv','medical_license','gcp_certificate','iata_certificate','protocol_training','financial_disclosure_1572','fdf','other')),
  study_id UUID REFERENCES public.studies(id) ON DELETE SET NULL,
  issue_date DATE,
  expiration_date DATE,
  credential_number TEXT,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current','expiring_soon','expired','pending','waived')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigator_credentials_user_idx ON public.investigator_credentials(user_id);
CREATE INDEX IF NOT EXISTS investigator_credentials_org_status_idx ON public.investigator_credentials(organization_id, status);
CREATE INDEX IF NOT EXISTS investigator_credentials_expiration_idx ON public.investigator_credentials(expiration_date)
  WHERE status NOT IN ('expired','waived');

ALTER TABLE public.investigator_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investigator_credentials_select ON public.investigator_credentials;
CREATE POLICY investigator_credentials_select ON public.investigator_credentials
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS investigator_credentials_insert ON public.investigator_credentials;
CREATE POLICY investigator_credentials_insert ON public.investigator_credentials
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS investigator_credentials_update ON public.investigator_credentials;
CREATE POLICY investigator_credentials_update ON public.investigator_credentials
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

COMMENT ON TABLE public.investigator_credentials IS
  'Staff and investigator credentials per organization: CV, licenses, GCP, IATA, trainings, disclosures.';
