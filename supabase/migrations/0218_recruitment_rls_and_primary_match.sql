-- Migration 0218: Recruitment RLS and primary match flag
-- Applies two blocking pre-requisites for the Recruitment Command Center (Phase 3):
--   A) RLS + grants on patient_lead_contact_log (table created in 0217 with no policies)
--   B) is_primary column + index on patient_study_matches

-- ============================================================
-- Part A: Extend contact outcome enum with 'other' value
-- (0217 did not include 'other'; Phase 3 spec requires it)
-- ============================================================

ALTER TYPE public.lead_contact_outcome ADD VALUE IF NOT EXISTS 'other';

-- ============================================================
-- Part B: patient_lead_contact_log RLS and grants
-- ============================================================

ALTER TABLE public.patient_lead_contact_log ENABLE ROW LEVEL SECURITY;

-- Coordinators and staff who can access the patient CRM can read contact logs
DROP POLICY IF EXISTS contact_log_select ON public.patient_lead_contact_log;
CREATE POLICY contact_log_select ON public.patient_lead_contact_log
  FOR SELECT TO authenticated
  USING (public.crm_user_can_access_patient_crm(organization_id, NULL));

-- Only users who can manage the patient CRM can insert contact log entries
DROP POLICY IF EXISTS contact_log_insert ON public.patient_lead_contact_log;
CREATE POLICY contact_log_insert ON public.patient_lead_contact_log
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_user_can_manage_patient_crm(organization_id));

GRANT SELECT, INSERT ON public.patient_lead_contact_log TO authenticated;

-- ============================================================
-- Part B: patient_study_matches.is_primary column and index
-- ============================================================

ALTER TABLE public.patient_study_matches
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Partial index to speed up "find current primary match for a lead" queries
CREATE INDEX IF NOT EXISTS patient_study_matches_primary_idx
  ON public.patient_study_matches (patient_lead_id, is_primary)
  WHERE is_primary = true;
