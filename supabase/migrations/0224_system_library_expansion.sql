-- Migration 0224: System Library Expansion
-- Adds system_category for structured categorization and replaces the Sprint 1
-- seed with a comprehensive 68-system catalog across all clinical research domains.
--
-- Future-proofing: system_library + custom study systems (future) coexist.
-- No SSO, no credential management, no external APIs.

-- =============================================================================
-- 1. Add system_category column
-- =============================================================================

ALTER TABLE system_library
  ADD COLUMN IF NOT EXISTS system_category text;

-- =============================================================================
-- 2. Backfill existing Sprint 1 rows with appropriate categories
-- =============================================================================

UPDATE system_library SET system_category = 'Data Capture'    WHERE system_name IN ('Rave EDC', 'Veeva', 'Medidata', 'Oracle Clinical', 'Castor');
UPDATE system_library SET system_category = 'Randomization'   WHERE system_name IN ('Clario', 'Almac IRT', 'IQVIA IRT');
UPDATE system_library SET system_category = 'Patient Technology' WHERE system_name IN ('Signant');
UPDATE system_library SET system_category = 'Labs'            WHERE system_name IN ('Labcorp', 'IQVIA Labs');
UPDATE system_library SET system_category = 'Payments'        WHERE system_name IN ('IQVIA Payments');
UPDATE system_library SET system_category = 'Regulatory'      WHERE system_name IN ('Florence', 'Complion');
UPDATE system_library SET system_category = 'Sponsor Portal'  WHERE system_name = 'Sponsor Portal';
UPDATE system_library SET system_category = 'Other'           WHERE system_name = 'Central IRB Portal';

-- =============================================================================
-- 3. Make system_category NOT NULL now that all rows are backfilled
-- =============================================================================

ALTER TABLE system_library ALTER COLUMN system_category SET NOT NULL;

-- =============================================================================
-- 4. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_system_library_category ON system_library(system_category);

-- =============================================================================
-- 5. Add system_category CHECK constraint
-- =============================================================================

ALTER TABLE system_library DROP CONSTRAINT IF EXISTS system_library_category_check;
ALTER TABLE system_library ADD CONSTRAINT system_library_category_check
  CHECK (system_category IN (
    'Data Capture',
    'Randomization',
    'Patient Technology',
    'Labs',
    'Imaging',
    'Safety',
    'Payments',
    'Training',
    'Regulatory',
    'Recruitment',
    'Sponsor Portal',
    'CRO Portal',
    'Other'
  ));

-- =============================================================================
-- 6. Replace seed with expanded catalog (idempotent: skip if already seeded)
-- =============================================================================

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM system_library;

  -- If the catalog already has more rows than the original 16, assume expanded
  -- seed is already in place.
  IF v_count > 16 THEN
    RETURN;
  END IF;

  -- Remove old Sprint 1 seed
  DELETE FROM system_library;

  -- ── Data Capture (11) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Medidata Rave',       'Medidata',          'EDC',  'Data Capture'),
    ('Veeva EDC',           'Veeva Systems',     'EDC',  'Data Capture'),
    ('Oracle InForm',       'Oracle',            'EDC',  'Data Capture'),
    ('Oracle Clinical One', 'Oracle',            'EDC',  'Data Capture'),
    ('Castor EDC',          'Castor',            'EDC',  'Data Capture'),
    ('OpenClinica',         'OpenClinica',       'EDC',  'Data Capture'),
    ('REDCap',              'Vanderbilt University', 'EDC', 'Data Capture'),
    ('TrialKit',            'TrialKit',          'EDC',  'Data Capture'),
    ('ClinCapture',         'ClinCapture',       'EDC',  'Data Capture'),
    ('Datatrak',            'Datatrak',          'EDC',  'Data Capture'),
    ('Ennov',               'Ennov',             'EDC',  'Data Capture');

  -- ── Randomization / IRT (7) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Almac IRT',           'Almac Group',       'IRT',  'Randomization'),
    ('IQVIA IRT',           'IQVIA',             'IRT',  'Randomization'),
    ('Medidata Balance',    'Medidata',          'IRT',  'Randomization'),
    ('Suvoda',              'Suvoda',            'IRT',  'Randomization'),
    ('Endpoint Clinical',   'Endpoint Clinical', 'IRT',  'Randomization'),
    ('4G Clinical',         '4G Clinical',       'IRT',  'Randomization'),
    ('Signant RTSM',        'Signant Health',    'IRT',  'Randomization');

  -- ── Patient Technology — eCOA / ePRO / eConsent (10) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Clario',              'Clario',            'eCOA', 'Patient Technology'),
    ('Signant',             'Signant Health',    'eCOA', 'Patient Technology'),
    ('Medable',             'Medable',           'eCOA', 'Patient Technology'),
    ('YPrime',              'YPrime',            'eCOA', 'Patient Technology'),
    ('Kayentis',            'Kayentis',          'eCOA', 'Patient Technology'),
    ('CRF Health',          'CRF Health',        'eCOA', 'Patient Technology'),
    ('Florence eConsent',   'Florence Healthcare',  'eConsent', 'Patient Technology'),
    ('Veeva eConsent',      'Veeva Systems',     'eConsent', 'Patient Technology'),
    ('Castor eConsent',     'Castor',            'eConsent', 'Patient Technology'),
    ('TrialKit eConsent',   'TrialKit',          'eConsent', 'Patient Technology');

  -- ── Labs (9) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Labcorp',             'Labcorp',           'Labs', 'Labs'),
    ('Quest Diagnostics',   'Quest Diagnostics', 'Labs', 'Labs'),
    ('IQVIA Labs',          'IQVIA',             'Labs', 'Labs'),
    ('ICON Labs',           'ICON',              'Labs', 'Labs'),
    ('Q2 Solutions',        'Q2 Solutions',      'Labs', 'Labs'),
    ('ACM Global Labs',     'ACM Global',        'Labs', 'Labs'),
    ('Eurofins Central Lab','Eurofins',          'Labs', 'Labs'),
    ('Cerba Research',      'Cerba Research',    'Labs', 'Labs'),
    ('Medpace Labs',        'Medpace',           'Labs', 'Labs');

  -- ── Imaging (5) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Clario Imaging',      'Clario',            'Imaging', 'Imaging'),
    ('Bioclinica',          'Bioclinica',        'Imaging', 'Imaging'),
    ('Calyx Imaging',       'Calyx',             'Imaging', 'Imaging'),
    ('IXICO',               'IXICO',             'Imaging', 'Imaging'),
    ('MedQIA',              'MedQIA',            'Imaging', 'Imaging');

  -- ── Safety (3) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Oracle Argus',        'Oracle',            'Safety', 'Safety'),
    ('ArisG',               'ArisGlobal',        'Safety', 'Safety'),
    ('Veeva Safety',        'Veeva Systems',     'Safety', 'Safety');

  -- ── Payments (3) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Greenphire',          'Greenphire',        'Payments', 'Payments'),
    ('IQVIA Payments',      'IQVIA',             'Payments', 'Payments'),
    ('Medidata Payments',   'Medidata',          'Payments', 'Payments');

  -- ── Regulatory / eTMF (5) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Florence eBinder',    'Florence Healthcare',  'eTMF', 'Regulatory'),
    ('Complion',            'Complion',          'eTMF', 'Regulatory'),
    ('Veeva Vault eTMF',    'Veeva Systems',     'eTMF', 'Regulatory'),
    ('Trial Interactive',   'Trial Interactive', 'eTMF', 'Regulatory'),
    ('RealTime eReg',       'RealTime',          'eTMF', 'Regulatory');

  -- ── Recruitment (5) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('SubjectWell',         'SubjectWell',       'Recruitment', 'Recruitment'),
    ('AutoCruitment',       'AutoCruitment',     'Recruitment', 'Recruitment'),
    ('Clariness',           'Clariness',         'Recruitment', 'Recruitment'),
    ('Antidote',            'Antidote',          'Recruitment', 'Recruitment'),
    ('TrialFacts',          'TrialFacts',        'Recruitment', 'Recruitment');

  -- ── Sponsor Portal (1) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Sponsor Portal',      'Sponsor',           'Portal', 'Sponsor Portal');

  -- ── CRO Portal (8) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('IQVIA Portal',        'IQVIA',             'Portal', 'CRO Portal'),
    ('ICON Portal',         'ICON',              'Portal', 'CRO Portal'),
    ('Syneos Portal',       'Syneos',            'Portal', 'CRO Portal'),
    ('Medpace Portal',      'Medpace',           'Portal', 'CRO Portal'),
    ('PPD Portal',          'PPD',               'Portal', 'CRO Portal'),
    ('Parexel Portal',      'Parexel',           'Portal', 'CRO Portal'),
    ('Worldwide Portal',    'Worldwide Clinical Trials', 'Portal', 'CRO Portal'),
    ('Fortrea Portal',      'Fortrea',           'Portal', 'CRO Portal');

  -- ── Other / IRB (1) ──
  INSERT INTO system_library (system_name, vendor_name, system_type, system_category) VALUES
    ('Central IRB Portal',  'IRB',               'Portal', 'Other');

END $$;
