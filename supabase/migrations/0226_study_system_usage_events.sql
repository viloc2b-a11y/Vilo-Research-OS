-- Migration 0226: Study System Usage Events
-- Tracks coordinator interaction with study systems to power:
--   - Recently used systems
--   - Most used systems
--   - Quick Launch in Command Center
--
-- No credentials, no SSO, no browser automation, no external integrations.
-- Pure usage tracking for UX ordering and quick access.

-- =============================================================================
-- 1. study_system_usage_events table
-- =============================================================================

CREATE TABLE IF NOT EXISTS study_system_usage_events (
  usage_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_system_id uuid NOT NULL REFERENCES study_systems(study_system_id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usage_event_type_check CHECK (event_type IN ('launch', 'view'))
);

-- =============================================================================
-- 2. Indexes
-- =============================================================================

-- Recent usage per user per study: find last-used timestamps quickly
CREATE INDEX IF NOT EXISTS idx_usage_events_user_study
  ON study_system_usage_events(user_id, study_id, created_at DESC);

-- Per-system usage count
CREATE INDEX IF NOT EXISTS idx_usage_events_system
  ON study_system_usage_events(study_system_id, created_at DESC);

-- =============================================================================
-- 3. RLS — study-scoped: same pattern as study_systems
-- =============================================================================

ALTER TABLE study_system_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_events_select ON study_system_usage_events;
CREATE POLICY usage_events_select ON study_system_usage_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_usage_events.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS usage_events_insert ON study_system_usage_events;
CREATE POLICY usage_events_insert ON study_system_usage_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_system_usage_events.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- No UPDATE or DELETE: usage events are immutable append-only logs

-- =============================================================================
-- 4. Grants
-- =============================================================================

GRANT SELECT, INSERT ON study_system_usage_events TO authenticated;
