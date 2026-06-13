-- Migration 0185: Safety Events
--
-- Foundation for adverse event (AE/SAE) tracking at the study level.
-- Supports manual entry, lab signal detection, protocol deviation, and
-- source review sources. Reuses existing operational signature infrastructure
-- for PI/Sub-I signoff where applicable.
--
-- Status: SAFETY_RUNTIME_FOUNDATION

-- ---------------------------------------------------------------------------
-- 1. safety_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visit_runtime_instances(id) ON DELETE SET NULL,

  -- Event classification
  event_type text NOT NULL
    CHECK (event_type IN ('ae', 'sae')),
  event_status text NOT NULL DEFAULT 'open'
    CHECK (event_status IN ('open', 'under_review', 'closed')),
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'lab_signal', 'protocol_deviation', 'source_review')),

  -- Clinical assessment
  description text NOT NULL,
  severity text
    CHECK (severity IN ('mild', 'moderate', 'severe')),
  relatedness text
    CHECK (relatedness IN ('unrelated', 'unlikely', 'possible', 'probable', 'definite')),
  requires_follow_up boolean NOT NULL DEFAULT false,

  -- Lifecycle
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,

  -- Audit trail
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_safety_events_org
  ON safety_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_study
  ON safety_events(study_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_subject
  ON safety_events(subject_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_visit
  ON safety_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_type
  ON safety_events(event_type);
CREATE INDEX IF NOT EXISTS idx_safety_events_status
  ON safety_events(event_status);
CREATE INDEX IF NOT EXISTS idx_safety_events_source
  ON safety_events(source_type);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_events_select ON safety_events;
CREATE POLICY safety_events_select ON safety_events
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS safety_events_insert ON safety_events;
CREATE POLICY safety_events_insert ON safety_events
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS safety_events_update ON safety_events;
CREATE POLICY safety_events_update ON safety_events
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS safety_events_delete ON safety_events;
CREATE POLICY safety_events_delete ON safety_events
  FOR DELETE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Updated-at trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS safety_events_set_updated_at ON safety_events;
CREATE TRIGGER safety_events_set_updated_at
  BEFORE UPDATE ON safety_events
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();
