-- Phase 4: Runtime source package drafts (visit/procedure shells from compiled graph)

CREATE TABLE runtime_source_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  composition_snapshot_id uuid NOT NULL REFERENCES study_runtime_composition_snapshots(id),
  package_status text NOT NULL DEFAULT 'draft',
  package_name text NOT NULL,
  package_version integer NOT NULL DEFAULT 1,
  package_json jsonb NOT NULL,
  package_hash text NOT NULL,
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT runtime_source_packages_status_check CHECK (
    package_status IN ('draft', 'reviewed', 'approved', 'archived')
  ),
  CONSTRAINT runtime_source_packages_study_version_unique UNIQUE (study_id, package_version)
);

CREATE INDEX idx_runtime_source_packages_org ON runtime_source_packages(organization_id);
CREATE INDEX idx_runtime_source_packages_study ON runtime_source_packages(study_id);
CREATE INDEX idx_runtime_source_packages_snapshot ON runtime_source_packages(composition_snapshot_id);
CREATE INDEX idx_runtime_source_packages_status ON runtime_source_packages(package_status);
CREATE INDEX idx_runtime_source_packages_hash ON runtime_source_packages(package_hash);

CREATE TABLE runtime_source_visit_shells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  source_package_id uuid NOT NULL REFERENCES runtime_source_packages(id) ON DELETE CASCADE,
  runtime_visit_id uuid NOT NULL,
  visit_code text NOT NULL,
  visit_name text NOT NULL,
  visit_type text NOT NULL,
  sequence_order integer NOT NULL,
  source_shell_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT runtime_source_visit_shells_status_check CHECK (
    status IN ('draft', 'reviewed', 'approved', 'archived')
  ),
  CONSTRAINT runtime_source_visit_shells_unique_visit UNIQUE (source_package_id, runtime_visit_id)
);

CREATE INDEX idx_runtime_source_visit_shells_org ON runtime_source_visit_shells(organization_id);
CREATE INDEX idx_runtime_source_visit_shells_study ON runtime_source_visit_shells(study_id);
CREATE INDEX idx_runtime_source_visit_shells_package ON runtime_source_visit_shells(source_package_id);
CREATE INDEX idx_runtime_source_visit_shells_runtime_visit ON runtime_source_visit_shells(runtime_visit_id);
CREATE INDEX idx_runtime_source_visit_shells_code ON runtime_source_visit_shells(visit_code);
CREATE INDEX idx_runtime_source_visit_shells_sequence ON runtime_source_visit_shells(sequence_order);

CREATE TABLE runtime_source_procedure_shells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  source_package_id uuid NOT NULL REFERENCES runtime_source_packages(id) ON DELETE CASCADE,
  visit_shell_id uuid NOT NULL REFERENCES runtime_source_visit_shells(id) ON DELETE CASCADE,
  runtime_visit_procedure_id uuid NOT NULL,
  procedure_id uuid NOT NULL REFERENCES procedure_library(id),
  blueprint_version_id uuid NOT NULL REFERENCES procedure_blueprint_versions(id),
  procedure_code text NOT NULL,
  procedure_name text NOT NULL,
  procedure_order integer NOT NULL,
  required boolean NOT NULL DEFAULT true,
  source_shell_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT runtime_source_procedure_shells_status_check CHECK (
    status IN ('draft', 'reviewed', 'approved', 'archived')
  ),
  CONSTRAINT runtime_source_procedure_shells_unique_assignment UNIQUE (
    visit_shell_id,
    runtime_visit_procedure_id
  )
);

CREATE INDEX idx_runtime_source_procedure_shells_org ON runtime_source_procedure_shells(organization_id);
CREATE INDEX idx_runtime_source_procedure_shells_study ON runtime_source_procedure_shells(study_id);
CREATE INDEX idx_runtime_source_procedure_shells_package ON runtime_source_procedure_shells(source_package_id);
CREATE INDEX idx_runtime_source_procedure_shells_visit_shell ON runtime_source_procedure_shells(visit_shell_id);
CREATE INDEX idx_runtime_source_procedure_shells_procedure ON runtime_source_procedure_shells(procedure_id);
CREATE INDEX idx_runtime_source_procedure_shells_version ON runtime_source_procedure_shells(blueprint_version_id);
CREATE INDEX idx_runtime_source_procedure_shells_order ON runtime_source_procedure_shells(procedure_order);

ALTER TABLE runtime_source_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_source_visit_shells ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_source_procedure_shells ENABLE ROW LEVEL SECURITY;

CREATE POLICY runtime_source_packages_select ON runtime_source_packages
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_packages_insert ON runtime_source_packages
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_packages_update ON runtime_source_packages
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_visit_shells_select ON runtime_source_visit_shells
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_visit_shells_insert ON runtime_source_visit_shells
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_visit_shells_update ON runtime_source_visit_shells
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_procedure_shells_select ON runtime_source_procedure_shells
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_procedure_shells_insert ON runtime_source_procedure_shells
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY runtime_source_procedure_shells_update ON runtime_source_procedure_shells
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );
