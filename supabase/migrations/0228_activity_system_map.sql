-- Migration 0228: Activity → System Map
-- Allows Vilo OS tasks to identify the external system required for execution
-- and provide one-click contextual launch to the correct system.
--
-- This is NOT integration. This is contextual navigation.
-- One activity may map to multiple systems (one primary).
-- One system may support multiple activities.

-- =============================================================================
-- 1. activity_system_map table
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_system_map (
  activity_system_map_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_code text NOT NULL,
  system_library_id uuid NOT NULL REFERENCES system_library(system_id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One primary per activity code
  CONSTRAINT unique_primary_per_activity UNIQUE (activity_code, is_primary)
    DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_activity_system_map_code ON activity_system_map(activity_code);
CREATE INDEX IF NOT EXISTS idx_activity_system_map_system ON activity_system_map(system_library_id);

-- =============================================================================
-- 3. Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_activity_system_map_updated_at ON activity_system_map;
CREATE TRIGGER trg_activity_system_map_updated_at
  BEFORE UPDATE ON activity_system_map
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 4. RLS — activity system map is a reference catalog (read-only from client)
-- =============================================================================

ALTER TABLE activity_system_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_system_map_select ON activity_system_map;
CREATE POLICY activity_system_map_select ON activity_system_map
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS activity_system_map_insert ON activity_system_map;
CREATE POLICY activity_system_map_insert ON activity_system_map
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS activity_system_map_update ON activity_system_map;
CREATE POLICY activity_system_map_update ON activity_system_map
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS activity_system_map_delete ON activity_system_map;
CREATE POLICY activity_system_map_delete ON activity_system_map
  FOR DELETE
  USING (false);

-- =============================================================================
-- 5. Grants
-- =============================================================================

GRANT SELECT ON activity_system_map TO authenticated;

-- =============================================================================
-- 6. Seed mappings (idempotent)
-- =============================================================================

DO $$
DECLARE
  v_medidata_rave uuid;
  v_veeva_safety uuid;
  v_labcorp uuid;
  v_almac_irt uuid;
  v_greenphire uuid;
  v_central_irb uuid;
  v_florence_ebinder uuid;
  v_veeva_vault_etmf uuid;
BEGIN
  -- Resolve library system IDs
  SELECT system_id INTO v_medidata_rave FROM system_library WHERE system_name = 'Medidata Rave';
  SELECT system_id INTO v_veeva_safety FROM system_library WHERE system_name = 'Veeva Safety';
  SELECT system_id INTO v_labcorp FROM system_library WHERE system_name = 'Labcorp';
  SELECT system_id INTO v_almac_irt FROM system_library WHERE system_name = 'Almac IRT';
  SELECT system_id INTO v_greenphire FROM system_library WHERE system_name = 'Greenphire';
  SELECT system_id INTO v_central_irb FROM system_library WHERE system_name = 'Central IRB Portal';
  SELECT system_id INTO v_florence_ebinder FROM system_library WHERE system_name = 'Florence eBinder';
  SELECT system_id INTO v_veeva_vault_etmf FROM system_library WHERE system_name = 'Veeva Vault eTMF';

  -- Skip if any required system is missing (library not seeded yet)
  IF v_medidata_rave IS NULL OR v_veeva_safety IS NULL OR v_labcorp IS NULL
     OR v_almac_irt IS NULL OR v_greenphire IS NULL OR v_central_irb IS NULL
     OR v_florence_ebinder IS NULL OR v_veeva_vault_etmf IS NULL THEN
    RETURN;
  END IF;

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM activity_system_map LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO activity_system_map (activity_code, system_library_id, is_primary, notes) VALUES
    -- Data Capture / EDC
    ('DATA_QUERY_RESPONSE', v_medidata_rave, true, NULL),
    ('EDC_DATA_ENTRY',      v_medidata_rave, true, NULL),

    -- Safety
    ('SAE_ENTRY',           v_veeva_safety,  true, 'SAE entry in safety system'),

    -- Labs
    ('LAB_RESULT_REVIEW',   v_labcorp,       true, 'Review lab results in Labcorp portal'),
    ('LAB_QUERY_RESPONSE',  v_labcorp,       true, 'Respond to lab queries'),

    -- IRT / Pharmacy
    ('PHARM_DRUG_ACCOUNTABILITY', v_almac_irt, true, 'Drug accountability in IRT'),
    ('RANDOMIZATION',       v_almac_irt,     true, 'Subject randomization in IRT'),

    -- Payments
    ('PAYMENT_RECONCILIATION',  v_greenphire, true, 'Payment reconciliation'),
    ('SUBJECT_REIMBURSEMENT',   v_greenphire, true, 'Subject reimbursement'),

    -- IRB / Regulatory
    ('IRB_SUBMISSION',      v_central_irb,   true, 'Submit to IRB'),

    -- Document / eTMF
    ('DOCUMENT_UPLOAD',     v_florence_ebinder, true, 'Upload study document'),
    ('TMF_UPLOAD',          v_veeva_vault_etmf, true, 'Upload to eTMF'),

    -- Training
    ('TRAINING_COMPLETION', v_veeva_vault_etmf, true, 'No LMS configured — training tracked in eTMF');

END $$;
