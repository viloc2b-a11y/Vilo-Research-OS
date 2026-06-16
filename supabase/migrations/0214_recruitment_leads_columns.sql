-- Pre-migration audit (run manually in production before applying this migration):
-- SELECT organization_id, phone, COUNT(*) as dup_count
-- FROM patient_leads
-- WHERE phone IS NOT NULL
-- GROUP BY organization_id, phone
-- HAVING COUNT(*) > 1
-- ORDER BY dup_count DESC;
-- 0 rows = clean. N rows = noted for Phase 2 dedup API design. Does not block migration.

-- No UNIQUE constraint on phone is added in this migration.
-- Deduplication is enforced at the API layer in Phase 2.

CREATE TYPE public.recruitment_source_channel AS ENUM (
  'direct',
  'shared',
  'community',
  'organic_seo',
  'referral_partner',
  'campaign',
  'unknown'
);

ALTER TABLE public.patient_leads
  ADD COLUMN IF NOT EXISTS prescreen_score             INTEGER,
  ADD COLUMN IF NOT EXISTS recruitment_source_channel  public.recruitment_source_channel,
  ADD COLUMN IF NOT EXISTS referral_relationship_id    UUID
    REFERENCES public.contact_referral_relationships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id                 UUID,
  ADD COLUMN IF NOT EXISTS contact_attempts            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contacted_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS patient_leads_channel_idx
  ON public.patient_leads (organization_id, recruitment_source_channel)
  WHERE recruitment_source_channel IS NOT NULL;
