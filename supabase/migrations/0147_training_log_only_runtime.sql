-- Training Log runtime only.
-- Scope: study_training_items, study_training_assignments, training audit.
-- Does not create or alter Delegation, Visit Runtime, Procedure, SDV, or Query Workflow tables.

CREATE TABLE IF NOT EXISTS public.study_training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  training_type text NOT NULL,
  training_topic text NOT NULL,
  training_material_title text NOT NULL,
  training_material_document_id uuid,
  trainer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trainer_name text,
  trainer_initials text,
  requires_trainer_signature boolean NOT NULL DEFAULT false,
  requires_pi_acknowledgment boolean NOT NULL DEFAULT false,
  certificate_expected boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_training_items_topic_required CHECK (length(trim(training_topic)) > 0),
  CONSTRAINT study_training_items_type_required CHECK (length(trim(training_type)) > 0)
);

CREATE TABLE IF NOT EXISTS public.study_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  training_item_id uuid NOT NULL REFERENCES public.study_training_items(id) ON DELETE CASCADE,
  trainee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  trainee_name text NOT NULL,
  trainee_role text NOT NULL,
  trainee_initials text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  training_status text NOT NULL DEFAULT 'Assigned',
  certificate_attached boolean NOT NULL DEFAULT false,
  certificate_number text,
  notes text,
  trainee_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  trainer_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  completed_at timestamptz,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amendment_required_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_training_assignments_status_check CHECK (
    training_status IN (
      'Assigned',
      'Pending Trainee Signature',
      'Pending Trainer Signature',
      'Pending PI Acknowledgment',
      'Completed',
      'Locked',
      'Cancelled',
      'Reopened'
    )
  ),
  CONSTRAINT study_training_assignments_unique UNIQUE (training_item_id, trainee_user_id)
);

CREATE TABLE IF NOT EXISTS public.study_training_assignment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  training_assignment_id uuid NOT NULL REFERENCES public.study_training_assignments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_training_audit_event_required CHECK (length(trim(event_type)) > 0),
  CONSTRAINT study_training_audit_payload_object CHECK (jsonb_typeof(event_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_study_training_items_study
  ON public.study_training_items(study_id);
CREATE INDEX IF NOT EXISTS idx_study_training_assignments_study
  ON public.study_training_assignments(study_id);
CREATE INDEX IF NOT EXISTS idx_study_training_assignments_trainee
  ON public.study_training_assignments(trainee_user_id);
CREATE INDEX IF NOT EXISTS idx_training_assignment_trainee_sig
  ON public.study_training_assignments(trainee_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_training_assignment_trainer_sig
  ON public.study_training_assignments(trainer_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_training_assignment_pi_sig
  ON public.study_training_assignments(pi_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_study_training_audit_assignment
  ON public.study_training_assignment_audit(training_assignment_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.study_training_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_training_items_touch_updated_at
  ON public.study_training_items;
CREATE TRIGGER study_training_items_touch_updated_at
BEFORE UPDATE ON public.study_training_items
FOR EACH ROW EXECUTE FUNCTION public.study_training_touch_updated_at();

DROP TRIGGER IF EXISTS study_training_assignments_touch_updated_at
  ON public.study_training_assignments;
CREATE TRIGGER study_training_assignments_touch_updated_at
BEFORE UPDATE ON public.study_training_assignments
FOR EACH ROW EXECUTE FUNCTION public.study_training_touch_updated_at();

CREATE OR REPLACE FUNCTION public.study_training_prevent_locked_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.training_status IN ('Completed', 'Locked') THEN
    RAISE EXCEPTION 'training assignment is locked; create an audited amendment/reopen workflow before editing';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_training_prevent_locked_update
  ON public.study_training_assignments;
CREATE TRIGGER study_training_prevent_locked_update
BEFORE UPDATE ON public.study_training_assignments
FOR EACH ROW
WHEN (OLD.training_status IN ('Completed', 'Locked'))
EXECUTE FUNCTION public.study_training_prevent_locked_mutation();

ALTER TABLE public.study_training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_training_assignment_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_training_items_select ON public.study_training_items;
CREATE POLICY study_training_items_select ON public.study_training_items
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_items_insert ON public.study_training_items;
CREATE POLICY study_training_items_insert ON public.study_training_items
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_assignments_select ON public.study_training_assignments;
CREATE POLICY study_training_assignments_select ON public.study_training_assignments
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_assignments_insert ON public.study_training_assignments;
CREATE POLICY study_training_assignments_insert ON public.study_training_assignments
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_assignments_update ON public.study_training_assignments;
CREATE POLICY study_training_assignments_update ON public.study_training_assignments
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_audit_select ON public.study_training_assignment_audit;
CREATE POLICY study_training_audit_select ON public.study_training_assignment_audit
  FOR SELECT USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS study_training_audit_insert ON public.study_training_assignment_audit;
CREATE POLICY study_training_audit_insert ON public.study_training_assignment_audit
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_study_access(study_id)
  );

COMMENT ON TABLE public.study_training_assignments IS
  'Training Log assignment surface. Signatures are centralized through operational_signature_requests.';
