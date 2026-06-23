-- Migration 0229: Activity → System Recommendations
-- Deterministic recommendation engine: suggests the most appropriate study
-- system for an activity based on the systems already registered for the study.
--
-- This is NOT AI, NOT machine learning, NOT external APIs.
-- Pure deterministic operational assistance based on curated weight tables.

-- =============================================================================
-- 1. activity_system_recommendations table
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_system_recommendations (
  recommendation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_code text NOT NULL,
  system_library_id uuid NOT NULL REFERENCES system_library(system_id) ON DELETE CASCADE,
  recommendation_weight integer NOT NULL DEFAULT 100,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One default recommendation per activity code
  CONSTRAINT unique_default_per_activity UNIQUE (activity_code, is_default)
    DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_activity_recommendations_code ON activity_system_recommendations(activity_code);
CREATE INDEX IF NOT EXISTS idx_activity_recommendations_system ON activity_system_recommendations(system_library_id);
CREATE INDEX IF NOT EXISTS idx_activity_recommendations_weight ON activity_system_recommendations(activity_code, recommendation_weight DESC);

-- =============================================================================
-- 3. Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_activity_recommendations_updated_at ON activity_system_recommendations;
CREATE TRIGGER trg_activity_recommendations_updated_at
  BEFORE UPDATE ON activity_system_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 4. RLS — reference catalog (read-only from client)
-- =============================================================================

ALTER TABLE activity_system_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_recommendations_select ON activity_system_recommendations;
CREATE POLICY activity_recommendations_select ON activity_system_recommendations
  FOR SELECT
  USING (true);

-- Admin insert/update/delete only from server-side (service role)
DROP POLICY IF EXISTS activity_recommendations_insert ON activity_system_recommendations;
CREATE POLICY activity_recommendations_insert ON activity_system_recommendations
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS activity_recommendations_update ON activity_system_recommendations;
CREATE POLICY activity_recommendations_update ON activity_system_recommendations
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS activity_recommendations_delete ON activity_system_recommendations;
CREATE POLICY activity_recommendations_delete ON activity_system_recommendations
  FOR DELETE
  USING (false);

-- =============================================================================
-- 5. Grants
-- =============================================================================

GRANT SELECT ON activity_system_recommendations TO authenticated;

-- =============================================================================
-- 6. Seed recommendations (idempotent)
-- =============================================================================

DO $$
DECLARE
  -- Data Capture / EDC
  v_medidata_rave uuid;
  v_oracle_clinical_one uuid;
  v_veeva_edc uuid;
  v_castor_edc uuid;

  -- Labs
  v_labcorp uuid;
  v_quest uuid;
  v_iqvia_labs uuid;
  v_eurofins uuid;
  v_acm uuid;

  -- IRT / Randomization
  v_almac_irt uuid;
  v_iqvia_irt uuid;
  v_suvoda uuid;
  v_endpoint uuid;

  -- Payments
  v_greenphire uuid;
  v_iqvia_payments uuid;
  v_medidata_payments uuid;

  -- Safety
  v_veeva_safety uuid;
  v_oracle_argus uuid;

  -- IRB
  v_central_irb uuid;

  -- Document / eTMF
  v_florence_ebinder uuid;
  v_veeva_vault_etmf uuid;
  v_complion uuid;

  -- Training
  v_medable uuid;
BEGIN
  -- Resolve library IDs
  SELECT system_id INTO v_medidata_rave FROM system_library WHERE system_name = 'Medidata Rave';
  SELECT system_id INTO v_oracle_clinical_one FROM system_library WHERE system_name = 'Oracle Clinical One';
  SELECT system_id INTO v_veeva_edc FROM system_library WHERE system_name = 'Veeva EDC';
  SELECT system_id INTO v_castor_edc FROM system_library WHERE system_name = 'Castor EDC';
  SELECT system_id INTO v_labcorp FROM system_library WHERE system_name = 'Labcorp';
  SELECT system_id INTO v_quest FROM system_library WHERE system_name = 'Quest Diagnostics';
  SELECT system_id INTO v_iqvia_labs FROM system_library WHERE system_name = 'IQVIA Labs';
  SELECT system_id INTO v_eurofins FROM system_library WHERE system_name = 'Eurofins Central Lab';
  SELECT system_id INTO v_acm FROM system_library WHERE system_name = 'ACM Global Labs';
  SELECT system_id INTO v_almac_irt FROM system_library WHERE system_name = 'Almac IRT';
  SELECT system_id INTO v_iqvia_irt FROM system_library WHERE system_name = 'IQVIA IRT';
  SELECT system_id INTO v_suvoda FROM system_library WHERE system_name = 'Suvoda';
  SELECT system_id INTO v_endpoint FROM system_library WHERE system_name = 'Endpoint Clinical';
  SELECT system_id INTO v_greenphire FROM system_library WHERE system_name = 'Greenphire';
  SELECT system_id INTO v_iqvia_payments FROM system_library WHERE system_name = 'IQVIA Payments';
  SELECT system_id INTO v_medidata_payments FROM system_library WHERE system_name = 'Medidata Payments';
  SELECT system_id INTO v_veeva_safety FROM system_library WHERE system_name = 'Veeva Safety';
  SELECT system_id INTO v_oracle_argus FROM system_library WHERE system_name = 'Oracle Argus';
  SELECT system_id INTO v_central_irb FROM system_library WHERE system_name = 'Central IRB Portal';
  SELECT system_id INTO v_florence_ebinder FROM system_library WHERE system_name = 'Florence eBinder';
  SELECT system_id INTO v_veeva_vault_etmf FROM system_library WHERE system_name = 'Veeva Vault eTMF';
  SELECT system_id INTO v_complion FROM system_library WHERE system_name = 'Complion';
  SELECT system_id INTO v_medable FROM system_library WHERE system_name = 'Medable';

  -- Skip if library not seeded
  IF v_medidata_rave IS NULL THEN RETURN; END IF;

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM activity_system_recommendations LIMIT 1) THEN
    RETURN;
  END IF;

  -- ── LAB_RESULT_REVIEW ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('LAB_RESULT_REVIEW', v_labcorp,    100, true),
    ('LAB_RESULT_REVIEW', v_quest,      90,  false),
    ('LAB_RESULT_REVIEW', v_iqvia_labs, 80,  false),
    ('LAB_RESULT_REVIEW', v_eurofins,   70,  false),
    ('LAB_RESULT_REVIEW', v_acm,        60,  false);

  -- ── DATA_QUERY_RESPONSE ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('DATA_QUERY_RESPONSE', v_medidata_rave,        100, true),
    ('DATA_QUERY_RESPONSE', v_oracle_clinical_one,  90,  false),
    ('DATA_QUERY_RESPONSE', v_veeva_edc,            80,  false),
    ('DATA_QUERY_RESPONSE', v_castor_edc,           70,  false);

  -- ── RANDOMIZATION ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('RANDOMIZATION', v_almac_irt,   100, true),
    ('RANDOMIZATION', v_iqvia_irt,   90,  false),
    ('RANDOMIZATION', v_suvoda,      80,  false),
    ('RANDOMIZATION', v_endpoint,    70,  false);

  -- ── EDC_DATA_ENTRY ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('EDC_DATA_ENTRY', v_medidata_rave,        100, true),
    ('EDC_DATA_ENTRY', v_oracle_clinical_one,  90,  false),
    ('EDC_DATA_ENTRY', v_veeva_edc,            80,  false),
    ('EDC_DATA_ENTRY', v_castor_edc,           70,  false);

  -- ── SAE_ENTRY ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('SAE_ENTRY', v_veeva_safety,  100, true),
    ('SAE_ENTRY', v_oracle_argus,  80,  false);

  -- ── LAB_QUERY_RESPONSE ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('LAB_QUERY_RESPONSE', v_labcorp,    100, true),
    ('LAB_QUERY_RESPONSE', v_quest,      90,  false),
    ('LAB_QUERY_RESPONSE', v_iqvia_labs, 80,  false);

  -- ── PHARM_DRUG_ACCOUNTABILITY ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('PHARM_DRUG_ACCOUNTABILITY', v_almac_irt, 100, true),
    ('PHARM_DRUG_ACCOUNTABILITY', v_iqvia_irt, 80,  false);

  -- ── PAYMENT_RECONCILIATION ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('PAYMENT_RECONCILIATION', v_greenphire,        100, true),
    ('PAYMENT_RECONCILIATION', v_iqvia_payments,    80,  false),
    ('PAYMENT_RECONCILIATION', v_medidata_payments, 70,  false);

  -- ── SUBJECT_REIMBURSEMENT ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('SUBJECT_REIMBURSEMENT', v_greenphire,        100, true),
    ('SUBJECT_REIMBURSEMENT', v_iqvia_payments,    80,  false),
    ('SUBJECT_REIMBURSEMENT', v_medidata_payments, 70,  false);

  -- ── IRB_SUBMISSION ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('IRB_SUBMISSION', v_central_irb, 100, true);

  -- ── DOCUMENT_UPLOAD ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('DOCUMENT_UPLOAD', v_florence_ebinder,  100, true),
    ('DOCUMENT_UPLOAD', v_veeva_vault_etmf,  80,  false),
    ('DOCUMENT_UPLOAD', v_complion,          70,  false);

  -- ── TMF_UPLOAD ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('TMF_UPLOAD', v_veeva_vault_etmf, 100, true),
    ('TMF_UPLOAD', v_florence_ebinder, 80,  false),
    ('TMF_UPLOAD', v_complion,         70,  false);

  -- ── TRAINING_COMPLETION ──
  INSERT INTO activity_system_recommendations (activity_code, system_library_id, recommendation_weight, is_default) VALUES
    ('TRAINING_COMPLETION', v_medable, 100, true);

END $$;
