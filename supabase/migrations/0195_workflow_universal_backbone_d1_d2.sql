-- Migration 0195: Universal Workflow Backbone — Sprint D Phase 1 (D1 + D2)
--
-- Extends subject_workflow_actions to support study-level object linking
-- (CAPA, Amendment, Deviation, Safety Event) and adds SLA/escalation fields.
-- All changes are ADDITIVE. Existing subject-scoped workflow actions are
-- fully backward-compatible.
--
-- D1: Universal object linking — optional FKs to CAPA, Amendment, Deviation, Safety Event.
-- D2: Escalation/ownership — sla_days, sla_deadline, escalated_at, escalated_to, escalation_level.

-- ---------------------------------------------------------------------------
-- 1. Make study_subject_id nullable
--    Allows study-level actions that are not anchored to a specific subject
--    (e.g. a CAPA action on a site-wide deviation).
-- ---------------------------------------------------------------------------

ALTER TABLE public.subject_workflow_actions
  ALTER COLUMN study_subject_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Extend action_type CHECK constraint
--    New values: capa_item | amendment_reconsent | deviation_followup | safety_followup
-- ---------------------------------------------------------------------------

ALTER TABLE public.subject_workflow_actions
  DROP CONSTRAINT IF EXISTS subject_workflow_actions_action_type_check;

ALTER TABLE public.subject_workflow_actions
  ADD CONSTRAINT subject_workflow_actions_action_type_check
  CHECK (action_type IN (
    'action',
    'query',
    'signature_request',
    'follow_up',
    'correction',
    'capa_item',
    'amendment_reconsent',
    'deviation_followup',
    'safety_followup'
  ));

-- ---------------------------------------------------------------------------
-- 3. Object link columns (D1)
-- ---------------------------------------------------------------------------

ALTER TABLE public.subject_workflow_actions
  ADD COLUMN IF NOT EXISTS capa_id uuid
    REFERENCES public.capa_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amendment_impact_id uuid
    REFERENCES public.amendment_subject_impacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deviation_id uuid
    REFERENCES public.protocol_deviations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_event_id uuid
    REFERENCES public.safety_events(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. SLA and escalation fields (D2)
-- ---------------------------------------------------------------------------

ALTER TABLE public.subject_workflow_actions
  ADD COLUMN IF NOT EXISTS sla_days int,
  ADD COLUMN IF NOT EXISTS sla_deadline date,
  ADD COLUMN IF NOT EXISTS escalation_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. Indexes for new FK columns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS workflow_actions_capa_idx
  ON public.subject_workflow_actions (capa_id)
  WHERE capa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_actions_deviation_idx
  ON public.subject_workflow_actions (deviation_id)
  WHERE deviation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_actions_safety_event_idx
  ON public.subject_workflow_actions (safety_event_id)
  WHERE safety_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_actions_amendment_impact_idx
  ON public.subject_workflow_actions (amendment_impact_id)
  WHERE amendment_impact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_actions_sla_deadline_idx
  ON public.subject_workflow_actions (organization_id, sla_deadline, status)
  WHERE sla_deadline IS NOT NULL AND status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS workflow_actions_escalation_idx
  ON public.subject_workflow_actions (organization_id, escalation_level, status)
  WHERE escalation_level > 0;

-- ---------------------------------------------------------------------------
-- 6. Update scope enforcement trigger
--
--    Adds a fourth branch for study-level actions:
--    when no procedure/visit/subject context is set,
--    organization_id and study_id must be provided explicitly by the caller.
--    study_subject_id remains null for these actions — this is intentional.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.phase6b9_enforce_subject_workflow_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_study uuid;
  v_subject uuid;
  v_visit uuid;
BEGIN
  IF new.procedure_execution_id IS NOT NULL THEN
    SELECT pe.organization_id, pe.study_id, v.study_subject_id, pe.visit_id
      INTO v_org, v_study, v_subject, v_visit
    FROM public.procedure_executions pe
    JOIN public.visits v ON v.id = pe.visit_id
    WHERE pe.id = new.procedure_execution_id;

    IF v_org IS NULL THEN RAISE EXCEPTION 'procedure_execution_id not found'; END IF;

    new.organization_id := v_org;
    new.study_id := v_study;
    new.study_subject_id := v_subject;
    IF new.visit_id IS NULL THEN
      new.visit_id := v_visit;
    ELSIF new.visit_id IS DISTINCT FROM v_visit THEN
      RAISE EXCEPTION 'visit_id must match procedure_execution.visit_id';
    END IF;

  ELSIF new.visit_id IS NOT NULL THEN
    SELECT v.organization_id, v.study_id, v.study_subject_id
      INTO v_org, v_study, v_subject
    FROM public.visits v
    WHERE v.id = new.visit_id;

    IF v_org IS NULL THEN RAISE EXCEPTION 'visit_id not found'; END IF;

    new.organization_id := v_org;
    new.study_id := v_study;
    new.study_subject_id := v_subject;

  ELSIF new.study_subject_id IS NOT NULL THEN
    SELECT ss.organization_id, ss.study_id
      INTO v_org, v_study
    FROM public.study_subjects ss
    WHERE ss.id = new.study_subject_id;

    IF v_org IS NULL THEN RAISE EXCEPTION 'study_subject_id not found'; END IF;

    new.organization_id := v_org;
    new.study_id := v_study;

  ELSE
    -- Study-level action: no subject/visit/procedure context.
    -- organization_id and study_id must be set explicitly by the caller.
    IF new.organization_id IS NULL THEN
      RAISE EXCEPTION 'organization_id required for study-level workflow actions';
    END IF;
    IF new.study_id IS NULL THEN
      RAISE EXCEPTION 'study_id required for study-level workflow actions';
    END IF;
    -- study_subject_id stays null — intentional.
  END IF;

  new.updated_at := now();
  IF new.status IN ('resolved', 'cancelled') AND new.resolved_at IS NULL THEN
    new.resolved_at := now();
  END IF;
  IF new.status NOT IN ('resolved', 'cancelled') THEN
    new.resolved_at := null;
    new.resolved_by := null;
    new.resolution_note := null;
  END IF;

  RETURN new;
END;
$$;

COMMENT ON TABLE public.subject_workflow_actions IS
  'Coordinator-facing workflow actions. Anchored to a subject (study_subject_id) '
  'for subject-level work, or to study_id alone for study-level objects '
  '(CAPA, deviation, amendment, safety event).';
