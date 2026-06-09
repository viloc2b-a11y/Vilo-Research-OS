import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import {
  COORDINATOR_LOAD_WORKFLOW_LIMIT,
  OVERDUE_WORKFLOW_QUERY_LIMIT,
  SNAPSHOT_QUERY_RISK_LIMIT,
} from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type OverdueWorkflowRow = Record<string, unknown>
export type CoordinatorLoadWorkflowRow = Record<string, unknown>
export type SnapshotQueryRiskRow = Record<string, unknown>

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function loadOverdueWorkflowActions(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<OverdueWorkflowRow>> {
  const today = todayIsoDate()
  const { data, error } = await client
    .from('subject_workflow_actions')
    .select(
      `
      id,
      study_id,
      study_subject_id,
      title,
      priority,
      due_date,
      status,
      study_subjects(subject_identifier),
      studies(name)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('status', ['open', 'in_progress'])
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(OVERDUE_WORKFLOW_QUERY_LIMIT)

  if (error) {
    return {
      source: 'overdue_workflow',
      rows: [],
      error: { source: 'overdue_workflow', message: error.message },
    }
  }

  return { source: 'overdue_workflow', rows: (data ?? []) as OverdueWorkflowRow[], error: null }
}

export async function loadCoordinatorLoadWorkflowActions(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<CoordinatorLoadWorkflowRow>> {
  const { data, error } = await client
    .from('subject_workflow_actions')
    .select(
      `
      id,
      organization_id,
      study_id,
      assigned_user_id,
      created_by,
      action_type,
      priority,
      due_date,
      status,
      updated_at,
      created_at
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(COORDINATOR_LOAD_WORKFLOW_LIMIT)

  if (error) {
    return {
      source: 'coordinator_load_workflow',
      rows: [],
      error: { source: 'coordinator_load_workflow', message: error.message },
    }
  }

  return {
    source: 'coordinator_load_workflow',
    rows: (data ?? []) as CoordinatorLoadWorkflowRow[],
    error: null,
  }
}

export async function loadSnapshotQueryRiskSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<SnapshotQueryRiskRow>> {
  const { data, error } = await client
    .from('visit_snapshot_queries')
    .select(
      `
      id,
      organization_id,
      study_id,
      subject_id,
      snapshot_id,
      query_scope,
      procedure_instance_id,
      procedure_code,
      field_id,
      field_label,
      query_text,
      query_status,
      priority,
      assigned_role,
      assigned_user_id,
      opened_by,
      opened_at,
      updated_at,
      study_subjects(subject_identifier),
      studies(name)
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('query_status', ['open', 'answered'])
    .in('priority', ['high', 'critical'])
    .order('opened_at', { ascending: true })
    .limit(SNAPSHOT_QUERY_RISK_LIMIT)

  if (error) {
    return {
      source: 'snapshot_query_risk',
      rows: [],
      error: { source: 'snapshot_query_risk', message: error.message },
    }
  }

  return {
    source: 'snapshot_query_risk',
    rows: (data ?? []) as SnapshotQueryRiskRow[],
    error: null,
  }
}

export async function loadCoordinatorLoadSnapshotQueries(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<RawSignal<CoordinatorLoadWorkflowRow>> {
  const { data, error } = await client
    .from('visit_snapshot_queries')
    .select(
      `
      id,
      organization_id,
      study_id,
      assigned_user_id,
      opened_by,
      priority,
      query_status,
      updated_at,
      opened_at
    `,
    )
    .in('organization_id', scope.organizationIds)
    .in('study_id', scope.studyIds)
    .in('query_status', ['open', 'answered'])
    .order('updated_at', { ascending: false })
    .limit(COORDINATOR_LOAD_WORKFLOW_LIMIT)

  if (error) {
    return {
      source: 'coordinator_load_snapshot_queries',
      rows: [],
      error: { source: 'coordinator_load_snapshot_queries', message: error.message },
    }
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    created_by: row.opened_by,
    created_at: row.opened_at,
    status: row.query_status,
    due_date: null,
    action_type: 'query',
  }))

  return {
    source: 'coordinator_load_snapshot_queries',
    rows: rows as CoordinatorLoadWorkflowRow[],
    error: null,
  }
}
