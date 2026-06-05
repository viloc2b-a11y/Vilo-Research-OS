-- 0173_study_data_readiness_reviews.sql

CREATE TABLE IF NOT EXISTS public.study_data_readiness_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  mode text NOT NULL,
  status text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_data_readiness_reviews_mode_check CHECK (mode IN ('internal_review', 'cra_workbook_precheck')),
  CONSTRAINT study_data_readiness_reviews_status_check CHECK (status IN ('ready', 'ready_with_warnings', 'blocked'))
);

CREATE INDEX IF NOT EXISTS study_data_readiness_reviews_study_idx
  ON public.study_data_readiness_reviews(study_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_data_readiness_reviews_org_idx
  ON public.study_data_readiness_reviews(organization_id);

ALTER TABLE public.study_data_readiness_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_data_readiness_reviews_select ON public.study_data_readiness_reviews;
CREATE POLICY study_data_readiness_reviews_select ON public.study_data_readiness_reviews
  FOR SELECT USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS study_data_readiness_reviews_insert ON public.study_data_readiness_reviews;
CREATE POLICY study_data_readiness_reviews_insert ON public.study_data_readiness_reviews
  FOR INSERT WITH CHECK (public.user_has_active_organization_membership(organization_id));

