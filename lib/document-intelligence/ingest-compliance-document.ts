import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createIntelligenceDocument,
  findReadyIntelligenceDocument,
} from './create-intelligence-document'
import { applyIntelligenceDocumentDomains } from './apply-intelligence-domains'
import {
  downloadComplianceDocumentBlob,
  extractTextFromComplianceDocument,
  loadComplianceDocumentSource,
} from './extract-text-from-compliance-document'
import { hashBuffer } from './document-hash-utils'
import { assertK1SingleStudyScope } from './document-intelligence-scope'
import { createIngestDeadline } from './ingest-runtime'
import { processIntelligenceTextAfterGates } from './process-intelligence-text-ingest'
import {
  EXTRACTION_STATUS,
  INTELLIGENCE_STATUS,
  INGESTION_RUN_STATUS,
  DOCUMENT_EMBEDDING_STATUS,
  type IngestComplianceDocumentInput,
  type IngestComplianceDocumentResult,
} from './document-intelligence-types'
import { mapIntelligenceDocumentRow } from './document-intelligence-types'
import { listActiveIntelligenceDocumentDomains } from './apply-intelligence-domains'
import { continueIntelligenceIngestion as continueFromProcessing } from './continue-intelligence-ingest'

export type IngestComplianceDocumentOptions = {
  deadlineAtMs?: number
}

export { continueFromProcessing as continueIntelligenceIngestion }

export async function ingestComplianceDocumentForIntelligence(
  supabase: SupabaseClient,
  input: IngestComplianceDocumentInput,
  startedBy: string | null,
  options?: IngestComplianceDocumentOptions,
): Promise<IngestComplianceDocumentResult> {
  const organizationId = input.organization_id
  const complianceDocumentId = input.compliance_document_id
  const deadlineAtMs = options?.deadlineAtMs ?? createIngestDeadline()

  const source = await loadComplianceDocumentSource(
    supabase,
    organizationId,
    complianceDocumentId,
  )
  if (!source) {
    throw new Error('Compliance document not found for organization.')
  }

  assertK1SingleStudyScope(input.study_id)
  const studyId = input.study_id.trim()
  if (source.studyId && source.studyId !== studyId) {
    throw new Error('study_id does not match the compliance document study scope.')
  }

  const blob = await downloadComplianceDocumentBlob(source)
  const sourceHash = hashBuffer(blob)

  const existingReady = await findReadyIntelligenceDocument(
    supabase,
    organizationId,
    studyId,
    complianceDocumentId,
    sourceHash,
  )
  if (existingReady) {
    const appliedDomains = await applyIntelligenceDocumentDomains(supabase, {
      organizationId,
      studyId,
      intelligenceDocumentId: existingReady.id,
      complianceDocumentId,
      documentClassification: source.documentClassification,
      explicitDomains: input.domains,
      createdBy: startedBy,
    })
    return {
      status: 'completed',
      idempotent: true,
      alreadyReady: true,
      intelligenceDocumentId: existingReady.id,
      ingestionRunId: '',
      runStatus: INGESTION_RUN_STATUS.COMPLETED,
      extractedChunkCount: 0,
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      extractionStatus: existingReady.extractionStatus,
      embeddingStatus: existingReady.embeddingStatus,
      intelligenceStatus: existingReady.intelligenceStatus,
      errorMessage: null,
      appliedDomains,
      classificationMetadata: existingReady.classificationMetadata,
      quarantined: existingReady.intelligenceStatus === INTELLIGENCE_STATUS.QUARANTINE,
    }
  }

  const intelligenceDocument = await createIntelligenceDocument({
    supabase,
    organizationId,
    studyId,
    complianceDocumentId,
    documentClassification: source.documentClassification,
    sourceHash,
    sourceFilename: source.originalFilename,
    sourceMimeType: source.mimeType,
    createdBy: startedBy,
  })

  const runStartedAt = new Date().toISOString()
  const { data: runRow, error: runInsertError } = await supabase
    .from('document_intelligence_ingestion_runs')
    .insert({
      organization_id: organizationId,
      study_id: studyId,
      intelligence_document_id: intelligenceDocument.id,
      compliance_document_id: complianceDocumentId,
      run_status: INGESTION_RUN_STATUS.STARTED,
      started_by: startedBy,
      started_at: runStartedAt,
      metadata: {},
    })
    .select('id')
    .single()

  if (runInsertError || !runRow) {
    throw new Error(`Failed to create ingestion run: ${runInsertError?.message ?? 'Unknown error'}`)
  }

  const ingestionRunId = String(runRow.id)

  await supabase
    .from('document_intelligence_documents')
    .update({ extraction_status: EXTRACTION_STATUS.EXTRACTING, updated_at: new Date().toISOString() })
    .eq('id', intelligenceDocument.id)
    .eq('organization_id', organizationId)

  const extraction = await extractTextFromComplianceDocument(supabase, source)
  if (!extraction.ok) {
    const runStatus =
      extraction.extractionStatus === EXTRACTION_STATUS.UNSUPPORTED
        ? INGESTION_RUN_STATUS.UNSUPPORTED
        : INGESTION_RUN_STATUS.FAILED

    await supabase
      .from('document_intelligence_documents')
      .update({
        extraction_status: extraction.extractionStatus,
        intelligence_status: INTELLIGENCE_STATUS.FAILED,
        embedding_status: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intelligenceDocument.id)
      .eq('organization_id', organizationId)

    await supabase
      .from('document_intelligence_ingestion_runs')
      .update({
        run_status: runStatus,
        completed_at: new Date().toISOString(),
        error_message: extraction.message,
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
      extractedChunkCount: 0,
      embeddedChunkCount: 0,
      failedChunkCount: 0,
      extractionStatus: extraction.extractionStatus,
      embeddingStatus: DOCUMENT_EMBEDDING_STATUS.SKIPPED,
      intelligenceStatus: INTELLIGENCE_STATUS.FAILED,
      errorMessage: extraction.message,
      appliedDomains: [],
      classificationMetadata: null,
      quarantined: false,
    }
  }

  return processIntelligenceTextAfterGates({
    supabase,
    organizationId,
    studyId,
    complianceDocumentId,
    intelligenceDocumentId: intelligenceDocument.id,
    ingestionRunId,
    sourceFilename: source.originalFilename,
    complianceClassification: source.documentClassification,
    extractedText: extraction.text,
    explicitDomains: input.domains,
    startedBy,
    deadlineAtMs,
  })
}
