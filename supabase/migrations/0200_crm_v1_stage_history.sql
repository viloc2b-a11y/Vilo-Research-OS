-- Sprint I3: CRM v0 → v1 — patient lead stage transition audit trail
-- Records every stage change on a patient lead with actor, reason, and metadata.
-- This is the core of CRM v1: stateful lead funnel with full history.

CREATE TABLE IF NOT EXISTS public.patient_lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_lead_id uuid NOT NULL REFERENCES public.patient_leads(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_lead_stage_history_lead_idx
  ON public.patient_lead_stage_history(patient_lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS patient_lead_stage_history_org_idx
  ON public.patient_lead_stage_history(organization_id, created_at DESC);

ALTER TABLE public.patient_lead_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_lead_stage_history_select ON public.patient_lead_stage_history;
CREATE POLICY patient_lead_stage_history_select ON public.patient_lead_stage_history
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
  );

DROP POLICY IF EXISTS patient_lead_stage_history_insert ON public.patient_lead_stage_history;
CREATE POLICY patient_lead_stage_history_insert ON public.patient_lead_stage_history
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
  );
