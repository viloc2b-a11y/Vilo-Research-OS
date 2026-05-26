-- Phase 5: Visit runtime execution layer (subject visit workspaces from source package shells)

CREATE TABLE visit_runtime_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  source_package_id uuid NOT NULL REFERENCES runtime_source_packages(id),
  visit_shell_id uuid NOT NULL REFERENCES runtime_source_visit_shells(id),
  runtime_visit_id uuid NOT NULL,
  visit_code text NOT NULL,
  visit_name text NOT NULL,
  visit_type text NOT NULL,
  visit_status text NOT NULL DEFAULT 'not_started',
  scheduled_at timestamptz NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL,
  progress_percent integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visit_runtime_instances_status_check CHECK (
    visit_status IN ('not_started', 'in_progress', 'completed', 'cancelled', 'deferred')
  ),
  CONSTRAINT visit_runtime_instances_progress_check CHECK (
    progress_percent BETWEEN 0 AND 100
  ),
  CONSTRAINT visit_runtime_instances_subject_shell_unique UNIQUE (subject_id, visit_shell_id)
);

CREATE INDEX idx_visit_runtime_instances_org ON visit_runtime_instances(organization_id);
CREATE INDEX idx_visit_runtime_instances_study ON visit_runtime_instances(study_id);
CREATE INDEX idx_visit_runtime_instances_subject ON visit_runtime_instances(subject_id);
CREATE INDEX idx_visit_runtime_instances_package ON visit_runtime_instances(source_package_id);
CREATE INDEX idx_visit_runtime_instances_shell ON visit_runtime_instances(visit_shell_id);
CREATE INDEX idx_visit_runtime_instances_status ON visit_runtime_instances(visit_status);
CREATE INDEX idx_visit_runtime_instances_scheduled ON visit_runtime_instances(scheduled_at);

CREATE TABLE procedure_runtime_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_instance_id uuid NOT NULL REFERENCES visit_runtime_instances(id) ON DELETE CASCADE,
  source_package_id uuid NOT NULL REFERENCES runtime_source_packages(id),
  visit_shell_id uuid NOT NULL REFERENCES runtime_source_visit_shells(id),
  procedure_shell_id uuid NOT NULL REFERENCES runtime_source_procedure_shells(id),
  procedure_id uuid NOT NULL,
  blueprint_version_id uuid NOT NULL,
  procedure_code text NOT NULL,
  procedure_name text NOT NULL,
  procedure_order integer NOT NULL,
  required boolean NOT NULL DEFAULT true,
  procedure_status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL,
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT procedure_runtime_instances_status_check CHECK (
    procedure_status IN ('not_started', 'in_progress', 'completed', 'skipped', 'not_applicable')
  ),
  CONSTRAINT procedure_runtime_instances_unique_shell UNIQUE (visit_instance_id, procedure_shell_id)
);

CREATE INDEX idx_procedure_runtime_instances_org ON procedure_runtime_instances(organization_id);
CREATE INDEX idx_procedure_runtime_instances_study ON procedure_runtime_instances(study_id);
CREATE INDEX idx_procedure_runtime_instances_subject ON procedure_runtime_instances(subject_id);
CREATE INDEX idx_procedure_runtime_instances_visit ON procedure_runtime_instances(visit_instance_id);
CREATE INDEX idx_procedure_runtime_instances_shell ON procedure_runtime_instances(procedure_shell_id);
CREATE INDEX idx_procedure_runtime_instances_status ON procedure_runtime_instances(procedure_status);
CREATE INDEX idx_procedure_runtime_instances_order ON procedure_runtime_instances(procedure_order);

CREATE TABLE visit_runtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_instance_id uuid NOT NULL REFERENCES visit_runtime_instances(id) ON DELETE CASCADE,
  procedure_instance_id uuid NULL REFERENCES procedure_runtime_instances(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_id uuid NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT visit_runtime_events_type_check CHECK (
    event_type IN (
      'visit_instance_created',
      'visit_started',
      'visit_completed',
      'procedure_started',
      'procedure_completed',
      'procedure_skipped',
      'field_values_saved'
    )
  )
);

CREATE INDEX idx_visit_runtime_events_org ON visit_runtime_events(organization_id);
CREATE INDEX idx_visit_runtime_events_study ON visit_runtime_events(study_id);
CREATE INDEX idx_visit_runtime_events_subject ON visit_runtime_events(subject_id);
CREATE INDEX idx_visit_runtime_events_visit ON visit_runtime_events(visit_instance_id);
CREATE INDEX idx_visit_runtime_events_procedure ON visit_runtime_events(procedure_instance_id);
CREATE INDEX idx_visit_runtime_events_type ON visit_runtime_events(event_type);
CREATE INDEX idx_visit_runtime_events_timestamp ON visit_runtime_events(event_timestamp);

ALTER TABLE visit_runtime_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_runtime_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_runtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY visit_runtime_instances_select ON visit_runtime_instances
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_runtime_instances_insert ON visit_runtime_instances
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_runtime_instances_update ON visit_runtime_instances
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY procedure_runtime_instances_select ON procedure_runtime_instances
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY procedure_runtime_instances_insert ON procedure_runtime_instances
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY procedure_runtime_instances_update ON procedure_runtime_instances
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_runtime_events_select ON visit_runtime_events
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_runtime_events_insert ON visit_runtime_events
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );
