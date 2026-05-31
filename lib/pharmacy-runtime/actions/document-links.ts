'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

export type PharmacyDocumentLinkInput = {
  organizationId: string
  studyId: string
  siteId?: string | null
  entityType:
    | 'pharmacy_runtime_blueprint'
    | 'ip_receipt'
    | 'ip_correction'
    | 'ip_accountability_exception'
    | 'ip_shipment'
  entityId: string
  documentId: string
  documentReaderArtifactId?: string | null
  documentRole:
    | 'source_document'
    | 'document_reader_artifact'
    | 'packing_slip'
    | 'depot_shipment_notice'
    | 'chain_of_custody'
    | 'receipt_confirmation'
    | 'discrepancy_evidence'
    | 'quarantine_evidence'
    | 'correction_support'
}

export function assertManualEntryJustified(source: string | undefined, reason: string | undefined | null) {
  if (source === 'manual_exception' && !reason?.trim()) {
    throw new Error('Manual Pharmacy entry is exception-only and requires justification.')
  }
}

export async function insertPharmacyDocumentLinks(
  supabase: SupabaseClient,
  links: PharmacyDocumentLinkInput[],
  createdBy: string,
) {
  if (links.length === 0) return []

  const { data, error } = await supabase
    .from('ip_document_links')
    .insert(
      links.map((link) => ({
        organization_id: link.organizationId,
        study_id: link.studyId,
        site_id: link.siteId ?? null,
        entity_type: link.entityType,
        entity_id: link.entityId,
        document_id: link.documentId,
        document_reader_artifact_id: link.documentReaderArtifactId ?? null,
        document_role: link.documentRole,
        created_by: createdBy,
      })),
    )
    .select('*')

  if (error) throw new Error(error.message)
  return data ?? []
}
