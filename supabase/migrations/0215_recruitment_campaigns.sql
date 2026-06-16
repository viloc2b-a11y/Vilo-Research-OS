CREATE TABLE IF NOT EXISTS public.recruitment_campaigns (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name               TEXT         NOT NULL,
  campaign_type      TEXT         NOT NULL CHECK (campaign_type IN (
                                    'referral_partner', 'digital_paid',
                                    'community_event', 'organic_seo', 'internal')),
  status             TEXT         NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  utm_campaign       TEXT,
  target_leads       INTEGER,
  target_enrollments INTEGER,
  start_date         DATE,
  end_date           DATE,
  created_by         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recruitment_campaigns_org_status_idx
  ON public.recruitment_campaigns (organization_id, status, created_at DESC);

-- touch_updated_at() already defined in earlier migrations (e.g. 0164_crm_and_communications.sql)
DROP TRIGGER IF EXISTS trg_recruitment_campaigns_updated_at ON public.recruitment_campaigns;
CREATE TRIGGER trg_recruitment_campaigns_updated_at
  BEFORE UPDATE ON public.recruitment_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Attach deferred FK from patient_leads.campaign_id (added bare in 0214, target table now exists)
ALTER TABLE public.patient_leads
  ADD CONSTRAINT patient_leads_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.recruitment_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patient_leads_campaign_id_idx
  ON public.patient_leads (campaign_id)
  WHERE campaign_id IS NOT NULL;
