-- Sprint J1: Export privacy engine — audit trail
-- Records every data export event with actor, scope, report type, and applied mask level.

CREATE TABLE IF NOT EXISTS public.export_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  report_type text NOT NULL,
  mask_level text NOT NULL CHECK (mask_level IN ('none', 'partial', 'full')),
  record_count integer NOT NULL DEFAULT 0,
  masked_fields text[] NOT NULL DEFAULT '{}',
  export_format text NOT NULL DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'pdf')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  exported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_audit_log_org_idx
  ON public.export_audit_log(organization_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS export_audit_log_actor_idx
  ON public.export_audit_log(actor_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS export_audit_log_study_idx
  ON public.export_audit_log(study_id, exported_at DESC)
  WHERE study_id IS NOT NULL;

ALTER TABLE public.export_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS export_audit_log_select ON public.export_audit_log;
CREATE POLICY export_audit_log_select ON public.export_audit_log
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
  );

DROP POLICY IF EXISTS export_audit_log_insert ON public.export_audit_log;
CREATE POLICY export_audit_log_insert ON public.export_audit_log
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
  );
