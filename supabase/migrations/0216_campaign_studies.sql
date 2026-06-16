CREATE TABLE IF NOT EXISTS public.campaign_studies (
  campaign_id        UUID     NOT NULL REFERENCES public.recruitment_campaigns(id) ON DELETE CASCADE,
  study_id           UUID     NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  target_leads       INTEGER,
  target_enrollments INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, study_id)
);

CREATE INDEX IF NOT EXISTS campaign_studies_study_id_idx
  ON public.campaign_studies (study_id);
