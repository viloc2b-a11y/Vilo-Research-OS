import type { SupabaseClient } from '@supabase/supabase-js'
import {
  downloadComplianceDocumentBlob,
  extractTextFromComplianceDocument,
  loadComplianceDocumentSource,
} from './extract-text-from-compliance-document'
import { processIntelligenceTextAfterGates } from './process-intelligence-text-ingest'
import { INTELLIGENCE_STATUS } from './document-intelligence-types'

/**
 * Coordinator PHI override — audit logged, then continues chunk/embed pipeline.
 * Does not mutate runtime or published source.
 */
export async function releasePhiQuarantineAndContinueIngest(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  ingestionRunId: string
  actorId: string
  overrideNotes: string
  explicitDomains?: string[] | null
  deadlineAtMs?: number
}) {
  const notes = args.overrideNotes.trim()
  if (notes.length < 10) {
    throw new Error('Override notes must be at least 10 characters.')
  }

  const { data: doc, error: docError } = await args.supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', args.intelligenceDocumentId)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!doc) throw new Error('Intelligence document not found.')
  if (doc.intelligence_status !== INTELLIGENCE_STATUS.QUARANTINE) {
    throw new Error('Document is not in quarantine.')
  }

  const now = new Date().toISOString()

  await args.supabase.from('document_intelligence_phi_override_events').insert({
    organization_id: args.organizationId,
    study_id: args.studyId,
    intelligence_document_id: args.intelligenceDocumentId,
    actor_id: args.actorId,
    override_notes: notes,
    event_payload: {
      runtime_mutated: false,
      published_source_mutated: false,
      prior_quarantine_reason: doc.quarantine_reason ?? {},
    },
  })

  await args.supabase
    .from('document_intelligence_documents')
    .update({
      intelligence_status: INTELLIGENCE_STATUS.PENDING,
      phi_override_by: args.actorId,
      phi_override_at: now,
      phi_override_notes: notes,
      updated_at: now,
    })
    .eq('id', args.intelligenceDocumentId)
    .eq('organization_id', args.organizationId)

  const source = await loadComplianceDocumentSource(
    args.supabase,
    args.organizationId,
    String(doc.compliance_document_id),
  )
  if (!source) throw new Error('Compliance document not found.')

  const extraction = await extractTextFromComplianceDocument(args.supabase, source)
  if (!extraction.ok) {
    throw new Error(extraction.message || 'Re-extraction failed after PHI override.')
  }

  let ingestionRunId = args.ingestionRunId?.trim() || ''
  if (!ingestionRunId) {
    const reason = (doc.quarantine_reason ?? {}) as Record<string, unknown>
    if (typeof reason.ingestion_run_id === 'string') {
      ingestionRunId = reason.ingestion_run_id
    }
  }
  if (!ingestionRunId) {
    const { data: run } = await args.supabase
      .from('document_intelligence_ingestion_runs')
      .select('id')
      .eq('intelligence_document_id', args.intelligenceDocumentId)
      .eq('organization_id', args.organizationId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    ingestionRunId = run ? String(run.id) : ''
  }
  if (!ingestionRunId) {
    throw new Error('No ingestion run found for quarantined document.')
  }

  return processIntelligenceTextAfterGates({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    complianceDocumentId: String(doc.compliance_document_id),
    intelligenceDocumentId: args.intelligenceDocumentId,
    ingestionRunId,
    sourceFilename: source.originalFilename,
    complianceClassification: source.documentClassification,
    extractedText: extraction.text,
    explicitDomains: args.explicitDomains,
    startedBy: args.actorId,
    skipPhiGate: true,
    deadlineAtMs: args.deadlineAtMs,
  })
}
