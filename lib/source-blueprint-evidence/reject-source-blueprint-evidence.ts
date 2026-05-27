import type { SupabaseClient } from '@supabase/supabase-js'
import { appendEvidenceReviewEvent } from './append-evidence-review-event'
import { EvidenceReviewStateError } from './accept-source-blueprint-evidence'
import { loadSourceBlueprintEvidenceById } from './list-source-blueprint-evidence'
import {
  EVIDENCE_REVIEW_EVENT_TYPE,
  EVIDENCE_STATUS,
  mapSourceBlueprintEvidenceRow,
  type SourceBlueprintEvidenceRow,
} from './source-blueprint-evidence-types'

export async function rejectSourceBlueprintEvidence(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  evidenceId: string
  actorId: string
  reviewNotes?: string | null
}): Promise<SourceBlueprintEvidenceRow> {
  const current = await loadSourceBlueprintEvidenceById(
    args.supabase,
    args.organizationId,
    args.studyId,
    args.evidenceId,
  )
  if (!current) throw new Error('Evidence not found.')
  if (current.evidenceStatus === EVIDENCE_STATUS.REJECTED) return current
  if (
    current.evidenceStatus === EVIDENCE_STATUS.ARCHIVED ||
    current.evidenceStatus === EVIDENCE_STATUS.SUPERSEDED_CANDIDATE ||
    current.evidenceStatus === EVIDENCE_STATUS.SUPERSEDED
  ) {
    throw new EvidenceReviewStateError('Archived or superseded evidence cannot be rejected.')
  }
  if (current.evidenceStatus === EVIDENCE_STATUS.MAPPED) {
    throw new EvidenceReviewStateError('Mapped evidence cannot be rejected.')
  }

  const reviewedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('source_blueprint_evidence')
    .update({
      evidence_status: EVIDENCE_STATUS.REJECTED,
      reviewed_by: args.actorId,
      reviewed_at: reviewedAt,
      mapping_notes: args.reviewNotes ?? current.mappingNotes,
      updated_at: reviewedAt,
    })
    .eq('id', current.id)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to reject evidence')

  const mapped = mapSourceBlueprintEvidenceRow(data as Record<string, unknown>)
  await appendEvidenceReviewEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    evidenceId: mapped.id,
    eventType: EVIDENCE_REVIEW_EVENT_TYPE.REJECTED,
    actorId: args.actorId,
    eventPayload: { review_notes: args.reviewNotes ?? null },
  })

  return mapped
}
