import { SupabaseClient } from '@supabase/supabase-js'
import { DocumentClassification, DestinationDomain } from './compliance-types'
import { appendComplianceAuditEvent } from './audit-ledger'

export interface CreateComplianceDocumentArgs {
  supabase: SupabaseClient
  organizationId: string
  studyId: string | null
  subjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  documentClassification: DocumentClassification
  destinationDomain: DestinationDomain
  destinationEntityType: string
  destinationEntityId: string | null
  originalFilename: string
  operationalDisplayName: string
  mimeType: string
  storageBucket: string
  storagePath: string
  cryptographicHash: string
  fileSizeBytes: number | null
  expirationDate: string | null
  certifiedCopyRequired: boolean
  tags: string[]
  operationalNotes: string | null
  metadata?: Record<string, unknown>
  actorId: string
  actorRole: string | null
  /** Pre-generated id when storage path is computed before insert. */
  documentId?: string
}

export async function createComplianceDocument(args: CreateComplianceDocumentArgs): Promise<{ id: string }> {
  const insertRow: Record<string, unknown> = {
      organization_id: args.organizationId,
      study_id: args.studyId,
      subject_id: args.subjectId,
      visit_id: args.visitId,
      procedure_execution_id: args.procedureExecutionId,
      document_classification: args.documentClassification,
      destination_domain: args.destinationDomain,
      destination_entity_type: args.destinationEntityType,
      destination_entity_id: args.destinationEntityId,
      original_filename: args.originalFilename,
      operational_display_name: args.operationalDisplayName,
      mime_type: args.mimeType,
      storage_bucket: args.storageBucket,
      storage_path: args.storagePath,
      cryptographic_hash: args.cryptographicHash,
      file_size_bytes: args.fileSizeBytes,
      expiration_date: args.expirationDate,
      certified_copy_required: args.certifiedCopyRequired,
      tags: args.tags,
      operational_notes: args.operationalNotes,
      metadata: args.metadata || {},
      created_by: args.actorId,
    }

  if (args.documentId) {
    insertRow.id = args.documentId
  }

  const { data, error } = await args.supabase
    .from('compliance_runtime_documents')
    .insert(insertRow)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create compliance document: ${error?.message || 'Unknown error'}`)
  }

  const documentId = data.id

  // 2. Append the audit event for ingestion
  await appendComplianceAuditEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    documentId: documentId,
    eventType: 'document_ingested',
    actorId: args.actorId,
    actorRole: args.actorRole,
    eventPayload: {
      original_filename: args.originalFilename,
      document_classification: args.documentClassification,
      cryptographic_hash: args.cryptographicHash,
      file_size_bytes: args.fileSizeBytes
    }
  })

  return { id: documentId }
}
