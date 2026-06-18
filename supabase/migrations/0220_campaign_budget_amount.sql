ALTER TABLE recruitment_campaigns
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(14, 2);
