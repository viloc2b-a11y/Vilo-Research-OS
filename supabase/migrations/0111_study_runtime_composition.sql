-- Phase 3: Study runtime composition (visits, visit procedures, compiled graph snapshots)

CREATE TABLE IF NOT EXISTS study_runtime_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  visit_code text NOT NULL,
  visit_name text NOT NULL,
  visit_type text NOT NULL,
  study_day integer NULL,
  window_before_days integer NULL,
  window_after_days integer NULL,
  sequence_order integer NOT NULL,
  allowed_modes text[] NOT NULL DEFAULT ARRAY['onsite']::text[],
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  operational_notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT study_runtime_visits_type_check CHECK (
    visit_type IN (
      'screening', 'baseline', 'treatment', 'follow_up', 'early_termination',
      'unscheduled', 'phone', 'remote', 'other'
    )
  ),
  CONSTRAINT study_runtime_visits_status_check CHECK (
    status IN ('draft', 'active', 'archived')
  ),
  CONSTRAINT study_runtime_visits_study_code_unique UNIQUE (study_id, visit_code)
);

CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_org ON study_runtime_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_study ON study_runtime_visits(study_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_code ON study_runtime_visits(visit_code);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_type ON study_runtime_visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_sequence ON study_runtime_visits(sequence_order);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visits_status ON study_runtime_visits(status);

CREATE TABLE IF NOT EXISTS study_runtime_visit_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES study_runtime_visits(id) ON DELETE CASCADE,
  study_procedure_blueprint_id uuid NOT NULL REFERENCES study_procedure_blueprints(id),
  procedure_id uuid NOT NULL REFERENCES procedure_library(id),
  blueprint_version_id uuid NOT NULL REFERENCES procedure_blueprint_versions(id),
  procedure_order integer NOT NULL,
  required boolean NOT NULL DEFAULT true,
  optionality_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependency_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  timing_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  operational_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT study_runtime_visit_procedures_unique_assignment UNIQUE (
    visit_id,
    study_procedure_blueprint_id
  )
);

CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_org ON study_runtime_visit_procedures(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_study ON study_runtime_visit_procedures(study_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_visit ON study_runtime_visit_procedures(visit_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_procedure ON study_runtime_visit_procedures(procedure_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_version ON study_runtime_visit_procedures(blueprint_version_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_visit_procedures_order ON study_runtime_visit_procedures(procedure_order);

CREATE TABLE IF NOT EXISTS study_runtime_composition_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  snapshot_status text NOT NULL DEFAULT 'draft',
  graph_json jsonb NOT NULL,
  graph_hash text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT study_runtime_composition_snapshots_status_check CHECK (
    snapshot_status IN ('draft', 'compiled', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_study_runtime_snapshots_org ON study_runtime_composition_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_snapshots_study ON study_runtime_composition_snapshots(study_id);
CREATE INDEX IF NOT EXISTS idx_study_runtime_snapshots_status ON study_runtime_composition_snapshots(snapshot_status);
CREATE INDEX IF NOT EXISTS idx_study_runtime_snapshots_hash ON study_runtime_composition_snapshots(graph_hash);

ALTER TABLE study_runtime_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_runtime_visit_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_runtime_composition_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_runtime_visits_select ON study_runtime_visits;
CREATE POLICY study_runtime_visits_select ON study_runtime_visits
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visits_insert ON study_runtime_visits;
CREATE POLICY study_runtime_visits_insert ON study_runtime_visits
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visits_update ON study_runtime_visits;
CREATE POLICY study_runtime_visits_update ON study_runtime_visits
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visit_procedures_select ON study_runtime_visit_procedures;
CREATE POLICY study_runtime_visit_procedures_select ON study_runtime_visit_procedures
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visit_procedures_insert ON study_runtime_visit_procedures;
CREATE POLICY study_runtime_visit_procedures_insert ON study_runtime_visit_procedures
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visit_procedures_update ON study_runtime_visit_procedures;
CREATE POLICY study_runtime_visit_procedures_update ON study_runtime_visit_procedures
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_visit_procedures_delete ON study_runtime_visit_procedures;
CREATE POLICY study_runtime_visit_procedures_delete ON study_runtime_visit_procedures
  FOR DELETE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_snapshots_select ON study_runtime_composition_snapshots;
CREATE POLICY study_runtime_snapshots_select ON study_runtime_composition_snapshots
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_runtime_snapshots_insert ON study_runtime_composition_snapshots;
CREATE POLICY study_runtime_snapshots_insert ON study_runtime_composition_snapshots
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );
