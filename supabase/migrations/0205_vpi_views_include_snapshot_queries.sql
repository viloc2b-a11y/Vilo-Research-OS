-- Migration 0205: Include visit_snapshot_queries in VPI subject risk signals
-- and coordinator load views.
--
-- D4 closure (RPC path):
--   vpi_subject_risk_signals_v1 — adds open_query signals from visit_snapshot_queries
--     so the SQL RPC path surfaces field-level queries in the subject risk queue.
--   vpi_coordinator_load_v1 — extends open_actions CTE to union visit_snapshot_queries
--     so coordinator load counts include snapshot queries alongside workflow actions.
--
-- The fallback (signal) path already handles both correctly:
--   countOpenQueriesForStudy sums both tables,
--   loadSnapshotQueryRiskSignals feeds the risk queue,
--   loadCoordinatorLoadSnapshotQueries merges into coordinator load.
-- This migration closes the same gaps for the RPC path.
--
-- Both views are idempotent (CREATE OR REPLACE VIEW).

-- ---------------------------------------------------------------------------
-- 1. vpi_subject_risk_signals_v1
--    Adds 'open_query' signals from visit_snapshot_queries (high + critical only,
--    matching the filter used by loadSnapshotQueryRiskSignals in the fallback path).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vpi_subject_risk_signals_v1
WITH (security_invoker = true) AS

SELECT
  v.organization_id,
  v.study_id,
  v.study_subject_id AS subject_id,
  ss.subject_identifier,
  st.name AS study_name,
  'missed_visit'::text AS signal_kind,
  ('visits:' || v.id::text) AS signal_source,
  v.id AS signal_entity_id,
  COALESCE(v.updated_at, v.created_at) AS signal_created_at,
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(v.updated_at, v.created_at))) / 3600.0)::int AS signal_age_hours,
  0 AS severity_rank,
  'Open visit and resolve missed status'::text AS recommended_action
FROM public.visits v
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = v.study_id
WHERE v.visit_status = 'missed'

UNION ALL

SELECT
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'out_of_window',
  'visits:' || v.id::text,
  v.id,
  COALESCE(v.updated_at, v.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(v.updated_at, v.created_at))) / 3600.0)::int,
  1,
  'Review out-of-window visit'::text
FROM public.visits v
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = v.study_id
WHERE v.visit_status = 'out_of_window'
   OR v.window_status = 'outside_window'

UNION ALL

SELECT
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'window_warning',
  'visits:' || v.id::text,
  v.id,
  COALESCE(v.updated_at, v.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(v.updated_at, v.created_at))) / 3600.0)::int,
  2,
  'Monitor visit window warning'::text
FROM public.visits v
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = v.study_id
WHERE v.window_status = 'warning'
  AND v.visit_status NOT IN ('completed', 'cancelled', 'locked')
  AND v.visit_status <> 'missed'
  AND v.visit_status <> 'out_of_window'

UNION ALL

SELECT
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'window_closing_today',
  'visits:' || v.id::text,
  v.id,
  COALESCE(v.window_end::timestamptz, v.updated_at, v.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(v.window_end::timestamptz, v.updated_at, v.created_at))) / 3600.0)::int,
  1,
  'Confirm visit before window closes today'::text
FROM public.visits v
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = v.study_id
WHERE v.window_end = current_date
  AND v.visit_status NOT IN ('completed', 'cancelled', 'locked')

UNION ALL

SELECT
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'unsigned_procedure_48h',
  'visits:' || v.id::text,
  v.id,
  v.completed_at,
  ROUND(EXTRACT(EPOCH FROM (now() - v.completed_at)) / 3600.0)::int,
  1,
  'Sign completed visit source (>48h)'::text
FROM public.visits v
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = v.study_id
WHERE v.source_status <> 'signed'
  AND v.completed_at IS NOT NULL
  AND v.completed_at < (now() - interval '48 hours')

UNION ALL

SELECT
  wa.organization_id,
  wa.study_id,
  wa.study_subject_id,
  ss.subject_identifier,
  st.name,
  'overdue_action',
  'subject_workflow_actions:' || wa.id::text,
  wa.id,
  COALESCE(wa.updated_at, wa.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(wa.due_date::timestamptz, wa.updated_at))) / 3600.0)::int,
  1,
  'Complete overdue workflow action'::text
FROM public.subject_workflow_actions wa
JOIN public.study_subjects ss ON ss.id = wa.study_subject_id
JOIN public.studies st ON st.id = wa.study_id
WHERE wa.status IN ('open', 'in_progress')
  AND wa.due_date IS NOT NULL
  AND wa.due_date < current_date

UNION ALL

SELECT
  pe.organization_id,
  pe.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'blocked_procedure',
  'procedure_executions:' || pe.id::text,
  pe.id,
  COALESCE(pe.updated_at, pe.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(pe.updated_at, pe.created_at))) / 3600.0)::int,
  0,
  'Resolve blocking procedure validation'::text
FROM public.procedure_executions pe
JOIN public.visits v ON v.id = pe.visit_id
JOIN public.study_subjects ss ON ss.id = v.study_subject_id
JOIN public.studies st ON st.id = pe.study_id
WHERE pe.validation_status = 'blocked'

UNION ALL

SELECT
  ss.organization_id,
  ss.study_id,
  ss.id,
  ss.subject_identifier,
  st.name,
  'stale_subject',
  'study_subjects:' || ss.id::text,
  ss.id,
  COALESCE(ss.updated_at, ss.created_at),
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(ss.updated_at, ss.created_at))) / 3600.0)::int,
  2,
  'Review subject with no recent activity'::text
FROM public.study_subjects ss
JOIN public.studies st ON st.id = ss.study_id
WHERE ss.enrollment_status IN ('screening', 'enrolled')
  AND COALESCE(ss.updated_at, ss.created_at) < (now() - interval '30 days')
  AND NOT EXISTS (
    SELECT 1
    FROM public.visits v
    WHERE v.study_subject_id = ss.id
      AND v.updated_at > (now() - interval '30 days')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.subject_workflow_actions wa
    WHERE wa.study_subject_id = ss.id
      AND wa.updated_at > (now() - interval '30 days')
  )

UNION ALL

SELECT
  vsq.organization_id,
  vsq.study_id,
  vsq.subject_id,
  ss.subject_identifier,
  st.name,
  'open_query',
  'visit_snapshot_queries:' || vsq.id::text,
  vsq.id,
  vsq.opened_at,
  ROUND(EXTRACT(EPOCH FROM (now() - vsq.opened_at)) / 3600.0)::int,
  CASE WHEN vsq.priority = 'critical' THEN 0 ELSE 1 END,
  'Resolve open field query'::text
FROM public.visit_snapshot_queries vsq
JOIN public.study_subjects ss ON ss.id = vsq.subject_id
JOIN public.studies st ON st.id = vsq.study_id
WHERE vsq.query_status IN ('open', 'answered')
  AND vsq.priority IN ('high', 'critical');

-- ---------------------------------------------------------------------------
-- 2. vpi_coordinator_load_v1
--    Extends open_actions CTE to union visit_snapshot_queries so snapshot query
--    work items appear in coordinator load counts alongside workflow actions.
--    Snapshot queries carry no due_date; overdue_items and due_today remain 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vpi_coordinator_load_v1
WITH (security_invoker = true) AS
WITH open_actions AS (
  SELECT
    organization_id,
    assigned_user_id,
    created_by,
    due_date,
    updated_at
  FROM public.subject_workflow_actions
  WHERE status IN ('open', 'in_progress')

  UNION ALL

  SELECT
    organization_id,
    assigned_user_id,
    opened_by AS created_by,
    NULL::date AS due_date,
    updated_at
  FROM public.visit_snapshot_queries
  WHERE query_status IN ('open', 'answered')
),
org_unassigned AS (
  SELECT
    oa.organization_id,
    COUNT(*)::int AS unassigned_queue
  FROM open_actions oa
  WHERE oa.assigned_user_id IS NULL
  GROUP BY oa.organization_id
),
by_user AS (
  SELECT
    oa.organization_id,
    COALESCE(oa.assigned_user_id, oa.created_by) AS user_id,
    COUNT(*)::int AS assigned_items,
    COUNT(*) FILTER (
      WHERE oa.due_date IS NOT NULL AND oa.due_date < current_date
    )::int AS overdue_items,
    COUNT(*) FILTER (WHERE oa.due_date = current_date)::int AS due_today,
    MAX(oa.updated_at) AS last_active_at
  FROM open_actions oa
  WHERE COALESCE(oa.assigned_user_id, oa.created_by) IS NOT NULL
  GROUP BY oa.organization_id, COALESCE(oa.assigned_user_id, oa.created_by)
)
SELECT
  bu.organization_id,
  bu.user_id,
  bu.assigned_items,
  bu.overdue_items,
  (
    SELECT COUNT(*)::int
    FROM public.procedure_executions pe
    WHERE pe.organization_id = bu.organization_id
      AND pe.validation_status = 'blocked'
      AND pe.performed_by_user_id = bu.user_id
  ) AS blocked_items,
  bu.due_today,
  COALESCE(ou.unassigned_queue, 0) AS unassigned_queue,
  bu.last_active_at
FROM by_user bu
LEFT JOIN org_unassigned ou ON ou.organization_id = bu.organization_id;
