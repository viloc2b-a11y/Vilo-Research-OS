import type { SupabaseClient } from '@supabase/supabase-js'
import { appendEvidenceReviewEvent } from '@/lib/source-blueprint-evidence/append-evidence-review-event'
import { EVIDENCE_REVIEW_EVENT_TYPE, EVIDENCE_STATUS } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'

/**
 * Marks non-deleted evidence from superseded document versions in the same family.
 * Does not delete rows; does not mutate runtime or published source.
 */
export async function markEvidenceSupersededForDocumentFamily(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  documentFamilyId: string
  activeIntelligenceDocumentId: string
  domain: DocumentIntelligenceDomain
  actorId: string | null
}): Promise<number> {
  const { data: familyDocs, error: docsError } = await args.supabase
    .from('document_intelligence_documents')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('document_family_id', args.documentFamilyId)

  if (docsError) throw new Error(docsError.message)

  const supersededDocIds = (familyDocs ?? [])
    .map((row) => String(row.id))
    .filter((id) => id !== args.activeIntelligenceDocumentId)

  if (supersededDocIds.length === 0) return 0

  const { data: evidenceRows, error: evidenceError } = await args.supabase
    .from('source_blueprint_evidence')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('usage_domain', args.domain)
    .in('intelligence_document_id', supersededDocIds)
    .in('evidence_status', [
      EVIDENCE_STATUS.PENDING_REVIEW,
      EVIDENCE_STATUS.ACCEPTED,
      EVIDENCE_STATUS.MAPPED,
    ])

  if (evidenceError) throw new Error(evidenceError.message)
  if (!evidenceRows?.length) return 0

  const reviewedAt = new Date().toISOString()
  const evidenceIds = evidenceRows.map((row) => String(row.id))

  const { error: updateError } = await args.supabase
    .from('source_blueprint_evidence')
    .update({
      evidence_status: EVIDENCE_STATUS.SUPERSEDED,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .in('id', evidenceIds)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)

  if (updateError) throw new Error(updateError.message)

  for (const evidenceId of evidenceIds) {
    await appendEvidenceReviewEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      evidenceId,
      eventType: EVIDENCE_REVIEW_EVENT_TYPE.SUPERSEDED,
      actorId: args.actorId,
      eventPayload: {
        reason: 'active_document_reference_changed',
        active_intelligence_document_id: args.activeIntelligenceDocumentId,
        domain: args.domain,
      },
    })
  }

  return evidenceIds.length
}
