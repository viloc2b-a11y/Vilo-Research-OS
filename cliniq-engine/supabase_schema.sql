-- Run this via: docker exec [supabase-db-container] psql -U postgres -d postgres -f /path/to/supabase_schema.sql
-- Or paste into Supabase Studio SQL Editor

CREATE TABLE IF NOT EXISTS cliniq_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expected_billables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id      TEXT NOT NULL,
  visit_name    TEXT NOT NULL,
  line_code     TEXT NOT NULL,
  description   TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','triggered','paid','waived')),
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(study_id, visit_name, line_code)
);

CREATE TABLE IF NOT EXISTS visit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id      TEXT NOT NULL,
  visit_name    TEXT NOT NULL,
  completed_by  TEXT NOT NULL DEFAULT 'system',
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW leakage_summary AS
  SELECT study_id, visit_name, line_code, description, amount, created_at
  FROM expected_billables
  WHERE status = 'pending'
  ORDER BY created_at DESC;

CREATE INDEX IF NOT EXISTS idx_events_type        ON cliniq_events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_study       ON cliniq_events ((payload->>'study_id'));
CREATE INDEX IF NOT EXISTS idx_events_created     ON cliniq_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billables_study    ON expected_billables (study_id);
CREATE INDEX IF NOT EXISTS idx_billables_status   ON expected_billables (status);
CREATE INDEX IF NOT EXISTS idx_visitlog_study     ON visit_log (study_id);
