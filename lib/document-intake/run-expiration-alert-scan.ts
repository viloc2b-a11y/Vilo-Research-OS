import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceRuntimeDocumentStatus } from './compliance-types'
import { appendComplianceAuditEvent } from './audit-ledger'
import { createExpirationAlert } from './create-expiration-alerts'
import {
  EXPIRING_SOON_WINDOW_DAYS,
  daysUntilExpiration,
  expirationThresholdsDue,
  type ComplianceExpirationAlertRow,
} from './expiration-alert-types'

const SCANNABLE_STATUSES: ComplianceRuntimeDocumentStatus[] = [
  'active',
  'expiring_soon',
  'expired',
  'renewal_requested',
]

type DocumentForScan = {
  id: string
  organization_id: string
  expiration_date: string
  status: ComplianceRuntimeDocumentStatus
  cryptographic_hash: string
}

export type ExpirationAlertScanResult = {
  documentsScanned: number
  alertsCreated: number
  alerts: ComplianceExpirationAlertRow[]
  statusUpdates: { documentId: string; previousStatus: string; newStatus: string }[]
}

async function updateDocumentExpirationStatus(
  supabase: SupabaseClient,
  doc: DocumentForScan,
  daysRemaining: number,
  actorId: string | null,
  actorRole: string | null,
): Promise<{ updated: boolean; newStatus: ComplianceRuntimeDocumentStatus | null }> {
  let targetStatus: ComplianceRuntimeDocumentStatus | null = null

  if (daysRemaining <= 0) {
    targetStatus = 'expired'
  } else if (daysRemaining <= EXPIRING_SOON_WINDOW_DAYS) {
    targetStatus = 'expiring_soon'
  }

  if (!targetStatus || doc.status === targetStatus) {
    return { updated: false, newStatus: null }
  }

  if (doc.status === 'expired' && targetStatus === 'expiring_soon') {
    return { updated: false, newStatus: null }
  }

  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from('compliance_runtime_documents')
    .update({ status: targetStatus, updated_at: updatedAt })
    .eq('id', doc.id)
    .eq('organization_id', doc.organization_id)

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`)
  }

  const eventType =
    targetStatus === 'expired' ? 'document_marked_expired' : 'document_marked_expiring_soon'

  await appendComplianceAuditEvent({
    supabase,
    organizationId: doc.organization_id,
    documentId: doc.id,
    eventType,
    actorId,
    actorRole,
    eventPayload: {
      previous_status: doc.status,
      new_status: targetStatus,
      days_remaining: daysRemaining,
      expiration_date: doc.expiration_date,
    },
  })

  return { updated: true, newStatus: targetStatus }
}

export type RunExpirationAlertScanArgs = {
  supabase: SupabaseClient
  organizationId: string
  actorId?: string | null
  actorRole?: string | null
}

export async function runExpirationAlertScan(
  args: RunExpirationAlertScanArgs,
): Promise<ExpirationAlertScanResult> {
  const { data: documents, error } = await args.supabase
    .from('compliance_runtime_documents')
    .select('id, organization_id, expiration_date, status, cryptographic_hash')
    .eq('organization_id', args.organizationId)
    .not('expiration_date', 'is', null)
    .in('status', SCANNABLE_STATUSES)

  if (error) {
    throw new Error(`Failed to load documents for expiration scan: ${error.message}`)
  }

  const result: ExpirationAlertScanResult = {
    documentsScanned: 0,
    alertsCreated: 0,
    alerts: [],
    statusUpdates: [],
  }

  const now = new Date()

  for (const row of documents ?? []) {
    const doc = row as DocumentForScan
    if (!doc.expiration_date) continue

    result.documentsScanned += 1
    const daysRemaining = daysUntilExpiration(doc.expiration_date, now)
    const thresholds = expirationThresholdsDue(daysRemaining)

    for (const threshold of thresholds) {
      const { alert, created } = await createExpirationAlert({
        supabase: args.supabase,
        organizationId: args.organizationId,
        documentId: doc.id,
        daysBeforeExpiration: threshold,
        actorId: args.actorId ?? null,
        actorRole: args.actorRole ?? null,
        metadata: { days_remaining_at_scan: daysRemaining },
      })
      if (created && alert) {
        result.alertsCreated += 1
        result.alerts.push(alert)
      }
    }

    const statusChange = await updateDocumentExpirationStatus(
      args.supabase,
      doc,
      daysRemaining,
      args.actorId ?? null,
      args.actorRole ?? null,
    )
    if (statusChange.updated && statusChange.newStatus) {
      result.statusUpdates.push({
        documentId: doc.id,
        previousStatus: doc.status,
        newStatus: statusChange.newStatus,
      })
    }
  }

  return result
}
