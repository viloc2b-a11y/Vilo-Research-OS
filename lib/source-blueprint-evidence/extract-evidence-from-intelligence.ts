import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { assertActiveDocumentReferenceForDomain } from '@/lib/document-intelligence/assert-active-document-reference'
import { assertDocumentNotQuarantined } from '@/lib/document-intelligence/assert-document-not-quarantined'
import { INTELLIGENCE_STATUS } from '@/lib/document-intelligence/document-intelligence-types'
import { mapIntelligenceChunkRow } from '@/lib/document-intelligence/document-intelligence-types'
import { appendEvidenceReviewEvent } from './append-evidence-review-event'
import { classifyChunkEvidenceKinds } from './classify-chunk-evidence'
import {
  EVIDENCE_REVIEW_EVENT_TYPE,
  EVIDENCE_STATUS,
  mapSourceBlueprintEvidenceRow,
  type SourceBlueprintEvidenceRow,
} from './source-blueprint-evidence-types'

export type ExtractEvidenceFromIntelligenceInput = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  usageDomain?: DocumentIntelligenceDomain | null
  createdBy?: string | null
}

export type ExtractEvidenceFromIntelligenceResult = {
  createdCount: number
  skippedCount: number
  evidence: SourceBlueprintEvidenceRow[]
}

export async function extractEvidenceFromIntelligenceDocument(
  supabase: SupabaseClient,
  input: ExtractEvidenceFromIntelligenceInput,
): Promise<ExtractEvidenceFromIntelligenceResult> {
  assertK1SingleStudyScope(input.studyId)

  const usageDomainFilter =
    input.usageDomain && isDocumentIntelligenceDomain(input.usageDomain)
      ? input.usageDomain
      : 'source_creation'

  const { data: doc, error: docError } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', input.intelligenceDocumentId)
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .eq('intelligence_status', 'ready')
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!doc) throw new Error('Intelligence document not found or not ready for evidence extraction.')
  if (doc.intelligence_status === INTELLIGENCE_STATUS.QUARANTINE) {
    throw new Error('Cannot extract evidence from a quarantined document.')
  }

  await assertDocumentNotQuarantined(
    supabase,
    input.organizationId,
    input.studyId,
    input.intelligenceDocumentId,
  )

  const { data: domainRows } = await supabase
    .from('document_intelligence_domains')
    .select('domain')
    .eq('intelligence_document_id', input.intelligenceDocumentId)
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .eq('status', 'active')
    .eq('domain', usageDomainFilter)

  if (!domainRows?.length) {
    throw new Error(
      `Document is not tagged for usage domain "${usageDomainFilter}". Ingest with domains first.`,
    )
  }

  await assertActiveDocumentReferenceForDomain(
    supabase,
    input.organizationId,
    input.studyId,
    input.intelligenceDocumentId,
    usageDomainFilter,
  )

  const { data: chunks, error: chunkError } = await supabase
    .from('document_intelligence_chunks')
    .select('*')
    .eq('intelligence_document_id', input.intelligenceDocumentId)
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .order('chunk_index', { ascending: true })
    .limit(200)

  if (chunkError) throw new Error(chunkError.message)

  const created: SourceBlueprintEvidenceRow[] = []
  let skippedCount = 0
  const extractedAt = new Date().toISOString()
  const sourceFilename = String(doc.source_filename)

  for (const row of chunks ?? []) {
    const chunk = mapIntelligenceChunkRow(row as Record<string, unknown>)
    const drafts = classifyChunkEvidenceKinds(chunk.cleanChunkText, usageDomainFilter)

    for (const draft of drafts) {
      const provenance = {
        intelligence_document_id: input.intelligenceDocumentId,
        intelligence_chunk_id: chunk.id,
        compliance_document_id: String(doc.compliance_document_id),
        source_document_version_id: input.intelligenceDocumentId,
        source_version_label: doc.version_label ? String(doc.version_label) : null,
        source_version_number:
          doc.version_number != null ? Number(doc.version_number) : null,
        document_family_id: String(doc.document_family_id),
        chunk_index: chunk.chunkIndex,
        chunk_hash: chunk.chunkHash,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        section_code: chunk.sectionCode,
        source_filename: sourceFilename,
        usage_domain: usageDomainFilter,
        extraction_method: 'heuristic_v1',
        extracted_at: extractedAt,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('source_blueprint_evidence')
        .upsert(
          {
            organization_id: input.organizationId,
            study_id: input.studyId,
            intelligence_document_id: input.intelligenceDocumentId,
            intelligence_chunk_id: chunk.id,
            compliance_document_id: String(doc.compliance_document_id),
            usage_domain: usageDomainFilter,
            evidence_kind: draft.evidenceKind,
            evidence_status: EVIDENCE_STATUS.PENDING_REVIEW,
            title: draft.title,
            summary: draft.summary,
            excerpt_text: chunk.cleanChunkText.slice(0, 4000),
            structured_payload: draft.structuredPayload,
            provenance,
            confidence_score: draft.confidenceScore,
            created_by: input.createdBy ?? null,
            metadata: {},
          },
          { onConflict: 'intelligence_chunk_id,evidence_kind', ignoreDuplicates: false },
        )
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          skippedCount += 1
          continue
        }
        throw new Error(insertError.message)
      }

      if (!inserted) continue

      const mapped = mapSourceBlueprintEvidenceRow(inserted as Record<string, unknown>)
      created.push(mapped)

      await appendEvidenceReviewEvent({
        supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        evidenceId: mapped.id,
        eventType: EVIDENCE_REVIEW_EVENT_TYPE.EXTRACTED,
        actorId: input.createdBy ?? null,
        eventPayload: { evidence_kind: draft.evidenceKind, confidence: draft.confidenceScore },
      })
    }
  }

  return { createdCount: created.length, skippedCount, evidence: created }
}
