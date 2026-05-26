import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceAuditEventType } from './compliance-types'

export type RecentComplianceDocumentRow = {
  id: string
  operationalDisplayName: string
  originalFilename: string
  documentClassification: string
  createdBy: string
  createdAt: string
  certifiedCopyAttested: boolean
  expirationDate: string | null
  latestAuditEventType: ComplianceAuditEventType | null
  latestAuditEventAt: string | null
}

export async function listRecentComplianceDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 10,
): Promise<RecentComplianceDocumentRow[]> {
  const { data: documents, error } = await supabase
    .from('compliance_runtime_documents')
    .select(
      'id, operational_display_name, original_filename, document_classification, created_by, created_at, certified_copy_attested, expiration_date',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !documents?.length) return []

  const documentIds = documents.map((row) => String(row.id))
  const { data: auditRows } = await supabase
    .from('compliance_audit_ledger')
    .select('document_id, event_type, event_timestamp')
    .eq('organization_id', organizationId)
    .in('document_id', documentIds)
    .order('event_timestamp', { ascending: false })

  const latestByDocument = new Map<string, { eventType: string; eventAt: string }>()
  for (const row of auditRows ?? []) {
    const documentId = String(row.document_id)
    if (latestByDocument.has(documentId)) continue
    latestByDocument.set(documentId, {
      eventType: String(row.event_type),
      eventAt: String(row.event_timestamp),
    })
  }

  return documents.map((row) => {
    const latest = latestByDocument.get(String(row.id))
    return {
      id: String(row.id),
      operationalDisplayName: String(row.operational_display_name),
      originalFilename: String(row.original_filename),
      documentClassification: String(row.document_classification),
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
      certifiedCopyAttested: Boolean(row.certified_copy_attested),
      expirationDate: row.expiration_date ? String(row.expiration_date) : null,
      latestAuditEventType: (latest?.eventType as ComplianceAuditEventType) ?? null,
      latestAuditEventAt: latest?.eventAt ?? null,
    }
  })
}
