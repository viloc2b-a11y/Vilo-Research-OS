-- Migration 0219: Recruitment Ecosystem Foundation Hardening
-- Phase 5 PR1 prerequisites:
--   A) RLS + grants on recruitment_campaigns
--   B) RLS + grants on campaign_studies (scoped via campaign → organization_id join)
--   C) referral_code column on contact_referral_relationships
--   D) utm_source and utm_medium columns on patient_leads

-- ============================================================
-- Part A: recruitment_campaigns — RLS and grants
-- ============================================================

ALTER TABLE public.recruitment_campaigns ENABLE ROW LEVEL SECURITY;

-- Any CRM-capable user in the org can read campaigns for their org
DROP POLICY IF EXISTS recruitment_campaigns_select ON public.recruitment_campaigns;
CREATE POLICY recruitment_campaigns_select ON public.recruitment_campaigns
  FOR SELECT TO authenticated
  USING (public.crm_user_can_access_patient_crm(organization_id, NULL));

-- Only CRM managers can insert, update, or delete campaigns
DROP POLICY IF EXISTS recruitment_campaigns_insert ON public.recruitment_campaigns;
CREATE POLICY recruitment_campaigns_insert ON public.recruitment_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_user_can_manage_patient_crm(organization_id));

DROP POLICY IF EXISTS recruitment_campaigns_update ON public.recruitment_campaigns;
CREATE POLICY recruitment_campaigns_update ON public.recruitment_campaigns
  FOR UPDATE TO authenticated
  USING (public.crm_user_can_manage_patient_crm(organization_id))
  WITH CHECK (public.crm_user_can_manage_patient_crm(organization_id));

DROP POLICY IF EXISTS recruitment_campaigns_delete ON public.recruitment_campaigns;
CREATE POLICY recruitment_campaigns_delete ON public.recruitment_campaigns
  FOR DELETE TO authenticated
  USING (public.crm_user_can_manage_patient_crm(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruitment_campaigns TO authenticated;

-- ============================================================
-- Part B: campaign_studies — RLS and grants (scoped via campaign)
-- ============================================================

ALTER TABLE public.campaign_studies ENABLE ROW LEVEL SECURITY;

-- SELECT: user can see campaign_studies if they can see the associated campaign
DROP POLICY IF EXISTS campaign_studies_select ON public.campaign_studies;
CREATE POLICY campaign_studies_select ON public.campaign_studies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recruitment_campaigns rc
      WHERE rc.id = campaign_id
        AND public.crm_user_can_access_patient_crm(rc.organization_id, NULL)
    )
  );

-- INSERT: user must be able to manage CRM for the org owning the campaign
DROP POLICY IF EXISTS campaign_studies_insert ON public.campaign_studies;
CREATE POLICY campaign_studies_insert ON public.campaign_studies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruitment_campaigns rc
      WHERE rc.id = campaign_id
        AND public.crm_user_can_manage_patient_crm(rc.organization_id)
    )
  );

-- UPDATE: same CRM management check via campaign
DROP POLICY IF EXISTS campaign_studies_update ON public.campaign_studies;
CREATE POLICY campaign_studies_update ON public.campaign_studies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recruitment_campaigns rc
      WHERE rc.id = campaign_id
        AND public.crm_user_can_manage_patient_crm(rc.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruitment_campaigns rc
      WHERE rc.id = campaign_id
        AND public.crm_user_can_manage_patient_crm(rc.organization_id)
    )
  );

-- DELETE: same CRM management check via campaign
DROP POLICY IF EXISTS campaign_studies_delete ON public.campaign_studies;
CREATE POLICY campaign_studies_delete ON public.campaign_studies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recruitment_campaigns rc
      WHERE rc.id = campaign_id
        AND public.crm_user_can_manage_patient_crm(rc.organization_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_studies TO authenticated;

-- ============================================================
-- Part C: Add referral_code to contact_referral_relationships
-- ============================================================

ALTER TABLE public.contact_referral_relationships
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_relationships_code
  ON public.contact_referral_relationships (referral_code)
  WHERE referral_code IS NOT NULL;

-- ============================================================
-- Part D: Add utm_source and utm_medium to patient_leads
-- ============================================================

ALTER TABLE public.patient_leads
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT;
