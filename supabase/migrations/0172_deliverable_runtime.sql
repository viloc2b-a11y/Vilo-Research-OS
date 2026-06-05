-- 0172_deliverable_runtime.sql

CREATE TABLE IF NOT EXISTS public.deliverable_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  system_code text NOT NULL,
  name text NOT NULL,
  target_audience text[] NOT NULL DEFAULT '{}',
  allowed_formats text[] NOT NULL DEFAULT '{}',
  scope_model text NOT NULL,
  evidence_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliverable_definitions_system_code_unique UNIQUE (organization_id, system_code)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_definitions_org ON public.deliverable_definitions(organization_id);

CREATE TABLE IF NOT EXISTS public.deliverable_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES public.deliverable_definitions(id) ON DELETE CASCADE,
  run_status text NOT NULL DEFAULT 'pending',
  run_by uuid NOT NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliverable_runs_status_check CHECK (run_status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_deliverable_runs_org ON public.deliverable_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_runs_def ON public.deliverable_runs(definition_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_runs_status ON public.deliverable_runs(run_status);

CREATE TABLE IF NOT EXISTS public.deliverable_run_filters (
  run_id uuid PRIMARY KEY REFERENCES public.deliverable_runs(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  subject_id uuid NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  visit_instance_id uuid NULL REFERENCES public.visit_runtime_instances(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_run_filters_study ON public.deliverable_run_filters(study_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_run_filters_subject ON public.deliverable_run_filters(subject_id);

CREATE TABLE IF NOT EXISTS public.deliverable_run_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.deliverable_runs(id) ON DELETE CASCADE,
  format text NOT NULL,
  storage_path text NOT NULL,
  file_hash text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_run_outputs_run ON public.deliverable_run_outputs(run_id);

CREATE TABLE IF NOT EXISTS public.deliverable_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.deliverable_runs(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_audit_events_run ON public.deliverable_audit_events(run_id);

-- RLS
ALTER TABLE public.deliverable_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_run_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_run_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_audit_events ENABLE ROW LEVEL SECURITY;

-- Definitions
DROP POLICY IF EXISTS deliverable_definitions_select ON public.deliverable_definitions;
CREATE POLICY deliverable_definitions_select ON public.deliverable_definitions
  FOR SELECT USING (public.user_has_active_organization_membership(organization_id));

-- Runs
DROP POLICY IF EXISTS deliverable_runs_select ON public.deliverable_runs;
CREATE POLICY deliverable_runs_select ON public.deliverable_runs
  FOR SELECT USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS deliverable_runs_insert ON public.deliverable_runs;
CREATE POLICY deliverable_runs_insert ON public.deliverable_runs
  FOR INSERT WITH CHECK (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS deliverable_runs_update ON public.deliverable_runs;
CREATE POLICY deliverable_runs_update ON public.deliverable_runs
  FOR UPDATE USING (public.user_has_active_organization_membership(organization_id));

-- Filters
DROP POLICY IF EXISTS deliverable_run_filters_select ON public.deliverable_run_filters;
CREATE POLICY deliverable_run_filters_select ON public.deliverable_run_filters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );

DROP POLICY IF EXISTS deliverable_run_filters_insert ON public.deliverable_run_filters;
CREATE POLICY deliverable_run_filters_insert ON public.deliverable_run_filters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );

-- Outputs
DROP POLICY IF EXISTS deliverable_run_outputs_select ON public.deliverable_run_outputs;
CREATE POLICY deliverable_run_outputs_select ON public.deliverable_run_outputs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );

DROP POLICY IF EXISTS deliverable_run_outputs_insert ON public.deliverable_run_outputs;
CREATE POLICY deliverable_run_outputs_insert ON public.deliverable_run_outputs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );

-- Audit
DROP POLICY IF EXISTS deliverable_audit_events_select ON public.deliverable_audit_events;
CREATE POLICY deliverable_audit_events_select ON public.deliverable_audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );

DROP POLICY IF EXISTS deliverable_audit_events_insert ON public.deliverable_audit_events;
CREATE POLICY deliverable_audit_events_insert ON public.deliverable_audit_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverable_runs dr
      WHERE dr.id = run_id AND public.user_has_active_organization_membership(dr.organization_id)
    )
  );
