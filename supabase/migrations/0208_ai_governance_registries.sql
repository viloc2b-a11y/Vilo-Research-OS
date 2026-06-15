-- Migration 0208: AI Governance Registries — Use Case, Validation, Configuration, Human Review.
--
-- Extends GOV-0 (ai_system_inventory + ai_incidents from 0082) with four
-- use-case-level governance registries required for regulatory-ready AI workflows.
-- These are platform-level tables (no organization_id) — they describe what the
-- Vilo OS platform does, not per-org operational data.
-- Additive only. No destructive changes.

-- ---------------------------------------------------------------------------
-- 1. ai_use_case_registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_use_case_registry (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module                text        NOT NULL,
  use_case_name         text        NOT NULL,
  purpose               text        NOT NULL,
  risk_level            text        NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  workflow_area         text        NOT NULL,
  human_review_required boolean     NOT NULL DEFAULT false,
  human_reviewer_role   text,
  input_sources         text[]      NOT NULL DEFAULT '{}',
  output_type           text        NOT NULL,
  current_status        text        NOT NULL DEFAULT 'active'
                                    CHECK (current_status IN ('active', 'retired', 'under_review', 'pending_validation')),
  owner_role            text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_use_case_registry_module_idx
  ON public.ai_use_case_registry (module);

CREATE INDEX IF NOT EXISTS ai_use_case_registry_risk_level_idx
  ON public.ai_use_case_registry (risk_level);

CREATE INDEX IF NOT EXISTS ai_use_case_registry_status_idx
  ON public.ai_use_case_registry (current_status);

COMMENT ON TABLE public.ai_use_case_registry IS
  'GOV-2: platform-level registry of every AI-assisted or automation-supported use case in Vilo OS.';

DROP TRIGGER IF EXISTS ai_use_case_registry_set_updated_at ON public.ai_use_case_registry;
CREATE TRIGGER ai_use_case_registry_set_updated_at
  BEFORE UPDATE ON public.ai_use_case_registry
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. ai_validation_registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_validation_registry (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id              uuid        NOT NULL REFERENCES public.ai_use_case_registry(id) ON DELETE CASCADE,
  validation_name          text        NOT NULL,
  validation_scope         text        NOT NULL,
  sample_type              text        NOT NULL,
  expected_behavior        text        NOT NULL,
  observed_behavior        text,
  sme_review_required      boolean     NOT NULL DEFAULT false,
  sme_reviewer_role        text,
  validation_result        text        CHECK (validation_result IN ('pass', 'fail', 'partial', 'pending')),
  validation_artifact_path text,
  validated_at             timestamptz,
  validated_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_validation_registry_use_case_idx
  ON public.ai_validation_registry (use_case_id);

CREATE INDEX IF NOT EXISTS ai_validation_registry_result_idx
  ON public.ai_validation_registry (validation_result);

COMMENT ON TABLE public.ai_validation_registry IS
  'GOV-2: validation evidence records per AI use case.';

DROP TRIGGER IF EXISTS ai_validation_registry_set_updated_at ON public.ai_validation_registry;
CREATE TRIGGER ai_validation_registry_set_updated_at
  BEFORE UPDATE ON public.ai_validation_registry
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. ai_configuration_registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_configuration_registry (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id        uuid        NOT NULL REFERENCES public.ai_use_case_registry(id) ON DELETE CASCADE,
  config_type        text        NOT NULL
                                 CHECK (config_type IN ('model', 'prompt', 'parser', 'extractor', 'automation_rule', 'ruleset', 'threshold')),
  config_name        text        NOT NULL,
  config_version     text        NOT NULL,
  change_reason      text        NOT NULL,
  previous_version   text,
  effective_date     date        NOT NULL,
  retired_at         date,
  validation_required boolean    NOT NULL DEFAULT false,
  validation_status  text        NOT NULL DEFAULT 'not_required'
                                 CHECK (validation_status IN ('not_required', 'pending', 'in_progress', 'validated', 'failed')),
  approved_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_configuration_registry_use_case_idx
  ON public.ai_configuration_registry (use_case_id);

CREATE INDEX IF NOT EXISTS ai_configuration_registry_effective_date_idx
  ON public.ai_configuration_registry (use_case_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS ai_configuration_registry_active_idx
  ON public.ai_configuration_registry (use_case_id, retired_at)
  WHERE retired_at IS NULL;

COMMENT ON TABLE public.ai_configuration_registry IS
  'GOV-2: change control log for model, prompt, parser, extractor, automation rule, and ruleset changes per AI use case.';

DROP TRIGGER IF EXISTS ai_configuration_registry_set_updated_at ON public.ai_configuration_registry;
CREATE TRIGGER ai_configuration_registry_set_updated_at
  BEFORE UPDATE ON public.ai_configuration_registry
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ai_human_review_registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_human_review_registry (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id       uuid        NOT NULL REFERENCES public.ai_use_case_registry(id) ON DELETE CASCADE,
  module            text        NOT NULL,
  review_step       text        NOT NULL,
  reviewer_role     text        NOT NULL,
  is_required       boolean     NOT NULL DEFAULT true,
  decision_options  text[]      NOT NULL DEFAULT '{}',
  audit_event_table text,
  evidence_location text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_human_review_registry_use_case_idx
  ON public.ai_human_review_registry (use_case_id);

CREATE INDEX IF NOT EXISTS ai_human_review_registry_module_idx
  ON public.ai_human_review_registry (module);

COMMENT ON TABLE public.ai_human_review_registry IS
  'GOV-2: human-in-the-loop checkpoint definitions per AI use case.';

DROP TRIGGER IF EXISTS ai_human_review_registry_set_updated_at ON public.ai_human_review_registry;
CREATE TRIGGER ai_human_review_registry_set_updated_at
  BEFORE UPDATE ON public.ai_human_review_registry
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — authenticated users can read; write open to authenticated for now
-- (governance is internal/admin; no per-org scoping needed at this layer)
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_use_case_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_validation_registry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configuration_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_human_review_registry  ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
DROP POLICY IF EXISTS ai_use_case_registry_select ON public.ai_use_case_registry;
CREATE POLICY ai_use_case_registry_select ON public.ai_use_case_registry
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_validation_registry_select ON public.ai_validation_registry;
CREATE POLICY ai_validation_registry_select ON public.ai_validation_registry
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_configuration_registry_select ON public.ai_configuration_registry;
CREATE POLICY ai_configuration_registry_select ON public.ai_configuration_registry
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_human_review_registry_select ON public.ai_human_review_registry;
CREATE POLICY ai_human_review_registry_select ON public.ai_human_review_registry
  FOR SELECT USING (auth.role() = 'authenticated');

-- Write: authenticated (admin enforcement handled at app layer; governance is internal)
DROP POLICY IF EXISTS ai_use_case_registry_write ON public.ai_use_case_registry;
CREATE POLICY ai_use_case_registry_write ON public.ai_use_case_registry
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_validation_registry_write ON public.ai_validation_registry;
CREATE POLICY ai_validation_registry_write ON public.ai_validation_registry
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_configuration_registry_write ON public.ai_configuration_registry;
CREATE POLICY ai_configuration_registry_write ON public.ai_configuration_registry
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS ai_human_review_registry_write ON public.ai_human_review_registry;
CREATE POLICY ai_human_review_registry_write ON public.ai_human_review_registry
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

REVOKE ALL ON TABLE public.ai_use_case_registry      FROM anon, public;
REVOKE ALL ON TABLE public.ai_validation_registry    FROM anon, public;
REVOKE ALL ON TABLE public.ai_configuration_registry FROM anon, public;
REVOKE ALL ON TABLE public.ai_human_review_registry  FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_use_case_registry      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_validation_registry    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_configuration_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_human_review_registry  TO authenticated;
