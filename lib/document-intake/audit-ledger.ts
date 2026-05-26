import { SupabaseClient } from '@supabase/supabase-js'
import { ComplianceAuditEventType } from './compliance-types'
import { computeAuditLedgerStateHash } from './document-hash'

export interface AppendAuditEventArgs {
  supabase: SupabaseClient
  organizationId: string
  documentId: string
  eventType: ComplianceAuditEventType
  actorId: string | null
  actorRole: string | null
  eventPayload: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Appends an immutable audit event to the compliance_audit_ledger table.
 * Does not allow updating or deleting events.
 */
export async function appendComplianceAuditEvent(args: AppendAuditEventArgs): Promise<void> {
  const timestamp = new Date().toISOString()
  const stateHash = computeAuditLedgerStateHash(
    args.documentId,
    args.eventType,
    timestamp,
    args.eventPayload
  )

  const { error } = await args.supabase
    .from('compliance_audit_ledger')
    .insert({
      organization_id: args.organizationId,
      document_id: args.documentId,
      event_type: args.eventType,
      actor_id: args.actorId,
      actor_role: args.actorRole,
      event_timestamp: timestamp,
      state_hash: stateHash,
      event_payload: args.eventPayload,
      metadata: args.metadata || {}
    })

  if (error) {
    throw new Error(`Failed to append compliance audit event: ${error.message}`)
  }
}
