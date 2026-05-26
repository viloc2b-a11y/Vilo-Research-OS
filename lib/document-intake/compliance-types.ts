export type DocumentClassification =
  | 'source_document'
  | 'external_medical_record'
  | 'lab_result'
  | 'imaging'
  | 'regulatory_document'
  | 'protocol'
  | 'protocol_amendment'
  | 'investigator_brochure'
  | 'training_material'
  | 'delegation_document'
  | 'financial_document'
  | 'safety_document'
  | 'vendor_document'
  | 'site_communication'
  | 'pharmacy_document'
  | 'monitoring_document'
  | 'other'

export type DestinationDomain =
  | 'source_builder'
  | 'regulatory_binder'
  | 'budget_contract'
  | 'study_documents'
  | 'subject_chart'
  | 'visit_workspace'
  | 'procedure_execution'

export type ComplianceRuntimeDocumentStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'renewal_requested'
  | 'renewed'
  | 'superseded'
  | 'archived'

export type ComplianceAuditEventType =
  | 'document_ingested'
  | 'certified_copy_attested'
  | 'document_updated'
  | 'document_superseded'
  | 'document_archived'
  | 'expiration_metadata_set'
  | 'obligation_created'
  | 'obligation_completed'
  | 'obligation_cancelled'
  | 'expiration_alert_created'
  | 'expiration_alert_resolved'
  | 'document_marked_expiring_soon'
  | 'document_marked_expired'

export interface ComplianceRuntimeDocument {
  id: string
  organization_id: string
  study_id: string | null
  subject_id: string | null
  visit_id: string | null
  procedure_execution_id: string | null
  document_classification: DocumentClassification
  destination_domain: DestinationDomain
  destination_entity_type: string
  destination_entity_id: string | null
  original_filename: string
  operational_display_name: string
  mime_type: string
  storage_bucket: string
  storage_path: string
  cryptographic_hash: string
  file_size_bytes: number | null
  expiration_date: string | null
  status: ComplianceRuntimeDocumentStatus
  supersedes_document_id: string | null
  certified_copy_required: boolean
  certified_copy_attested: boolean
  certified_copy_attested_by: string | null
  certified_copy_attested_at: string | null
  certified_copy_attestation_text: string | null
  tags: string[]
  operational_notes: string | null
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface ComplianceAuditLedgerEvent {
  id: string
  organization_id: string
  document_id: string
  event_type: ComplianceAuditEventType
  actor_id: string | null
  actor_role: string | null
  event_timestamp: string
  state_hash: string
  event_payload: Record<string, unknown>
  metadata: Record<string, unknown>
}

export const CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT = 'I certify that this document is an exact copy having all of the same information and attributes as the original.'
