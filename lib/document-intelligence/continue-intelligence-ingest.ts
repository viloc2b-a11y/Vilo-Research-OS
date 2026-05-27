import type { SupabaseClient } from '@supabase/supabase-js'
import { listActiveIntelligenceDocumentDomains } from './apply-intelligence-domains'
import { embedDocumentChunks } from './embed-document-chunks'
import { ensureDefaultActiveReferencesForDomains } from './ensure-default-active-references'
import { assertDocumentNotQuarantined } from './assert-document-not-quarantined'
import {
  INTELLIGENCE_STATUS,
  INGESTION_RUN_STATUS,
  mapIntelligenceDocumentRow,
  type IngestComplianceDocumentResult,
} from './document-intelligence-types'
import {
  EXTRACTION_STATUS,
  DOCUMENT_EMBEDDING_STATUS,
} from './document-intelligence-types'

/** Resume embedding after a processing response (service-role or user client). */
export async function continueIntelligenceIngestion(
  supabase: SupabaseClient,
  organizationId: string,
  intelligenceDocumentId: string,
  ingestionRunId: string,
): Promise<IngestComplianceDocumentResult> {
  const { data: doc, error } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!doc) throw new Error('Intelligence document not found for organization.')

  const intelligenceDocument = mapIntelligenceDocumentRow(doc as Record<string, unknown>)

  if (!intelligenceDocument.studyId) {
    throw new Error('Document missing study scope.')
  }

  await assertDocumentNotQuarantined(
    supabase,
    organizationId,
    intelligenceDocument.studyId,
    intelligenceDocumentId,
  )

  const { count } = await supabase
    .from('document_intelligence_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('intelligence_document_id', intelligenceDocumentId)
    .eq('organization_id', organizationId)

  const appliedDomains = await listActiveIntelligenceDocumentDomains(
    supabase,
    organizationId,
    intelligenceDocumentId,
  )

  const embedResult = await embedDocumentChunks(supabase, intelligenceDocument)

  const runStatus =
    embedResult.failedChunkCount > 0 && embedResult.embeddedChunkCount > 0
      ? INGESTION_RUN_STATUS.PARTIAL
      : embedResult.failedChunkCount > 0 && embedResult.embeddedChunkCount === 0
        ? INGESTION_RUN_STATUS.FAILED
        : INGESTION_RUN_STATUS.COMPLETED

  const intelligenceStatus =
    runStatus === INGESTION_RUN_STATUS.FAILED ? INTELLIGENCE_STATUS.FAILED : INTELLIGENCE_STATUS.READY

  await supabase
    .from('document_intelligence_documents')
    .update({
      intelligence_status: intelligenceStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceDocument.id)
    .eq('organization_id', organizationId)

  if (intelligenceStatus === INTELLIGENCE_STATUS.READY && intelligenceDocument.studyId) {
    await ensureDefaultActiveReferencesForDomains(supabase, {
      organizationId,
      studyId: intelligenceDocument.studyId,
      intelligenceDocumentId: intelligenceDocument.id,
      documentFamilyId: intelligenceDocument.documentFamilyId,
      domains: appliedDomains,
      actorId: intelligenceDocument.createdBy,
    })
  }

  await supabase
    .from('document_intelligence_ingestion_runs')
    .update({
      run_status: runStatus,
      completed_at: new Date().toISOString(),
      extracted_chunk_count: count ?? 0,
      embedded_chunk_count: embedResult.embeddedChunkCount,
      failed_chunk_count: embedResult.failedChunkCount,
      error_message: embedResult.errorMessage,
    })
    .eq('id', ingestionRunId)
    .eq('organization_id', organizationId)

  return {
    status: 'completed',
    idempotent: false,
    alreadyReady: false,
    intelligenceDocumentId: intelligenceDocument.id,
    ingestionRunId,
    runStatus,
    extractedChunkCount: count ?? 0,
    embeddedChunkCount: embedResult.embeddedChunkCount,
    failedChunkCount: embedResult.failedChunkCount,
    extractionStatus: EXTRACTION_STATUS.EXTRACTED,
    embeddingStatus: embedResult.embeddingStatus,
    intelligenceStatus,
    errorMessage: embedResult.errorMessage,
    appliedDomains,
    classificationMetadata: intelligenceDocument.classificationMetadata,
    quarantined: false,
  }
}
