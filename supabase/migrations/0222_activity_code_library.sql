-- Migration 0222: Activity Code Library
-- Adds activity_code_library table with dual-scope pattern (global + org overrides).
-- Mirrors the partial-unique-index approach from procedure_library (0110) for PG version safety.
-- RLS uses public.user_has_active_organization_membership matching 0110 pattern.

-- ============================================================
-- activity_code_library table
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_code_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  sub_category text NULL,
  typical_unit text NOT NULL DEFAULT 'flat',
  fmv_low numeric(10,2) NULL,
  fmv_high numeric(10,2) NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activity_code_library_category_check CHECK (
    category IN ('clinical', 'operational', 'regulatory', 'financial', 'conditional')
  ),
  CONSTRAINT activity_code_library_unit_check CHECK (
    typical_unit IN ('per_visit', 'per_hour', 'per_patient', 'flat', 'per_event')
  ),
  CONSTRAINT activity_code_library_fmv_range_check CHECK (
    fmv_low IS NULL OR fmv_high IS NULL OR fmv_low <= fmv_high
  )
);

-- ============================================================
-- Indexes — dual-scope uniqueness via partial indexes (mirrors procedure_library)
-- ============================================================

-- Global rows: code unique among global (organization_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_code_library_code_global
  ON activity_code_library(code) WHERE organization_id IS NULL;

-- Org override rows: (organization_id, code) unique within that org
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_code_library_code_org
  ON activity_code_library(organization_id, code) WHERE organization_id IS NOT NULL;

-- Lookup helpers
CREATE INDEX IF NOT EXISTS idx_activity_code_library_code ON activity_code_library(code);
CREATE INDEX IF NOT EXISTS idx_activity_code_library_category ON activity_code_library(category);
CREATE INDEX IF NOT EXISTS idx_activity_code_library_org ON activity_code_library(organization_id);

-- ============================================================
-- Updated-at trigger (matches 0221 pattern)
-- ============================================================

DROP TRIGGER IF EXISTS trg_activity_code_library_updated_at ON activity_code_library;
CREATE TRIGGER trg_activity_code_library_updated_at
  BEFORE UPDATE ON activity_code_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS — same membership helper as procedure_library (0110)
-- ============================================================

ALTER TABLE activity_code_library ENABLE ROW LEVEL SECURITY;

-- SELECT: global rows visible to all authenticated; org rows visible to members
DROP POLICY IF EXISTS activity_code_library_select ON activity_code_library;
CREATE POLICY activity_code_library_select ON activity_code_library
  FOR SELECT USING (
    organization_id IS NULL
    OR public.user_has_active_organization_membership(organization_id)
  );

-- INSERT: org members only; global rows inserted exclusively via migration
DROP POLICY IF EXISTS activity_code_library_insert ON activity_code_library;
CREATE POLICY activity_code_library_insert ON activity_code_library
  FOR INSERT WITH CHECK (
    organization_id IS NOT NULL
    AND public.user_has_active_organization_membership(organization_id)
  );

-- UPDATE: org members only; global rows immutable from client side
DROP POLICY IF EXISTS activity_code_library_update ON activity_code_library;
CREATE POLICY activity_code_library_update ON activity_code_library
  FOR UPDATE USING (
    organization_id IS NOT NULL
    AND public.user_has_active_organization_membership(organization_id)
  );

-- DELETE: org members only
DROP POLICY IF EXISTS activity_code_library_delete ON activity_code_library;
CREATE POLICY activity_code_library_delete ON activity_code_library
  FOR DELETE USING (
    organization_id IS NOT NULL
    AND public.user_has_active_organization_membership(organization_id)
  );

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON activity_code_library TO authenticated;

-- ============================================================
-- Seed: 40 global activity codes (idempotent — mirrors 0110 guard pattern)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM activity_code_library WHERE organization_id IS NULL LIMIT 1) THEN
    RETURN;
  END IF;

  -- Clinical (10)
  INSERT INTO activity_code_library (organization_id, code, name, category, typical_unit, fmv_low, fmv_high) VALUES
    (NULL, 'PHYS_EXAM',           'Physical Examination',                    'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'ECG',                 'Electrocardiogram (ECG)',                  'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'VITALS',              'Vital Signs',                             'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'LABS_CBC',            'Labs — Complete Blood Count',             'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'LABS_PANEL',          'Labs — Full Metabolic Panel',             'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'IMAGING_XRAY',        'Imaging — X-Ray',                         'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'DIARY_REVIEW',        'Patient Diary Review',                    'clinical',     'per_visit',    NULL, NULL),
    (NULL, 'SCREEN_FAIL_REVIEW',  'Screen Failure Review',                   'clinical',     'per_patient',  NULL, NULL),
    (NULL, 'SAE_FOLLOWUP',        'SAE Follow-up Assessment',                'clinical',     'per_event',    NULL, NULL),
    (NULL, 'RECONSENT',           'Subject Reconsent',                       'clinical',     'per_patient',  NULL, NULL);

  -- Operational (12)
  INSERT INTO activity_code_library (organization_id, code, name, category, typical_unit, fmv_low, fmv_high) VALUES
    (NULL, 'COORD_HOUR',          'Coordinator Time',                        'operational',  'per_hour',     NULL, NULL),
    (NULL, 'PI_HOUR',             'Principal Investigator Time',             'operational',  'per_hour',     NULL, NULL),
    (NULL, 'RN_HOUR',             'Registered Nurse Time',                   'operational',  'per_hour',     NULL, NULL),
    (NULL, 'PHARMACIST_HOUR',     'Pharmacist Time',                         'operational',  'per_hour',     NULL, NULL),
    (NULL, 'DRUG_ACCOUNTABILITY', 'Drug Accountability Review',              'operational',  'per_visit',    NULL, NULL),
    (NULL, 'SOURCE_REVIEW',       'Source Document Review',                  'operational',  'per_visit',    NULL, NULL),
    (NULL, 'EDC_ENTRY',           'EDC Data Entry',                          'operational',  'per_hour',     NULL, NULL),
    (NULL, 'QUERY_MGMT',          'Query Management',                        'operational',  'per_hour',     NULL, NULL),
    (NULL, 'TEMP_LOG_REVIEW',     'Temperature Log Review',                  'operational',  'per_visit',    NULL, NULL),
    (NULL, 'CRA_VISIT_PREP',      'CRA Visit Preparation',                   'operational',  'per_visit',    NULL, NULL),
    (NULL, 'SHIPMENT_PREP',       'Sample/Drug Shipment Preparation',        'operational',  'per_visit',    NULL, NULL),
    (NULL, 'STARTUP_TRAINING',    'Site Initiation Training',                'operational',  'flat',         NULL, NULL);

  -- Regulatory (8)
  INSERT INTO activity_code_library (organization_id, code, name, category, typical_unit, fmv_low, fmv_high) VALUES
    (NULL, 'IRB_INITIAL',         'IRB Initial Application Fee',             'regulatory',   'flat',         NULL, NULL),
    (NULL, 'IRB_ANNUAL',          'IRB Annual Renewal Fee',                  'regulatory',   'flat',         NULL, NULL),
    (NULL, 'IRB_AMENDMENT',       'IRB Amendment Fee',                       'regulatory',   'per_event',    NULL, NULL),
    (NULL, 'PROTOCOL_DEV',        'Protocol Deviation Review',               'regulatory',   'per_event',    NULL, NULL),
    (NULL, 'FORM_1572',           'FDA Form 1572 Update',                    'regulatory',   'per_event',    NULL, NULL),
    (NULL, 'REGULATORY_ARCHIVE',  'Regulatory Document Archiving',           'regulatory',   'per_visit',    NULL, NULL),
    (NULL, 'CONSENT_ADMIN',       'Informed Consent Administration',         'regulatory',   'per_patient',  NULL, NULL),
    (NULL, 'SAFETY_REPORT',       'Safety Report Preparation',               'regulatory',   'per_event',    NULL, NULL);

  -- Financial (5)
  INSERT INTO activity_code_library (organization_id, code, name, category, typical_unit, fmv_low, fmv_high) VALUES
    (NULL, 'PASS_THRU_LABS',      'Pass-Through — External Laboratory',      'financial',    'per_visit',    NULL, NULL),
    (NULL, 'PASS_THRU_IMAGING',   'Pass-Through — Imaging Facility',         'financial',    'per_visit',    NULL, NULL),
    (NULL, 'PASS_THRU_PHARMACY',  'Pass-Through — External Pharmacy',        'financial',    'per_visit',    NULL, NULL),
    (NULL, 'PASS_THRU_SHIPPING',  'Pass-Through — Sample Shipping',          'financial',    'flat',         NULL, NULL),
    (NULL, 'INVOICE_REVIEW',      'Invoice Preparation and Review',          'financial',    'per_event',    NULL, NULL);

  -- Conditional (5)
  INSERT INTO activity_code_library (organization_id, code, name, category, typical_unit, fmv_low, fmv_high) VALUES
    (NULL, 'CONDITIONAL_ECG',     'Conditional ECG (per protocol branch)',    'conditional',  'per_visit',    NULL, NULL),
    (NULL, 'CONDITIONAL_MRI',     'Conditional MRI (per protocol branch)',    'conditional',  'per_visit',    NULL, NULL),
    (NULL, 'CONDITIONAL_BIOPSY',  'Conditional Biopsy (per protocol branch)', 'conditional', 'per_patient',  NULL, NULL),
    (NULL, 'CONDITIONAL_PK',      'Conditional PK Sample Collection',        'conditional',  'per_visit',    NULL, NULL),
    (NULL, 'UNSCHEDULED_VISIT',   'Unscheduled Visit',                       'conditional',  'per_visit',    NULL, NULL);

END $$;
