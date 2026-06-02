import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTELLIGENCE_STATUS,
  mapIntelligenceDocumentRow,
  type DocumentIntelligenceDocumentRow,
} from './document-intelligence-types'
import { resolveDocumentFamilyForIngest } from './resolve-document-family'

export type CreateIntelligenceDocumentArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string | null
  complianceDocumentId: string
  documentClassification: string
  sourceHash: string
  sourceFilename: string
  sourceMimeType: string
  createdBy: string | null
  versionLabel?: string | null
  supersedesIntelligenceDocumentId?: string | null
}

export async function findReadyIntelligenceDocument(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  complianceDocumentId: string,
  sourceHash: string,
): Promise<DocumentIntelligenceDocumentRow | null> {
  const { data, error } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('compliance_document_id', complianceDocumentId)
    .eq('source_hash', sourceHash)
    .eq('intelligence_status', INTELLIGENCE_STATUS.READY)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapIntelligenceDocumentRow(data as Record<string, unknown>)
}

export async function createIntelligenceDocument(
  args: CreateIntelligenceDocumentArgs,
): Promise<DocumentIntelligenceDocumentRow> {
  if (!args.organizationId) {
    throw new Error('organization_id is required to create an intelligence document.')
  }
  if (!args.complianceDocumentId) {
    throw new Error('compliance_document_id is required to create an intelligence document.')
  }
  if (!args.documentClassification) {
    throw new Error('document_classification is required to create an intelligence document.')
  }
  if (!args.studyId) {
    throw new Error('study_id is required for intelligence document creation.')
  }

  const family = await resolveDocumentFamilyForIngest(
    args.supabase,
    args.organizationId,
    args.studyId,
    args.complianceDocumentId,
  )

  const now = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('document_intelligence_documents')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      compliance_document_id: args.complianceDocumentId,
      document_classification: args.documentClassification,
      intelligence_status: INTELLIGENCE_STATUS.PENDING,
      extraction_status: 'pending',
      embedding_status: 'pending',
      source_hash: args.sourceHash,
      source_filename: args.sourceFilename,
      source_mime_type: args.sourceMimeType,
      document_family_id: family.documentFamilyId,
      version_number: family.versionNumber,
      version_label: args.versionLabel ?? `v${family.versionNumber}`,
      supersedes_intelligence_document_id:
        args.supersedesIntelligenceDocumentId ?? family.priorLatestDocumentId,
      effective_from: now,
      created_by: args.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === '42501' || error?.message?.includes('row-level security')) {
      throw new Error(
        'Access denied: You do not have permission to ingest documents for this study or organization.',
      )
    }
    throw new Error(`Failed to create intelligence document: ${error?.message ?? 'Unknown error'}`)
  }

  return mapIntelligenceDocumentRow(data as Record<string, unknown>)
}
