-- Migration 0207: Add SLA fields to visit_snapshot_queries.
--
-- Enhancement: field-level queries can now carry SLA tracking equivalent to
-- subject_workflow_actions. sla_days is the resolution target; sla_deadline
-- is computed at open time as opened_at + sla_days.
--
-- Both columns are nullable — existing queries and new queries without an SLA
-- requirement carry NULL, which means no SLA is enforced.

ALTER TABLE public.visit_snapshot_queries
  ADD COLUMN IF NOT EXISTS sla_days integer NULL,
  ADD COLUMN IF NOT EXISTS sla_deadline date NULL;

CREATE INDEX IF NOT EXISTS idx_visit_snapshot_queries_sla_deadline
  ON public.visit_snapshot_queries(sla_deadline)
  WHERE sla_deadline IS NOT NULL;
