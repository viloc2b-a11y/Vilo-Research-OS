-- Migration 0225: Study Systems Registry
-- Allows each study to register, manage, and launch the external systems
-- required for that specific study.
--
-- This is NOT an integration layer. No SSO, no credential management,
-- no vendor API sync.
--
-- Architecture:
--   - Systems can be created FROM the system_library (copied reference)
--     OR manually/custom (no library reference required).
--   - Custom systems are first-class records — no library FK required.
--   - When selected from library, system_name, vendor_name, system_type,
--     system_category, default_url, support_url, and training_url are
--     COPIED into this record, then independently overridable.
--   - library_id is nullable: NULL = custom system, non-NULL = library-derived.

-- =============================================================================
-- 1. study_systems table
-- =============================================================================

CREATE TABLE IF NOT EXISTS study_systems (
  study_system_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  system_library_id uuid REFERENCES system_library(system_id) ON DELETE SET NULL,
  system_name text NOT NULL,
  vendor_name text,
  system_type text NOT NULL,
  system_category text,
  launch_url text,
  support_email text,
  support_url text,
  training_url text,
  login_notes text,
  owner_role text,
  active boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_study_systems_study_id ON study_systems(study_id);
CREATE INDEX IF NOT EXISTS idx_study_systems_library_id ON study_systems(system_library_id);
CREATE INDEX IF NOT EXISTS idx_study_systems_active ON study_systems(active);
CREATE INDEX IF NOT EXISTS idx_study_systems_pinned ON study_systems(pinned) WHERE pinned = true;

-- =============================================================================
-- 3. Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_study_systems_updated_at ON study_systems;
CREATE TRIGGER trg_study_systems_updated_at
  BEFORE UPDATE ON study_systems
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 4. RLS — study-scoped: users with active org membership can manage systems
--    for studies belonging to their organization.
-- =============================================================================

ALTER TABLE study_systems ENABLE ROW LEVEL SECURITY;

-- SELECT: study members can view systems
DROP POLICY IF EXISTS study_systems_select ON study_systems;
CREATE POLICY study_systems_select ON study_systems
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_systems.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- INSERT: study members can add systems
DROP POLICY IF EXISTS study_systems_insert ON study_systems;
CREATE POLICY study_systems_insert ON study_systems
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_systems.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- UPDATE: study members can update systems
DROP POLICY IF EXISTS study_systems_update ON study_systems;
CREATE POLICY study_systems_update ON study_systems
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_systems.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- DELETE: study members can delete systems
DROP POLICY IF EXISTS study_systems_delete ON study_systems;
CREATE POLICY study_systems_delete ON study_systems
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_systems.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- =============================================================================
-- 5. Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON study_systems TO authenticated;
