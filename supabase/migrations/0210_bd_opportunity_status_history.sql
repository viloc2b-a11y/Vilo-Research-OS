CREATE TABLE IF NOT EXISTS public.bd_opportunity_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bd_opportunity_id uuid NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bd_opportunity_status_history_opp_idx
  ON public.bd_opportunity_status_history(organization_id, bd_opportunity_id);

ALTER TABLE public.bd_opportunity_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bd_opportunity_status_history_select ON public.bd_opportunity_status_history;
CREATE POLICY bd_opportunity_status_history_select ON public.bd_opportunity_status_history
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
  );

DROP POLICY IF EXISTS bd_opportunity_status_history_insert ON public.bd_opportunity_status_history;
CREATE POLICY bd_opportunity_status_history_insert ON public.bd_opportunity_status_history
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
  );
