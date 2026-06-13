-- Migration 0188: CAPA Actions
--
-- Structured corrective and preventive action tracking for protocol deviations.
-- Each deviation can have at most one CAPA action (UNIQUE on deviation_id).
-- CAPA has its own lifecycle independent of the deviation status.
--
-- Status: CAPA_RUNTIME_FOUNDATION

-- ---------------------------------------------------------------------------
-- 1. capa_actions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS capa_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  deviation_id uuid NOT NULL UNIQUE REFERENCES protocol_deviations(id) ON DELETE CASCADE,

  -- CAPA lifecycle
  capa_status text NOT NULL DEFAULT 'open'
    CHECK (capa_status IN ('open', 'in_progress', 'under_review', 'completed', 'verified', 'closed')),
  owner_id uuid REFERENCES auth.users(id),

  -- Analysis & actions
  root_cause_analysis text,
  corrective_action text NOT NULL,
  preventive_action text,

  -- Deadlines
  due_date timestamptz,
  completion_date timestamptz,

  -- Effectiveness check
  effectiveness_check_required boolean NOT NULL DEFAULT false,
  effectiveness_check_date timestamptz,
  effectiveness_check_result text
    CHECK (effectiveness_check_result IN ('pending', 'pass', 'fail', 'not_applicable')),
  effectiveness_verified_by uuid REFERENCES auth.users(id),
  effectiveness_notes text,

  -- Closure
  closed_by uuid REFERENCES auth.users(id),
  closure_notes text,

  -- Audit trail
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_capa_actions_org
  ON capa_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_capa_actions_study
  ON capa_actions(study_id);
CREATE INDEX IF NOT EXISTS idx_capa_actions_deviation
  ON capa_actions(deviation_id);
CREATE INDEX IF NOT EXISTS idx_capa_actions_status
  ON capa_actions(capa_status);
CREATE INDEX IF NOT EXISTS idx_capa_actions_owner
  ON capa_actions(owner_id);
CREATE INDEX IF NOT EXISTS idx_capa_actions_due_date
  ON capa_actions(due_date);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE capa_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capa_actions_select ON capa_actions;
CREATE POLICY capa_actions_select ON capa_actions
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS capa_actions_insert ON capa_actions;
CREATE POLICY capa_actions_insert ON capa_actions
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS capa_actions_update ON capa_actions;
CREATE POLICY capa_actions_update ON capa_actions
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS capa_actions_delete ON capa_actions;
CREATE POLICY capa_actions_delete ON capa_actions
  FOR DELETE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Updated-at trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS capa_actions_set_updated_at ON capa_actions;
CREATE TRIGGER capa_actions_set_updated_at
  BEFORE UPDATE ON capa_actions
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();
