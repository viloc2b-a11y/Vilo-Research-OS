import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type StudyWorkflowSummary = {
  openActionCount: number | null
  overdueActionCount: number | null
  dueTodayActionCount: number | null
  highPriorityActionCount: number | null
  unassignedActionCount: number | null
  queryActionCount: number | null
  unavailable: string[]
}

async function safeExactCount(
  label: string,
  unavailable: string[],
  run: () => Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return null
    }
    return count ?? 0
  } catch (err) {
    unavailable.push(`${label}: ${err instanceof Error ? err.message : 'unavailable'}`)
    return null
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function loadStudyWorkflowSummary(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyWorkflowSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []
  const today = todayIsoDate()

  const [
    openActionCount,
    overdueActionCount,
    dueTodayActionCount,
    highPriorityActionCount,
    unassignedActionCount,
    wfQueryActionCount,
    snapshotQueryActionCount,
  ] = await Promise.all([
    safeExactCount('Open workflow actions', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress']),
    ),
    safeExactCount('Overdue workflow actions', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress'])
        .not('due_date', 'is', null)
        .lt('due_date', today),
    ),
    safeExactCount('Workflow actions due today', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress'])
        .eq('due_date', today),
    ),
    safeExactCount('High priority workflow actions', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress'])
        .in('priority', ['high', 'urgent']),
    ),
    safeExactCount('Unassigned workflow actions', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress'])
        .is('assigned_user_id', null),
    ),
    safeExactCount('Query workflow actions', unavailable, async () =>
      supabase
        .from('subject_workflow_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'in_progress'])
        .eq('action_type', 'query'),
    ),
    safeExactCount('Snapshot query actions', unavailable, async () =>
      supabase
        .from('visit_snapshot_queries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('query_status', ['open', 'answered']),
    ),
  ])

  const queryActionCount = (wfQueryActionCount ?? 0) + (snapshotQueryActionCount ?? 0)

  return {
    openActionCount,
    overdueActionCount,
    dueTodayActionCount,
    highPriorityActionCount,
    unassignedActionCount,
    queryActionCount,
    unavailable,
  }
}
