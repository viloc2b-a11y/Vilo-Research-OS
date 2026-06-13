-- Migration 0187: Protocol Deviations
--
-- Foundation for protocol deviation tracking at the study level.
-- Supports full deviation lifecycle including root cause analysis,
-- corrective/preventive actions, and sponsor/IRB notification flags.
--
-- Status: PROTOCOL_DEVIATIONS_FOUNDATION

-- ---------------------------------------------------------------------------
-- 1. protocol_deviations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS protocol_deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visit_runtime_instances(id) ON DELETE SET NULL,

  -- Deviation classification
  deviation_type text NOT NULL
    CHECK (deviation_type IN (
      'missed_visit',
      'visit_window_violation',
      'missed_procedure',
      'delayed_procedure',
      'subject_noncompliance',
      'protocol_exception',
      'sponsor_directed',
      'other'
    )),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'closed')),

  -- Clinical assessment
  severity text NOT NULL
    CHECK (severity IN ('minor', 'major', 'critical')),
  description text NOT NULL,
  root_cause text,
  corrective_action text,
  preventive_action text,

  -- Notifications
  requires_sponsor_notification boolean NOT NULL DEFAULT false,
  requires_irb_notification boolean NOT NULL DEFAULT false,

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
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_org
  ON protocol_deviations(organization_id);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_study
  ON protocol_deviations(study_id);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_subject
  ON protocol_deviations(subject_id);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_visit
  ON protocol_deviations(visit_id);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_type
  ON protocol_deviations(deviation_type);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_status
  ON protocol_deviations(status);
CREATE INDEX IF NOT EXISTS idx_protocol_deviations_severity
  ON protocol_deviations(severity);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE protocol_deviations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protocol_deviations_select ON protocol_deviations;
CREATE POLICY protocol_deviations_select ON protocol_deviations
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS protocol_deviations_insert ON protocol_deviations;
CREATE POLICY protocol_deviations_insert ON protocol_deviations
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS protocol_deviations_update ON protocol_deviations;
CREATE POLICY protocol_deviations_update ON protocol_deviations
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS protocol_deviations_delete ON protocol_deviations;
CREATE POLICY protocol_deviations_delete ON protocol_deviations
  FOR DELETE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Updated-at trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS protocol_deviations_set_updated_at ON protocol_deviations;
CREATE TRIGGER protocol_deviations_set_updated_at
  BEFORE UPDATE ON protocol_deviations
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();
