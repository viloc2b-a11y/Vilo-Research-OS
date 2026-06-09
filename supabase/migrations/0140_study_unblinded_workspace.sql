-- Phase 20: Unblinded Workspace (IP Accountability & Dispensing)

-- 1. IP Accountability Log
CREATE TABLE IF NOT EXISTS public.study_ip_accountability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  ip_lot text NOT NULL,
  kit_number text NOT NULL,
  quantity_received integer NOT NULL DEFAULT 0,
  quantity_dispensed integer NOT NULL DEFAULT 0,
  quantity_returned integer NOT NULL DEFAULT 0,
  quantity_destroyed integer NOT NULL DEFAULT 0,
  balance integer NOT NULL DEFAULT 0,
  performed_date date NOT NULL,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_ip_accountability_org ON public.study_ip_accountability(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_ip_accountability_study ON public.study_ip_accountability(study_id);

-- 2. IP Dispensing / Preparation Log
CREATE TABLE IF NOT EXISTS public.study_ip_dispensing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.study_runtime_visits(id) ON DELETE SET NULL,
  kit_number text NOT NULL,
  dose text NOT NULL,
  prepared_by uuid NOT NULL REFERENCES auth.users(id),
  dispensed_by uuid NOT NULL REFERENCES auth.users(id),
  dispensed_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_ip_dispensing_org ON public.study_ip_dispensing(organization_id);
CREATE INDEX IF NOT EXISTS idx_study_ip_dispensing_study ON public.study_ip_dispensing(study_id);
CREATE INDEX IF NOT EXISTS idx_study_ip_dispensing_subject ON public.study_ip_dispensing(subject_id);

ALTER TABLE public.study_ip_accountability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_ip_dispensing ENABLE ROW LEVEL SECURITY;

-- Note: Proper RLS for Unblinded should be enforced. For this setup we will use the application tier
-- guard 'canAccessUnblindedStudyArea' heavily as required by the spec. We will just enable basic org level RLS here.
DROP POLICY IF EXISTS ip_acc_select ON public.study_ip_accountability;
CREATE POLICY ip_acc_select ON public.study_ip_accountability FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()));
DROP POLICY IF EXISTS ip_acc_insert ON public.study_ip_accountability;
CREATE POLICY ip_acc_insert ON public.study_ip_accountability FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
DROP POLICY IF EXISTS ip_acc_update ON public.study_ip_accountability;
CREATE POLICY ip_acc_update ON public.study_ip_accountability FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS ip_disp_select ON public.study_ip_dispensing;
CREATE POLICY ip_disp_select ON public.study_ip_dispensing FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()));
DROP POLICY IF EXISTS ip_disp_insert ON public.study_ip_dispensing;
CREATE POLICY ip_disp_insert ON public.study_ip_dispensing FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
DROP POLICY IF EXISTS ip_disp_update ON public.study_ip_dispensing;
CREATE POLICY ip_disp_update ON public.study_ip_dispensing FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()));
