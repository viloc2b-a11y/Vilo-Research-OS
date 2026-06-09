DROP TABLE IF EXISTS expected_billables CASCADE;

CREATE TABLE IF NOT EXISTS expected_billables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id      TEXT NOT NULL,
  visit_name    TEXT NOT NULL,
  activity_id   TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  quantity      NUMERIC(10,4) NOT NULL,
  unit_cost     NUMERIC(10,2) NOT NULL,
  billable_to   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','triggered','billed','waived')),
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_id, visit_name, activity_id)
);

CREATE TABLE IF NOT EXISTS cliniq_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  SELECT study_id, visit_name, activity_id, activity_type,
         quantity * unit_cost AS amount, billable_to, created_at
  FROM expected_billables
  WHERE status = 'pending'
  ORDER BY created_at DESC;

CREATE INDEX IF NOT EXISTS idx_events_type
  ON cliniq_events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_study
  ON cliniq_events ((payload->>'study_id'));
CREATE INDEX IF NOT EXISTS idx_billables_study
  ON expected_billables (study_id);
CREATE INDEX IF NOT EXISTS idx_billables_status
  ON expected_billables (status);
