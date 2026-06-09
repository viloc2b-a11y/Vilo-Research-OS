import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type StudyGovernanceSummary = {
  openGovernanceSignalCount: number | null
  blockerSignalCount: number | null
  warningSignalCount: number | null
  openGovernanceSignatureCount: number | null
  openSnapshotQueryCount: number | null
  criticalSnapshotQueryCount: number | null
  activeDeviationCount: number | null
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

export async function loadStudyGovernanceSummary(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyGovernanceSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [
    openGovernanceSignalCount,
    blockerSignalCount,
    warningSignalCount,
    openGovernanceSignatureCount,
    openSnapshotQueryCount,
    criticalSnapshotQueryCount,
    activeDeviationCount,
  ] = await Promise.all([
    safeExactCount('Open governance signals', unavailable, async () =>
      supabase
        .from('governance_signals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'acknowledged']),
    ),
    safeExactCount('Governance blockers', unavailable, async () =>
      supabase
        .from('governance_signals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'acknowledged'])
        .eq('severity', 'blocker'),
    ),
    safeExactCount('Governance warnings', unavailable, async () =>
      supabase
        .from('governance_signals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('status', ['open', 'acknowledged'])
        .eq('severity', 'warning'),
    ),
    safeExactCount('Pending governance signatures', unavailable, async () =>
      supabase
        .from('operational_signature_requests')
        .select('id', { count: 'exact', head: true })
        .eq('study_id', studyId)
        .eq('module', 'governance')
        .eq('status', 'pending'),
    ),
    safeExactCount('Open snapshot queries', unavailable, async () =>
      supabase
        .from('visit_snapshot_queries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('query_status', ['open', 'answered']),
    ),
    safeExactCount('Critical snapshot queries', unavailable, async () =>
      supabase
        .from('visit_snapshot_queries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('query_status', ['open', 'answered'])
        .in('priority', ['high', 'critical']),
    ),
    safeExactCount('Active formal deviations', unavailable, async () =>
      supabase
        .from('subject_protocol_deviations')
        .select('deviation_id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .not('status', 'in', '("closed","resolved","cancelled")'),
    ),
  ])

  return {
    openGovernanceSignalCount,
    blockerSignalCount,
    warningSignalCount,
    openGovernanceSignatureCount,
    openSnapshotQueryCount,
    criticalSnapshotQueryCount,
    activeDeviationCount,
    unavailable,
  }
}
