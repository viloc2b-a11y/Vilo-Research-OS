-- Migration 0227: Study System Access Readiness
-- Tracks whether study staff have the required access to study systems
-- before study activation and subject enrollment.
--
-- This is an operational readiness feature.
-- This is NOT SSO. No usernames, passwords, tokens, or credentials stored.
-- No external system calls, no automatic access synchronization.

-- =============================================================================
-- 1. study_system_access table
-- =============================================================================

CREATE TABLE IF NOT EXISTS study_system_access (
  access_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_system_id uuid NOT NULL REFERENCES study_systems(study_system_id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id uuid,
  role text NOT NULL,
  access_status text NOT NULL,
  requested_at timestamptz,
  granted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT access_status_check CHECK (
    access_status IN ('Not Requested', 'Requested', 'Active', 'Issue', 'Not Needed')
  ),
  CONSTRAINT access_role_check CHECK (
    role IN ('PI', 'Sub Investigator', 'Coordinator', 'Regulatory', 'Pharmacy', 'Finance', 'Recruitment', 'Other')
  )
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_study_system_access_system ON study_system_access(study_system_id);
CREATE INDEX IF NOT EXISTS idx_study_system_access_study ON study_system_access(study_id);
CREATE INDEX IF NOT EXISTS idx_study_system_access_status ON study_system_access(access_status);

-- =============================================================================
-- 3. Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_study_system_access_updated_at ON study_system_access;
CREATE TRIGGER trg_study_system_access_updated_at
  BEFORE UPDATE ON study_system_access
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 4. RLS — study-scoped: same pattern as study_systems
-- =============================================================================

ALTER TABLE study_system_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_system_access_select ON study_system_access;
CREATE POLICY study_system_access_select ON study_system_access
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_access.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_system_access_insert ON study_system_access;
CREATE POLICY study_system_access_insert ON study_system_access
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_access.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_system_access_update ON study_system_access;
CREATE POLICY study_system_access_update ON study_system_access
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_access.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_system_access_delete ON study_system_access;
CREATE POLICY study_system_access_delete ON study_system_access
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_access.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- =============================================================================
-- 5. Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON study_system_access TO authenticated;
