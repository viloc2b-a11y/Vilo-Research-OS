import type { SupabaseClient } from '@supabase/supabase-js'

export type SubjectAmendmentImpactRow = {
  id: string
  protocolVersionId: string
  requiresReconsent: boolean
  reconsentCompletedAt: string | null
  requiresTrainingReview: boolean
  trainingReviewCompletedAt: string | null
  impactReason: string | null
  createdAt: string
  amendmentStatus: 'pending' | 'submitted' | 'irb_review' | 'approved' | 'activated' | null
  activatedAt: string | null
}

export async function loadSubjectAmendmentImpacts(
  supabase: SupabaseClient,
  { subjectId }: { subjectId: string },
): Promise<SubjectAmendmentImpactRow[]> {
  const { data: impacts, error } = await supabase
    .from('amendment_subject_impacts')
    .select(
      'id, protocol_version_id, requires_reconsent, reconsent_completed_at, requires_training_review, training_review_completed_at, impact_reason, created_at',
    )
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!impacts || impacts.length === 0) return []

  const versionIds = impacts.map((i) => (i as Record<string, unknown>).protocol_version_id as string)

  const { data: statuses } = await supabase
    .from('study_amendment_statuses')
    .select('protocol_version_id, status, activated_at')
    .in('protocol_version_id', versionIds)

  const statusMap = Object.fromEntries(
    (statuses ?? []).map((s) => {
      const row = s as Record<string, unknown>
      return [row.protocol_version_id as string, row]
    }),
  )

  return impacts.map((impact) => {
    const row = impact as Record<string, unknown>
    const status = statusMap[row.protocol_version_id as string] as Record<string, unknown> | undefined
    return {
      id: row.id as string,
      protocolVersionId: row.protocol_version_id as string,
      requiresReconsent: Boolean(row.requires_reconsent),
      reconsentCompletedAt: (row.reconsent_completed_at as string | null) ?? null,
      requiresTrainingReview: Boolean(row.requires_training_review),
      trainingReviewCompletedAt: (row.training_review_completed_at as string | null) ?? null,
      impactReason: (row.impact_reason as string | null) ?? null,
      createdAt: row.created_at as string,
      amendmentStatus:
        (status?.status as SubjectAmendmentImpactRow['amendmentStatus']) ?? null,
      activatedAt: (status?.activated_at as string | null) ?? null,
    }
  })
}
