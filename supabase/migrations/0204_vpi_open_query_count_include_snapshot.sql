-- Migration 0204: Include visit_snapshot_queries in vpi_study_health_v1 open_query_count.
-- D4 closure: open_query_count previously counted only subject_workflow_actions
-- with action_type = 'query'. Field-level snapshot queries from the operational
-- review runtime were excluded. This migration recreates the view to sum both sources.

CREATE OR REPLACE VIEW public.vpi_study_health_v1
WITH (security_invoker = true) AS
SELECT
  s.organization_id,
  s.id AS study_id,
  s.name AS study_name,
  s.status AS study_status,

  (
    SELECT count(*)::int
    FROM public.study_subjects ss
    WHERE ss.study_id = s.id
  ) AS subject_count,

  (
    SELECT count(*)::int
    FROM public.study_subjects ss
    WHERE ss.study_id = s.id
      AND ss.enrollment_status = 'enrolled'
  ) AS enrolled_count,

  (
    SELECT count(*)::int
    FROM public.visits v
    WHERE v.study_id = s.id
      AND v.visit_status IN ('scheduled', 'checked_in', 'in_progress', 'confirmed')
  ) AS active_visit_count,

  (
    SELECT count(*)::int
    FROM public.visits v
    WHERE v.study_id = s.id
      AND v.visit_status IN ('missed', 'out_of_window')
  ) AS missed_visit_count,

  (
    (
      SELECT count(*)::int
      FROM public.subject_workflow_actions wa
      WHERE wa.study_id = s.id
        AND wa.action_type = 'query'
        AND wa.status IN ('open', 'in_progress')
    ) + (
      SELECT count(*)::int
      FROM public.visit_snapshot_queries vsq
      WHERE vsq.study_id = s.id
        AND vsq.query_status IN ('open', 'answered')
    )
  ) AS open_query_count,

  (
    SELECT count(*)::int
    FROM public.source_response_validation_findings f
    JOIN public.source_response_sets srs ON srs.id = f.response_set_id
    WHERE srs.study_id = s.id
      AND f.status = 'open'
  ) AS open_findings_count,

  (
    SELECT count(*)::int
    FROM public.procedure_executions pe
    WHERE pe.study_id = s.id
      AND pe.validation_status = 'blocked'
  ) AS blocked_procedure_count,

  (
    SELECT count(*)::int
    FROM public.visits v
    WHERE v.study_id = s.id
      AND v.source_status <> 'signed'
      AND v.completed_at IS NOT NULL
      AND v.completed_at < (now() - interval '48 hours')
  ) AS unsigned_over_48h_count,

  (
    SELECT count(*)::int
    FROM public.visits v
    WHERE v.study_id = s.id
      AND v.window_end = current_date
      AND v.visit_status NOT IN ('completed', 'cancelled', 'locked')
  ) AS visits_closing_window_today,

  (
    COALESCE(
      (
        SELECT max(oe.occurred_at)
        FROM public.operational_events oe
        WHERE oe.study_id = s.id
      ),
      s.updated_at
    ) < (now() - interval '14 days')
  ) AS stale_study_flag,

  COALESCE(
    (
      SELECT max(oe.occurred_at)
      FROM public.operational_events oe
      WHERE oe.study_id = s.id
    ),
    s.updated_at
  ) AS last_activity_at

FROM public.studies s;
