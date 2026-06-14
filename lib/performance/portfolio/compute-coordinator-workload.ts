import type { SupabaseClient } from '@supabase/supabase-js'

export type CoordinatorWorkloadTier = 'overloaded' | 'busy' | 'normal' | 'light'

export type CoordinatorWorkload = {
  coordinatorId: string
  assignedSubjectCount: number
  activeVisitCount: number
  overdueSourceCount: number
  openFindingsCount: number
  openQueriesCount: number
  workloadScore: number
  tier: CoordinatorWorkloadTier
}

function computeWorkloadScore(input: {
  assignedSubjectCount: number
  activeVisitCount: number
  overdueSourceCount: number
  openFindingsCount: number
  openQueriesCount: number
}): number {
  const raw =
    input.assignedSubjectCount * 2 +
    input.activeVisitCount * 5 +
    input.overdueSourceCount * 8 +
    input.openFindingsCount * 3 +
    input.openQueriesCount * 2
  return Math.min(100, raw)
}

function classifyTier(score: number): CoordinatorWorkloadTier {
  if (score >= 80) return 'overloaded'
  if (score >= 50) return 'busy'
  if (score >= 20) return 'normal'
  return 'light'
}

export async function computeCoordinatorWorkload(args: {
  supabase: SupabaseClient
  organizationId: string
  coordinatorId: string
}): Promise<CoordinatorWorkload> {
  const { supabase, organizationId, coordinatorId } = args

  // Count active subjects for this coordinator via assigned workflow actions.
  // study_subjects does not have a primary_coordinator_id column; coordinator
  // association is derived from assigned_user_id in workflow / query tables.
  // We approximate by counting distinct study_subject_id values across open
  // workflow actions and snapshot queries assigned to this coordinator.
  const [
    workflowSubjects,
    snapshotSubjects,
    openWorkflowQueries,
    openSnapshotQueries,
    openFindings,
  ] = await Promise.all([
    // Distinct subjects via open workflow actions assigned to coordinator
    supabase
      .from('subject_workflow_actions')
      .select('study_subject_id', { count: 'exact', head: false })
      .eq('organization_id', organizationId)
      .eq('assigned_user_id', coordinatorId)
      .in('status', ['open', 'in_progress']),

    // Distinct subjects via open snapshot queries assigned to coordinator
    supabase
      .from('visit_snapshot_queries')
      .select('subject_id', { count: 'exact', head: false })
      .eq('organization_id', organizationId)
      .eq('assigned_user_id', coordinatorId)
      .in('query_status', ['open', 'answered']),

    // Open workflow queries (action_type = 'query') assigned to coordinator
    supabase
      .from('subject_workflow_actions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('assigned_user_id', coordinatorId)
      .eq('action_type', 'query')
      .in('status', ['open', 'in_progress']),

    // Open snapshot queries assigned to coordinator
    supabase
      .from('visit_snapshot_queries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('assigned_user_id', coordinatorId)
      .in('query_status', ['open', 'answered']),

    // Open findings assigned to coordinator
    supabase
      .from('source_response_validation_findings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('assigned_user_id', coordinatorId)
      .eq('status', 'open'),
  ])

  // Derive distinct subject count from workflow + snapshot unions
  const workflowSubjectIds = new Set(
    (workflowSubjects.data ?? []).map(
      (r: Record<string, unknown>) => r.study_subject_id as string,
    ),
  )
  const snapshotSubjectIds = new Set(
    (snapshotSubjects.data ?? []).map(
      (r: Record<string, unknown>) => r.subject_id as string,
    ),
  )
  const allSubjectIds = new Set([...workflowSubjectIds, ...snapshotSubjectIds])
  const assignedSubjectCount = allSubjectIds.size

  // Active visits in next 14 days for subjects assigned to coordinator.
  // Visits table does not track coordinator directly; skip if no subjects.
  let activeVisitCount = 0
  if (allSubjectIds.size > 0) {
    const now = new Date()
    const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const { count } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('study_subject_id', [...allSubjectIds])
      .gte('scheduled_date', now.toISOString().slice(0, 10))
      .lte('scheduled_date', future.toISOString().slice(0, 10))
    activeVisitCount = count ?? 0
  }

  // Overdue source (source_response_sets not submitted >24h after visit).
  // source_response_sets does not have coordinator column; skip as unavailable.
  // Document the skip: there is no coordinator_id or assigned_user_id on source_response_sets.
  const overdueSourceCount = 0

  const openFindingsCount = Math.max(0, openFindings.count ?? 0)
  const openQueriesCount = Math.max(0, (openWorkflowQueries.count ?? 0) + (openSnapshotQueries.count ?? 0))

  const workloadScore = computeWorkloadScore({
    assignedSubjectCount,
    activeVisitCount,
    overdueSourceCount,
    openFindingsCount,
    openQueriesCount,
  })

  return {
    coordinatorId,
    assignedSubjectCount,
    activeVisitCount,
    overdueSourceCount,
    openFindingsCount,
    openQueriesCount,
    workloadScore,
    tier: classifyTier(workloadScore),
  }
}
