import type { SupabaseClient } from '@supabase/supabase-js'
import { buildStoragePath } from './build-storage-path'
import { certifyComplianceDocumentCopy } from './certify-copy'
import { createComplianceDocument } from './create-compliance-document'
import type { DestinationDomain, DocumentClassification } from './compliance-types'
import { computeDocumentHash } from './document-hash'
import { COMPLIANCE_STORAGE_BUCKET, uploadDocumentBlob } from './upload-document-blob'
import type { LabReviewRoutingResult } from '@/lib/longitudinal-labs/route-document-to-lab-review'
import { routeDocumentToLabReview } from '@/lib/longitudinal-labs/route-document-to-lab-review'

export type IngestComplianceDocumentInput = {
  supabase: SupabaseClient
  file: File
  fileBuffer: Buffer
  organizationId: string
  studyId: string | null
  subjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  documentClassification: DocumentClassification
  destinationDomain: DestinationDomain
  destinationEntityType: string
  destinationEntityId: string | null
  operationalDisplayName: string
  expirationDate: string | null
  certifiedCopyAttested: boolean
  operationalNotes: string | null
  actorId: string
  actorRole: string | null
}

export type IngestComplianceDocumentResult =
  | { ok: true; documentId: string; labReviewRouting?: LabReviewRoutingResult }
  | { ok: false; message: string }

export async function ingestComplianceDocument(
  input: IngestComplianceDocumentInput,
): Promise<IngestComplianceDocumentResult> {
  const documentId = crypto.randomUUID()
  const cryptographicHash = computeDocumentHash(input.fileBuffer)

  const storagePath = buildStoragePath({
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: input.subjectId,
    documentId,
    filename: input.file.name,
  })

  const uploadResult = await uploadDocumentBlob({
    supabase: input.supabase,
    storagePath,
    file: input.file,
  })
  if (!uploadResult.ok) {
    return { ok: false, message: uploadResult.message ?? 'Storage upload failed.' }
  }

  try {
    await createComplianceDocument({
      supabase: input.supabase,
      documentId,
      organizationId: input.organizationId,
      studyId: input.studyId,
      subjectId: input.subjectId,
      visitId: input.visitId,
      procedureExecutionId: input.procedureExecutionId,
      documentClassification: input.documentClassification,
      destinationDomain: input.destinationDomain,
      destinationEntityType: input.destinationEntityType,
      destinationEntityId: input.destinationEntityId,
      originalFilename: input.file.name,
      operationalDisplayName: input.operationalDisplayName,
      mimeType: input.file.type,
      storageBucket: COMPLIANCE_STORAGE_BUCKET,
      storagePath,
      cryptographicHash,
      fileSizeBytes: input.file.size,
      expirationDate: input.expirationDate,
      certifiedCopyRequired: input.certifiedCopyAttested,
      tags: [],
      operationalNotes: input.operationalNotes,
      metadata: {
        destination_domain: input.destinationDomain,
        destination_entity_type: input.destinationEntityType,
      },
      actorId: input.actorId,
      actorRole: input.actorRole,
    })

    if (input.certifiedCopyAttested) {
      await certifyComplianceDocumentCopy({
        supabase: input.supabase,
        organizationId: input.organizationId,
        documentId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      })
    }

    let labReviewRouting: LabReviewRoutingResult | undefined
    if (input.documentClassification === 'lab_result') {
      try {
        labReviewRouting = await routeDocumentToLabReview({
          supabase: input.supabase,
          organizationId: input.organizationId,
          studyId: input.studyId,
          subjectId: input.subjectId,
          visitId: input.visitId,
          complianceDocumentId: documentId,
          documentClassification: input.documentClassification,
        })
      } catch (err) {
        console.error('Failed to route document to lab review:', err)
      }
    }

    return { ok: true, documentId, labReviewRouting }
  } catch (error) {
    await input.supabase.storage.from(COMPLIANCE_STORAGE_BUCKET).remove([storagePath])
    const message = error instanceof Error ? error.message : 'Failed to persist compliance document.'
    return { ok: false, message }
  }
}
