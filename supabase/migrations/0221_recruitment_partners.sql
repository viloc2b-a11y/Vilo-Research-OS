-- Migration 0221: Recruitment Partner Management
-- Adds recruitment_partners table with RLS matching the pattern from 0219.
-- Also adds optional partner_id FK to recruitment_campaigns.

-- ============================================================
-- recruitment_partners table
-- ============================================================

CREATE TABLE recruitment_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  partner_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recruitment_partners_org ON recruitment_partners (organization_id);
CREATE INDEX idx_recruitment_partners_status ON recruitment_partners (organization_id, status);

DROP TRIGGER IF EXISTS trg_recruitment_partners_updated_at ON recruitment_partners;
CREATE TRIGGER trg_recruitment_partners_updated_at
  BEFORE UPDATE ON recruitment_partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS — same helper functions as 0219
-- ============================================================

ALTER TABLE recruitment_partners ENABLE ROW LEVEL SECURITY;

-- SELECT: org members with CRM access can read partners for their org
DROP POLICY IF EXISTS recruitment_partners_select ON recruitment_partners;
CREATE POLICY recruitment_partners_select ON recruitment_partners
  FOR SELECT TO authenticated
  USING (public.crm_user_can_access_patient_crm(organization_id, NULL));

-- INSERT: only CRM managers can create partners for their org
DROP POLICY IF EXISTS recruitment_partners_insert ON recruitment_partners;
CREATE POLICY recruitment_partners_insert ON recruitment_partners
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_user_can_manage_patient_crm(organization_id));

-- UPDATE: only CRM managers can update partners for their org
DROP POLICY IF EXISTS recruitment_partners_update ON recruitment_partners;
CREATE POLICY recruitment_partners_update ON recruitment_partners
  FOR UPDATE TO authenticated
  USING (public.crm_user_can_manage_patient_crm(organization_id))
  WITH CHECK (public.crm_user_can_manage_patient_crm(organization_id));

-- DELETE: only CRM managers can delete partners for their org
DROP POLICY IF EXISTS recruitment_partners_delete ON recruitment_partners;
CREATE POLICY recruitment_partners_delete ON recruitment_partners
  FOR DELETE TO authenticated
  USING (public.crm_user_can_manage_patient_crm(organization_id));

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_partners TO authenticated;

-- ============================================================
-- Add optional partner_id FK to recruitment_campaigns
-- ============================================================

ALTER TABLE recruitment_campaigns
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES recruitment_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_partner ON recruitment_campaigns (partner_id)
  WHERE partner_id IS NOT NULL;
