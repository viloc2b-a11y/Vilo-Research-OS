-- Migration 0223: System Library
-- Adds system_library table: a reusable system/vendor catalog for study teams
-- to find and launch external study systems.
--
-- This is NOT an integration layer. No SSO, no API sync, no external data.
-- It is a coordinator-facing reference catalog.

-- =============================================================================
-- system_library table
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_library (
  system_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  vendor_name text NOT NULL,
  system_type text NOT NULL,
  default_url text,
  support_url text,
  training_url text,
  is_sso_capable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Filter by type (e.g. "EDC", "IRT", "Labs")
CREATE INDEX IF NOT EXISTS idx_system_library_type ON system_library(system_type);

-- Filter active systems
CREATE INDEX IF NOT EXISTS idx_system_library_active ON system_library(active);

-- =============================================================================
-- Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_system_library_updated_at ON system_library;
CREATE TRIGGER trg_system_library_updated_at
  BEFORE UPDATE ON system_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE system_library ENABLE ROW LEVEL SECURITY;

-- Global catalog: all authenticated users can read
DROP POLICY IF EXISTS system_library_select ON system_library;
CREATE POLICY system_library_select ON system_library
  FOR SELECT
  USING (true);

-- Only internal tools / admin can mutate — no client-side inserts/updates/deletes
-- by default. These are deliberately restrictive; expand per-role as needed.
DROP POLICY IF EXISTS system_library_insert ON system_library;
CREATE POLICY system_library_insert ON system_library
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS system_library_update ON system_library;
CREATE POLICY system_library_update ON system_library
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS system_library_delete ON system_library;
CREATE POLICY system_library_delete ON system_library
  FOR DELETE
  USING (false);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT ON system_library TO authenticated;
GRANT SELECT ON system_library TO anon;  -- read-only catalog for public reference

-- =============================================================================
-- Seed: 16 initial systems (idempotent)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM system_library LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO system_library (system_name, vendor_name, system_type, default_url, support_url, training_url, is_sso_capable) VALUES
    ('Rave EDC',                    'Medidata',             'EDC',      NULL, NULL, NULL, false),
    ('Veeva',                       'Veeva Systems',        'EDC',      NULL, NULL, NULL, false),
    ('Clario',                      'Clario',               'IRT',      NULL, NULL, NULL, false),
    ('Signant',                     'Signant Health',       'eCOA',     NULL, NULL, NULL, false),
    ('Labcorp',                     'Labcorp',              'Labs',     NULL, NULL, NULL, false),
    ('Almac IRT',                   'Almac Group',          'IRT',      NULL, NULL, NULL, false),
    ('IQVIA IRT',                   'IQVIA',                'IRT',      NULL, NULL, NULL, false),
    ('IQVIA Labs',                  'IQVIA',                'Labs',     NULL, NULL, NULL, false),
    ('IQVIA Payments',              'IQVIA',                'Payments', NULL, NULL, NULL, false),
    ('Florence',                    'Florence Healthcare',  'eTMF',     NULL, NULL, NULL, false),
    ('Complion',                    'Complion',             'eTMF',     NULL, NULL, NULL, false),
    ('Medidata',                    'Medidata',             'EDC',      NULL, NULL, NULL, false),
    ('Oracle Clinical',             'Oracle',               'EDC',      NULL, NULL, NULL, false),
    ('Castor',                      'Castor EDC',           'EDC',      NULL, NULL, NULL, false),
    ('Sponsor Portal',              'Sponsor',              'Portal',   NULL, NULL, NULL, false),
    ('Central IRB Portal',          'IRB',                  'Portal',   NULL, NULL, NULL, false);

END $$;
