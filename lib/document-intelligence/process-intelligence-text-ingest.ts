import type { SupabaseClient } from '@supabase/supabase-js'
import { chunkDocumentText, MAX_CHUNKS_PER_DOC } from './document-chunker'
import { applyIntelligenceDocumentDomains } from './apply-intelligence-domains'
import { ensureDefaultActiveReferencesForDomains } from './ensure-default-active-references'
import { embedDocumentChunks } from './embed-document-chunks'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'
import { resolveIngestClassification } from './resolve-ingest-classification'
import { buildQuarantineReason, scanPhiRisk } from './scan-phi-risk'
import { isIngestDeadlineExceeded } from './ingest-runtime'
import {
  CHUNK_EMBEDDING_STATUS,
  DOCUMENT_EMBEDDING_STATUS,
  EXTRACTION_STATUS,
  INTELLIGENCE_STATUS,
  INGESTION_RUN_STATUS,
  mapIntelligenceDocumentRow,
  type DocumentIntelligenceDocumentRow,
  type IngestComplianceDocumentResult,
} from './document-intelligence-types'

export type ProcessIntelligenceTextInput = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  complianceDocumentId: string
  intelligenceDocumentId: string
  ingestionRunId: string
  sourceFilename: string
  complianceClassification: string
  extractedText: string
  explicitDomains?: string[] | null
  startedBy: string | null
  skipPhiGate?: boolean
  deadlineAtMs?: number
}

async function finalizeIntelligenceIngestion(
  supabase: SupabaseClient,
  intelligenceDocument: DocumentIntelligenceDocumentRow,
  ingestionRunId: string,
  extractedChunkCount: number,
  appliedDomains: DocumentIntelligenceDomain[],
  deadlineAtMs?: number,
): Promise<IngestComplianceDocumentResult> {
  const embedResult = await embedDocumentChunks(supabase, intelligenceDocument, {
    deadlineAtMs,
  })

  if (embedResult.deadlineExceeded) {
    return {
      status: 'processing',
      idempotent: false,
      alreadyReady: false,
      intelligenceDocumentId: intelligenceDocument.id,
      ingestionRunId,
      runStatus: INGESTION_RUN_STATUS.STARTED,
      extractedChunkCount,
      embeddedChunkCount: embedResult.embeddedChunkCount,
      failedChunkCount: embedResult.failedChunkCount,
      extractionStatus: EXTRACTION_STATUS.EXTRACTED,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.EMBEDDING,
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      errorMessage: null,
      appliedDomains,
      classificationMetadata: null,
      quarantined: false,
    }
  }

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
    .eq('organization_id', intelligenceDocument.organizationId)

  if (intelligenceStatus === INTELLIGENCE_STATUS.READY && intelligenceDocument.studyId) {
    await ensureDefaultActiveReferencesForDomains(supabase, {
      organizationId: intelligenceDocument.organizationId,
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
      extracted_chunk_count: extractedChunkCount,
      embedded_chunk_count: embedResult.embeddedChunkCount,
      failed_chunk_count: embedResult.failedChunkCount,
      error_message: embedResult.errorMessage,
    })
    .eq('id', ingestionRunId)
    .eq('organization_id', intelligenceDocument.organizationId)

  return {
    status: 'completed',
    idempotent: false,
    alreadyReady: false,
    intelligenceDocumentId: intelligenceDocument.id,
    ingestionRunId,
    runStatus,
    extractedChunkCount,
    embeddedChunkCount: embedResult.embeddedChunkCount,
    failedChunkCount: embedResult.failedChunkCount,
    extractionStatus: EXTRACTION_STATUS.EXTRACTED,
    embeddingStatus: embedResult.embeddingStatus,
    intelligenceStatus,
    errorMessage: embedResult.errorMessage,
    appliedDomains,
    classificationMetadata: null,
    quarantined: false,
  }
}

export async function processIntelligenceTextAfterGates(
  input: ProcessIntelligenceTextInput,
): Promise<IngestComplianceDocumentResult> {
  const { supabase, organizationId, studyId, intelligenceDocumentId, ingestionRunId } = input

  if (!input.skipPhiGate) {
    const phiScan = scanPhiRisk(input.extractedText)
    if (phiScan.exceedsThreshold) {
      const quarantineReason = buildQuarantineReason(phiScan, ingestionRunId)
      await supabase
        .from('document_intelligence_documents')
        .update({
          intelligence_status: INTELLIGENCE_STATUS.QUARANTINE,
          extraction_status: EXTRACTION_STATUS.EXTRACTED,
          embedding_status: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
          quarantine_reason: quarantineReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', intelligenceDocumentId)
        .eq('organization_id', organizationId)

      await supabase
        .from('document_intelligence_ingestion_runs')
        .update({
          run_status: INGESTION_RUN_STATUS.FAILED,
          completed_at: new Date().toISOString(),
          error_message: 'PHI quarantine gate — coordinator review required',
        })
        .eq('id', ingestionRunId)
        .eq('organization_id', organizationId)

      return {
        status: 'completed',
        idempotent: false,
        alreadyReady: false,
        intelligenceDocumentId,
        ingestionRunId,
        runStatus: INGESTION_RUN_STATUS.FAILED,
        extractedChunkCount: 0,
        embeddedChunkCount: 0,
        failedChunkCount: 0,
        extractionStatus: EXTRACTION_STATUS.EXTRACTED,
        embeddingStatus: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
        intelligenceStatus: INTELLIGENCE_STATUS.QUARANTINE,
        errorMessage: 'Document quarantined for PHI review.',
        appliedDomains: [],
        classificationMetadata: null,
        quarantined: true,
      }
    }
  }

  const resolved = resolveIngestClassification({
    filename: input.sourceFilename,
    extractedText: input.extractedText,
    complianceClassification: input.complianceClassification,
    explicitDomains: input.explicitDomains,
  })

  await supabase
    .from('document_intelligence_documents')
    .update({
      document_classification: resolved.appliedClassification,
      classification_metadata: resolved.classificationMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)

  const appliedDomains = await applyIntelligenceDocumentDomains(supabase, {
    organizationId,
    studyId,
    intelligenceDocumentId,
    complianceDocumentId: input.complianceDocumentId,
    documentClassification: resolved.appliedClassification,
    explicitDomains: input.explicitDomains,
    createdBy: input.startedBy,
  })

  const { data: docRow } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .single()

  const intelligenceDocument = mapIntelligenceDocumentRow(
    (docRow ?? {}) as Record<string, unknown>,
  )

  const chunkDrafts = chunkDocumentText(input.extractedText, intelligenceDocumentId)
  if (chunkDrafts.length > MAX_CHUNKS_PER_DOC) {
    const message = `Document exceeds chunk limit (${chunkDrafts.length} > ${MAX_CHUNKS_PER_DOC})`
    await supabase
      .from('document_intelligence_documents')
      .update({
        extraction_status: EXTRACTION_STATUS.FAILED,
        intelligence_status: INTELLIGENCE_STATUS.FAILED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intelligenceDocumentId)
      .eq('organization_id', organizationId)

    return {
      status: 'completed',
      idempotent: false,
      alreadyReady: false,
      intelligenceDocumentId,
      ingestionRunId,
      runStatus: INGESTION_RUN_STATUS.FAILED,
      extractedChunkCount: 0,
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      extractionStatus: EXTRACTION_STATUS.FAILED,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
      intelligenceStatus: INTELLIGENCE_STATUS.FAILED,
      errorMessage: message,
      appliedDomains,
      classificationMetadata: resolved.classificationMetadata,
      quarantined: false,
    }
  }

  if (chunkDrafts.length > 0) {
    const { error: chunkInsertError } = await supabase.from('document_intelligence_chunks').insert(
      chunkDrafts.map((chunk) => ({
        organization_id: organizationId,
        study_id: studyId,
        intelligence_document_id: intelligenceDocumentId,
        compliance_document_id: input.complianceDocumentId,
        chunk_index: chunk.chunkIndex,
        chunk_text: chunk.chunkText,
        clean_chunk_text: chunk.cleanChunkText,
        chunk_hash: chunk.chunkHash,
        token_estimate: chunk.tokenEstimate,
        page_number: chunk.pageNumber,
        section_code: chunk.sectionCode,
        section_title: chunk.sectionTitle,
        chunk_type: chunk.chunkType,
        embedding_status: CHUNK_EMBEDDING_STATUS.PENDING,
        metadata: {},
      })),
    )
    if (chunkInsertError) throw new Error(`Failed to insert chunks: ${chunkInsertError.message}`)
  }

  await supabase
    .from('document_intelligence_documents')
    .update({
      extraction_status: EXTRACTION_STATUS.EXTRACTED,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)

  if (input.deadlineAtMs != null && isIngestDeadlineExceeded(input.deadlineAtMs)) {
    return {
      status: 'processing',
      idempotent: false,
      alreadyReady: false,
      intelligenceDocumentId,
      ingestionRunId,
      runStatus: INGESTION_RUN_STATUS.STARTED,
      extractedChunkCount: chunkDrafts.length,
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      extractionStatus: EXTRACTION_STATUS.EXTRACTED,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.PENDING,
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      errorMessage: null,
      appliedDomains,
      classificationMetadata: resolved.classificationMetadata,
      quarantined: false,
    }
  }

  const finalized = await finalizeIntelligenceIngestion(
    supabase,
    intelligenceDocument,
    ingestionRunId,
    chunkDrafts.length,
    appliedDomains,
    input.deadlineAtMs,
  )

  return {
    ...finalized,
    classificationMetadata: resolved.classificationMetadata,
  }
}
