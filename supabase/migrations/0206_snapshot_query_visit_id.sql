-- Migration 0206: Add visit_id to visit_snapshot_queries.
--
-- Enhancement: bridges snapshot queries back to the visits table so
-- loadWorkflowCountsByVisit can include snapshot query counts in per-visit
-- badge totals without joining through the runtime snapshot chain.
--
-- Column is nullable: existing rows have no visit context. New queries opened
-- while viewing a specific visit page should include visit_id in the request body.

ALTER TABLE public.visit_snapshot_queries
  ADD COLUMN IF NOT EXISTS visit_id uuid NULL REFERENCES public.visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visit_snapshot_queries_visit_id
  ON public.visit_snapshot_queries(visit_id)
  WHERE visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visit_snapshot_queries_visit_status
  ON public.visit_snapshot_queries(visit_id, query_status)
  WHERE visit_id IS NOT NULL;
