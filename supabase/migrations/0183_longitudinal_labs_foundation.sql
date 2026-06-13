-- Migration 0183: Longitudinal Labs Foundation
--
-- Canonical lab result persistence, subject timeline materialization,
-- baseline engine, and signal framework for longitudinal lab monitoring.
--
-- Tables:
--   longitudinal_lab_results         — canonical per-result row
--   longitudinal_subject_timelines   — per-subject per-test aggregate timeline
--
-- Status: LONGITUDINAL_LABS_FOUNDATION

-- ---------------------------------------------------------------------------
-- 1. longitudinal_lab_results
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS longitudinal_lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visit_runtime_instances(id) ON DELETE SET NULL,
  collection_date timestamptz,
  result_date timestamptz,
  lab_test_code text NOT NULL,
  lab_test_name text NOT NULL,
  lab_category text NOT NULL DEFAULT 'labs',
  result_value numeric,
  result_unit text,
  reference_low numeric,
  reference_high numeric,
  normal_flag boolean,
  clinically_significant_flag boolean,
  baseline_flag boolean NOT NULL DEFAULT false,
  source_document_id uuid,
  lab_vendor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT longitudinal_lab_results_study_subject_test_unique
    UNIQUE (study_id, subject_id, lab_test_code, collection_date)
);

CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_org
  ON longitudinal_lab_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_study
  ON longitudinal_lab_results(study_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_subject
  ON longitudinal_lab_results(subject_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_visit
  ON longitudinal_lab_results(visit_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_test_code
  ON longitudinal_lab_results(lab_test_code);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_collection
  ON longitudinal_lab_results(collection_date);
CREATE INDEX IF NOT EXISTS idx_longitudinal_lab_results_baseline
  ON longitudinal_lab_results(subject_id, lab_test_code, baseline_flag)
  WHERE baseline_flag = true;

-- ---------------------------------------------------------------------------
-- 2. longitudinal_subject_timelines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS longitudinal_subject_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  lab_test_code text NOT NULL,
  lab_test_name text NOT NULL,
  lab_category text NOT NULL DEFAULT 'labs',
  result_ids uuid[] NOT NULL DEFAULT '{}',
  result_count integer NOT NULL DEFAULT 0,
  latest_result_id uuid REFERENCES longitudinal_lab_results(id) ON DELETE SET NULL,
  baseline_result_id uuid REFERENCES longitudinal_lab_results(id) ON DELETE SET NULL,
  baseline_value numeric,
  change_from_baseline numeric,
  percent_change_from_baseline numeric,
  last_signal_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT longitudinal_subject_timelines_unique
    UNIQUE (subject_id, lab_test_code)
);

CREATE INDEX IF NOT EXISTS idx_longitudinal_subject_timelines_org
  ON longitudinal_subject_timelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_subject_timelines_study
  ON longitudinal_subject_timelines(study_id);
CREATE INDEX IF NOT EXISTS idx_longitudinal_subject_timelines_subject
  ON longitudinal_subject_timelines(subject_id);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE longitudinal_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE longitudinal_subject_timelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS longitudinal_lab_results_select ON longitudinal_lab_results;
CREATE POLICY longitudinal_lab_results_select ON longitudinal_lab_results
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS longitudinal_lab_results_insert ON longitudinal_lab_results;
CREATE POLICY longitudinal_lab_results_insert ON longitudinal_lab_results
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS longitudinal_lab_results_update ON longitudinal_lab_results;
CREATE POLICY longitudinal_lab_results_update ON longitudinal_lab_results
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS longitudinal_subject_timelines_select ON longitudinal_subject_timelines;
CREATE POLICY longitudinal_subject_timelines_select ON longitudinal_subject_timelines
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS longitudinal_subject_timelines_insert ON longitudinal_subject_timelines;
CREATE POLICY longitudinal_subject_timelines_insert ON longitudinal_subject_timelines
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS longitudinal_subject_timelines_update ON longitudinal_subject_timelines;
CREATE POLICY longitudinal_subject_timelines_update ON longitudinal_subject_timelines
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- 4. Updated-at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS longitudinal_lab_results_set_updated_at ON longitudinal_lab_results;
CREATE TRIGGER longitudinal_lab_results_set_updated_at
  BEFORE UPDATE ON longitudinal_lab_results
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();

DROP TRIGGER IF EXISTS longitudinal_subject_timelines_set_updated_at ON longitudinal_subject_timelines;
CREATE TRIGGER longitudinal_subject_timelines_set_updated_at
  BEFORE UPDATE ON longitudinal_subject_timelines
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();
