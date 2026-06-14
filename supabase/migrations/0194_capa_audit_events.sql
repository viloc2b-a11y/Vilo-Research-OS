CREATE TABLE IF NOT EXISTS public.capa_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  capa_id UUID NOT NULL REFERENCES public.capa_actions(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS capa_audit_events_capa_idx ON public.capa_audit_events(capa_id);
CREATE INDEX IF NOT EXISTS capa_audit_events_org_idx ON public.capa_audit_events(organization_id, changed_at DESC);

ALTER TABLE public.capa_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY capa_audit_events_select ON public.capa_audit_events
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY capa_audit_events_insert ON public.capa_audit_events
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- NO UPDATE policy — append-only.

COMMENT ON TABLE public.capa_audit_events IS
  'Append-only audit log for CAPA status transitions. Never UPDATE, only INSERT.';
