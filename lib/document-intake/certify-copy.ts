import { SupabaseClient } from '@supabase/supabase-js'
import { appendComplianceAuditEvent } from './audit-ledger'
import { CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT } from './compliance-types'

export interface CertifyCopyArgs {
  supabase: SupabaseClient
  organizationId: string
  documentId: string
  actorId: string
  actorRole: string | null
}

export async function certifyComplianceDocumentCopy(args: CertifyCopyArgs): Promise<void> {
  const attestedAt = new Date().toISOString()

  // 1. Update the document to mark as certified
  const { error: updateError } = await args.supabase
    .from('compliance_runtime_documents')
    .update({
      certified_copy_attested: true,
      certified_copy_attested_by: args.actorId,
      certified_copy_attested_at: attestedAt,
      certified_copy_attestation_text: CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT,
      updated_at: attestedAt
    })
    .eq('id', args.documentId)
    .eq('organization_id', args.organizationId)

  if (updateError) {
    throw new Error(`Failed to update document for certified copy: ${updateError.message}`)
  }

  // 2. Append the audit event
  await appendComplianceAuditEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    documentId: args.documentId,
    eventType: 'certified_copy_attested',
    actorId: args.actorId,
    actorRole: args.actorRole,
    eventPayload: {
      attestation_text: CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT,
      attested_at: attestedAt
    }
  })
}
