-- Phase 2: Reusable procedure library + blueprint engine

-- ---------------------------------------------------------------------------
-- procedure_library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procedure_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  library_scope text NOT NULL DEFAULT 'global',
  procedure_code text NOT NULL,
  procedure_name text NOT NULL,
  procedure_category text NOT NULL,
  procedure_subcategory text NULL,
  description text NULL,
  operational_description text NULL,
  source_template_enabled boolean NOT NULL DEFAULT true,
  requires_signature boolean NOT NULL DEFAULT false,
  requires_certified_copy boolean NOT NULL DEFAULT false,
  supports_offsite boolean NOT NULL DEFAULT false,
  procedure_complexity text NOT NULL DEFAULT 'standard',
  estimated_duration_minutes integer NULL,
  active_version_id uuid NULL,
  status text NOT NULL DEFAULT 'active',
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT procedure_library_scope_check CHECK (
    library_scope IN ('global', 'organization')
  ),
  CONSTRAINT procedure_library_complexity_check CHECK (
    procedure_complexity IN ('simple', 'standard', 'complex', 'critical')
  ),
  CONSTRAINT procedure_library_status_check CHECK (
    status IN ('active', 'inactive', 'draft', 'archived')
  ),
  CONSTRAINT procedure_library_org_scope_check CHECK (
    (library_scope = 'global' AND organization_id IS NULL)
    OR (library_scope = 'organization' AND organization_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procedure_library_code_global ON procedure_library(procedure_code)
  WHERE library_scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS idx_procedure_library_code_org ON procedure_library(organization_id, procedure_code)
  WHERE library_scope = 'organization';

CREATE INDEX IF NOT EXISTS idx_procedure_library_code ON procedure_library(procedure_code);
CREATE INDEX IF NOT EXISTS idx_procedure_library_name ON procedure_library(procedure_name);
CREATE INDEX IF NOT EXISTS idx_procedure_library_category ON procedure_library(procedure_category);
CREATE INDEX IF NOT EXISTS idx_procedure_library_scope ON procedure_library(library_scope);
CREATE INDEX IF NOT EXISTS idx_procedure_library_status ON procedure_library(status);

-- ---------------------------------------------------------------------------
-- procedure_blueprint_versions (immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procedure_blueprint_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES procedure_library(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  blueprint_status text NOT NULL DEFAULT 'draft',
  blueprint_json jsonb NOT NULL,
  field_schema jsonb NOT NULL,
  dependency_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  operational_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_render_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT procedure_blueprint_versions_status_check CHECK (
    blueprint_status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT procedure_blueprint_versions_unique_version UNIQUE (procedure_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_procedure_blueprint_versions_procedure ON procedure_blueprint_versions(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_blueprint_versions_status ON procedure_blueprint_versions(blueprint_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procedure_library_active_version_fk'
  ) THEN
    ALTER TABLE procedure_library
      ADD CONSTRAINT procedure_library_active_version_fk
      FOREIGN KEY (active_version_id) REFERENCES procedure_blueprint_versions(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- study_procedure_blueprints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_procedure_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES procedure_library(id),
  blueprint_version_id uuid NOT NULL REFERENCES procedure_blueprint_versions(id),
  visit_type text NULL,
  visit_code text NULL,
  required boolean NOT NULL DEFAULT true,
  optionality_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduling_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  operational_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_procedure_blueprints_org ON study_procedure_blueprints(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_procedure_blueprints_study ON study_procedure_blueprints(study_id);
CREATE INDEX IF NOT EXISTS idx_study_procedure_blueprints_procedure ON study_procedure_blueprints(procedure_id);
CREATE INDEX IF NOT EXISTS idx_study_procedure_blueprints_version ON study_procedure_blueprints(blueprint_version_id);
CREATE INDEX IF NOT EXISTS idx_study_procedure_blueprints_visit_code ON study_procedure_blueprints(visit_code);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE procedure_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_blueprint_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_procedure_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS procedure_library_select ON procedure_library;
CREATE POLICY procedure_library_select ON procedure_library
  FOR SELECT USING (
    library_scope = 'global'
    OR (
      organization_id IS NOT NULL
      AND public.user_has_active_organization_membership(organization_id)
    )
  );

DROP POLICY IF EXISTS procedure_library_insert ON procedure_library;
CREATE POLICY procedure_library_insert ON procedure_library
  FOR INSERT WITH CHECK (
    (
      library_scope = 'global'
      AND organization_id IS NULL
    )
    OR (
      library_scope = 'organization'
      AND organization_id IS NOT NULL
      AND public.user_has_active_organization_membership(organization_id)
    )
  );

DROP POLICY IF EXISTS procedure_library_update ON procedure_library;
CREATE POLICY procedure_library_update ON procedure_library
  FOR UPDATE USING (
    (
      library_scope = 'global'
    )
    OR (
      organization_id IS NOT NULL
      AND public.user_has_active_organization_membership(organization_id)
    )
  );

DROP POLICY IF EXISTS procedure_blueprint_versions_select ON procedure_blueprint_versions;
CREATE POLICY procedure_blueprint_versions_select ON procedure_blueprint_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM procedure_library pl
      WHERE pl.id = procedure_id
        AND (
          pl.library_scope = 'global'
          OR (
            pl.organization_id IS NOT NULL
            AND public.user_has_active_organization_membership(pl.organization_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS procedure_blueprint_versions_insert ON procedure_blueprint_versions;
CREATE POLICY procedure_blueprint_versions_insert ON procedure_blueprint_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM procedure_library pl
      WHERE pl.id = procedure_id
        AND (
          pl.library_scope = 'global'
          OR (
            pl.organization_id IS NOT NULL
            AND public.user_has_active_organization_membership(pl.organization_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS procedure_blueprint_versions_update ON procedure_blueprint_versions;
CREATE POLICY procedure_blueprint_versions_update ON procedure_blueprint_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM procedure_library pl
      WHERE pl.id = procedure_id
        AND (
          pl.library_scope = 'global'
          OR (
            pl.organization_id IS NOT NULL
            AND public.user_has_active_organization_membership(pl.organization_id)
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION prevent_blueprint_content_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.blueprint_json IS DISTINCT FROM NEW.blueprint_json
    OR OLD.field_schema IS DISTINCT FROM NEW.field_schema
    OR OLD.dependency_schema IS DISTINCT FROM NEW.dependency_schema
    OR OLD.operational_rules IS DISTINCT FROM NEW.operational_rules
    OR OLD.source_render_schema IS DISTINCT FROM NEW.source_render_schema
    OR OLD.version_number IS DISTINCT FROM NEW.version_number
    OR OLD.procedure_id IS DISTINCT FROM NEW.procedure_id
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Blueprint version content is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procedure_blueprint_versions_immutable_content ON procedure_blueprint_versions;
CREATE TRIGGER procedure_blueprint_versions_immutable_content
  BEFORE UPDATE ON procedure_blueprint_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_blueprint_content_mutation();

-- Blueprint versions: no DELETE policy (append-only lifecycle)

DROP POLICY IF EXISTS study_procedure_blueprints_select ON study_procedure_blueprints;
CREATE POLICY study_procedure_blueprints_select ON study_procedure_blueprints
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_procedure_blueprints_insert ON study_procedure_blueprints;
CREATE POLICY study_procedure_blueprints_insert ON study_procedure_blueprints
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- Seed: global reusable procedures (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  proc_id uuid;
  version_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM procedure_library WHERE library_scope = 'global' LIMIT 1) THEN
    RETURN;
  END IF;

  -- Vital Signs
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'VITAL_SIGNS', 'Vital Signs', 'assessment',
    'Record blood pressure, heart rate, respiratory rate, temperature, and weight.',
    'simple', 10, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
    dependency_schema, operational_rules, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"vitals","title":"Vital Signs","fields":[{"field_id":"systolic_bp","type":"vital_sign","required":true},{"field_id":"diastolic_bp","type":"vital_sign","required":true},{"field_id":"heart_rate","type":"number","required":true},{"field_id":"temperature","type":"vital_sign","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"systolic_bp","type":"vital_sign","label":"Systolic BP"},{"field_id":"diastolic_bp","type":"vital_sign","label":"Diastolic BP"},{"field_id":"heart_rate","type":"number","label":"Heart Rate"},{"field_id":"temperature","type":"vital_sign","label":"Temperature"}]}'::jsonb,
    '{}'::jsonb,
    '{"coordinator_guidance":"Confirm fasting status if protocol requires."}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- ECG
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    requires_signature, status, created_by
  ) VALUES (
    'global', 'ECG', 'ECG', 'cardiac',
    '12-lead electrocardiogram acquisition and review.',
    'standard', 15, true, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
    dependency_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"ecg","title":"ECG","fields":[{"field_id":"ecg_performed","type":"yes_no","required":true},{"field_id":"ecg_interpretation","type":"select","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"ecg_performed","type":"yes_no","label":"ECG Performed"},{"field_id":"ecg_interpretation","type":"select","label":"Interpretation","options":["Normal","Abnormal NCS","Abnormal CS"]}]}'::jsonb,
    '{"rules":[{"if":{"field":"ecg_interpretation","equals":"Abnormal CS"},"then":{"show_warning":"Notify PI and medical monitor"}}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- CBC
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'CBC', 'CBC', 'laboratory',
    'Complete blood count sample collection.',
    'standard', 10, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"cbc","title":"CBC","fields":[{"field_id":"sample_collected","type":"yes_no","required":true},{"field_id":"hemoglobin","type":"lab_result","required":false}]}]}'::jsonb,
    '{"fields":[{"field_id":"sample_collected","type":"yes_no","label":"Sample Collected"},{"field_id":"hemoglobin","type":"lab_result","label":"Hemoglobin"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- Pregnancy Test
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'PREGNANCY_TEST', 'Pregnancy Test', 'laboratory',
    'Urine or serum pregnancy test for eligibility and safety.',
    'simple', 5, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
    dependency_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"pregnancy","title":"Pregnancy Test","fields":[{"field_id":"pregnancy_test","type":"select","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"pregnancy_test","type":"select","label":"Result","options":["negative","positive","not_applicable"]}]}'::jsonb,
    '{"rules":[{"if":{"field":"pregnancy_test","equals":"positive"},"then":{"show_warning":"Notify PI immediately","escalation":"pi_notification"}}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- PK Blood Draw
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'PK_BLOOD_DRAW', 'PK Blood Draw', 'laboratory',
    'Pharmacokinetic blood sample per protocol window.',
    'standard', 15, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"pk","title":"PK Blood Draw","fields":[{"field_id":"draw_time","type":"datetime","required":true},{"field_id":"volume_ml","type":"number","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"draw_time","type":"datetime","label":"Draw Time"},{"field_id":"volume_ml","type":"number","label":"Volume (mL)"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- Physical Exam
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    requires_signature, status, created_by
  ) VALUES (
    'global', 'PHYSICAL_EXAM', 'Physical Exam', 'assessment',
    'Directed physical examination per protocol.',
    'standard', 20, true, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"pe","title":"Physical Exam","fields":[{"field_id":"exam_completed","type":"yes_no","required":true},{"field_id":"findings","type":"textarea","required":false}]}]}'::jsonb,
    '{"fields":[{"field_id":"exam_completed","type":"yes_no","label":"Exam Completed"},{"field_id":"findings","type":"textarea","label":"Findings"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- AE Review
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'AE_REVIEW', 'AE Review', 'safety',
    'Review adverse events since last visit.',
    'standard', 15, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"ae","title":"Adverse Events","fields":[{"field_id":"new_aes","type":"yes_no","required":true},{"field_id":"ae_notes","type":"textarea","required":false}]}]}'::jsonb,
    '{"fields":[{"field_id":"new_aes","type":"yes_no","label":"New AEs Since Last Visit"},{"field_id":"ae_notes","type":"textarea","label":"Notes"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- Concomitant Medications
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'CONMED_REVIEW', 'Concomitant Medications', 'medication',
    'Review and update concomitant medications.',
    'simple', 10, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"conmed","title":"Concomitant Medications","fields":[{"field_id":"medications_changed","type":"yes_no","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"medications_changed","type":"yes_no","label":"Medications Changed"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- WOMAC
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'WOMAC', 'WOMAC', 'patient_reported',
    'Western Ontario and McMaster Universities Osteoarthritis Index.',
    'standard', 15, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"womac","title":"WOMAC","fields":[{"field_id":"pain_score","type":"number","required":true},{"field_id":"stiffness_score","type":"number","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"pain_score","type":"number","label":"Pain Score"},{"field_id":"stiffness_score","type":"number","label":"Stiffness Score"}]}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

  -- ACTH Stimulation Test
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, created_by
  ) VALUES (
    'global', 'ACTH_STIM', 'ACTH Stimulation Test', 'laboratory',
    'ACTH stimulation with timed cortisol draws.',
    'complex', 180, 'active', seed_actor
  ) RETURNING id INTO proc_id;

  INSERT INTO procedure_blueprint_versions (
    procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
    dependency_schema, operational_rules, created_by
  ) VALUES (
    proc_id, 1, 'published',
    '{"sections":[{"section_id":"acth","title":"ACTH Stimulation","fields":[{"field_id":"baseline_cortisol","type":"lab_result","required":true},{"field_id":"peak_cortisol","type":"lab_result","required":true}]}]}'::jsonb,
    '{"fields":[{"field_id":"baseline_cortisol","type":"lab_result","label":"Baseline Cortisol"},{"field_id":"peak_cortisol","type":"lab_result","label":"Peak Cortisol"}]}'::jsonb,
    '{"rules":[{"if":{"field":"peak_cortisol","operator":"lt","value":18},"then":{"show_warning":"Abnormal response — review with PI","flag":"abnormal_value"}}]}'::jsonb,
    '{"coordinator_guidance":"Confirm fasting and steroid washout per protocol."}'::jsonb,
    seed_actor
  ) RETURNING id INTO version_id;
  UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;

END $$;
