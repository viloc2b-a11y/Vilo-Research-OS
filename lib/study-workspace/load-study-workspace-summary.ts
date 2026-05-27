import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { PUBLICATION_STATUS } from '@/lib/runtime-source-publication/runtime-source-publication-types'
import type {
  StudyWorkspaceSubjectPreview,
  StudyWorkspaceSummary,
  StudyWorkspaceSummaryCounts,
} from './study-workspace-types'

const EMPTY_COUNTS: StudyWorkspaceSummaryCounts = {
  subjectCount: null,
  documentCount: null,
  publishedSourceCount: null,
  runtimeVisitCount: null,
  lockedSnapshotCount: null,
  openObligationsCount: null,
  expirationAlertsCount: null,
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

export async function loadStudyWorkspaceSummary(
  studyId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyWorkspaceSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, organization_id, name, status')
    .eq('id', studyId)
    .maybeSingle()

  if (studyError || !study) notFound()

  const organizationId = String(study.organization_id)
  const user = await getSessionUser()
  if (!user) notFound()

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) notFound()

  const counts: StudyWorkspaceSummaryCounts = { ...EMPTY_COUNTS }

  counts.subjectCount = await safeExactCount('Subjects', unavailable, async () =>
    supabase
      .from('study_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
  )

  counts.documentCount = await safeExactCount('Documents', unavailable, async () =>
    supabase
      .from('compliance_runtime_documents')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
  )

  counts.publishedSourceCount = await safeExactCount('Published source', unavailable, async () =>
    supabase
      .from('runtime_source_package_publications')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('publication_status', PUBLICATION_STATUS.PUBLISHED),
  )

  counts.runtimeVisitCount = await safeExactCount('Runtime visits', unavailable, async () =>
    supabase
      .from('study_runtime_visits')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
  )

  counts.lockedSnapshotCount = await safeExactCount('Locked snapshots', unavailable, async () =>
    supabase
      .from('visit_runtime_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('snapshot_status', 'locked'),
  )

  counts.openObligationsCount = await safeExactCount('Open obligations', unavailable, async () =>
    supabase
      .from('compliance_obligations')
      .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('compliance_runtime_documents.study_id', studyId)
      .in('status', ['pending', 'overdue', 'escalated']),
  )

  counts.expirationAlertsCount = await safeExactCount('Expiration alerts', unavailable, async () =>
    supabase
      .from('compliance_expiration_alerts')
      .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('compliance_runtime_documents.study_id', studyId)
      .in('status', ['pending', 'escalated']),
  )

  return {
    study: {
      id: String(study.id),
      name: String(study.name),
      status: study.status ? String(study.status) : null,
      organizationId,
    },
    counts,
    unavailable,
  }
}

export async function loadStudyWorkspaceSubjectPreviews(
  studyId: string,
  organizationId: string,
  limit = 8,
  supabaseClient?: SupabaseClient,
): Promise<StudyWorkspaceSubjectPreview[]> {
  const supabase = supabaseClient ?? (await createServerClient())
  try {
    const { data, error } = await supabase
      .from('study_subjects')
      .select('id, subject_identifier, enrollment_status')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('subject_identifier', { ascending: true })
      .limit(limit)

    if (error || !data?.length) return []

    return data.map((row) => ({
      id: String(row.id),
      subjectIdentifier: String(row.subject_identifier),
      enrollmentStatus: row.enrollment_status ? String(row.enrollment_status) : null,
    }))
  } catch {
    return []
  }
}
