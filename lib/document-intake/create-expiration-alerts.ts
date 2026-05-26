import type { SupabaseClient } from '@supabase/supabase-js'
import { appendComplianceAuditEvent } from './audit-ledger'
import {
  alertTypeForThreshold,
  mapExpirationAlertRow,
  type ComplianceExpirationAlertRow,
  type ExpirationAlertThreshold,
} from './expiration-alert-types'

export type CreateExpirationAlertArgs = {
  supabase: SupabaseClient
  organizationId: string
  documentId: string
  daysBeforeExpiration: ExpirationAlertThreshold
  assignedRole?: string | null
  assignedUserId?: string | null
  actorId?: string | null
  actorRole?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Creates a single expiration alert if one does not already exist for the document/threshold pair.
 */
export async function createExpirationAlert(
  args: CreateExpirationAlertArgs,
): Promise<{ alert: ComplianceExpirationAlertRow | null; created: boolean }> {
  const { data: existing } = await args.supabase
    .from('compliance_expiration_alerts')
    .select('id')
    .eq('document_id', args.documentId)
    .eq('days_before_expiration', args.daysBeforeExpiration)
    .maybeSingle()

  if (existing) {
    return { alert: null, created: false }
  }

  const alertType = alertTypeForThreshold(args.daysBeforeExpiration)
  const alertDate = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('compliance_expiration_alerts')
    .insert({
      organization_id: args.organizationId,
      document_id: args.documentId,
      alert_type: alertType,
      alert_date: alertDate,
      days_before_expiration: args.daysBeforeExpiration,
      status: 'pending',
      assigned_role: args.assignedRole ?? 'crc',
      assigned_user_id: args.assignedUserId ?? null,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { alert: null, created: false }
    }
    throw new Error(`Failed to create expiration alert: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to create expiration alert: no row returned')
  }

  const alert = mapExpirationAlertRow(data as Record<string, unknown>)

  await appendComplianceAuditEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    documentId: args.documentId,
    eventType: 'expiration_alert_created',
    actorId: args.actorId ?? null,
    actorRole: args.actorRole ?? null,
    eventPayload: {
      alert_id: alert.id,
      alert_type: alert.alertType,
      days_before_expiration: alert.daysBeforeExpiration,
      assigned_role: alert.assignedRole,
      assigned_user_id: alert.assignedUserId,
    },
  })

  return { alert, created: true }
}
