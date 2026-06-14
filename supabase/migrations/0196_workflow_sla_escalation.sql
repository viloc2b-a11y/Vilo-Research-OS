-- Migration 0196: Workflow SLA Escalation Function
--
-- Adds a callable function that escalates open workflow actions whose
-- sla_deadline has passed. Called on demand (API route or scheduled job).
-- Idempotent: only escalates actions at escalation_level = 0.

CREATE OR REPLACE FUNCTION public.escalate_overdue_sla_actions(
  p_organization_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.subject_workflow_actions
  SET
    escalation_level = 1,
    escalated_at     = COALESCE(escalated_at, now())
  WHERE
    organization_id = p_organization_id
    AND status      IN ('open', 'in_progress')
    AND sla_deadline IS NOT NULL
    AND sla_deadline < current_date
    AND escalation_level = 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.escalate_overdue_sla_actions(uuid) IS
  'Sets escalation_level = 1 and records escalated_at for every open/in_progress '
  'workflow action whose sla_deadline has passed. Only escalates actions that are '
  'still at level 0 (idempotent). Returns count of newly escalated rows.';

-- Grant execution to the authenticated role so the API can call it via rpc().
GRANT EXECUTE ON FUNCTION public.escalate_overdue_sla_actions(uuid)
  TO authenticated;
