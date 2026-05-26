import type { SupabaseClient } from '@supabase/supabase-js'
import { appendComplianceAuditEvent } from './audit-ledger'
import { mapExpirationAlertRow, type ComplianceExpirationAlertRow } from './expiration-alert-types'

export type ResolveExpirationAlertArgs = {
  supabase: SupabaseClient
  organizationId: string
  alertId: string
  resolvedBy: string
  resolutionNote: string
  actorRole?: string | null
}

export async function resolveExpirationAlert(
  args: ResolveExpirationAlertArgs,
): Promise<ComplianceExpirationAlertRow> {
  const note = args.resolutionNote.trim()
  if (!note) {
    throw new Error('Resolution note is required.')
  }

  const { data: existing, error: loadError } = await args.supabase
    .from('compliance_expiration_alerts')
    .select('*')
    .eq('id', args.alertId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Expiration alert not found.')
  if (existing.status !== 'pending' && existing.status !== 'escalated') {
    throw new Error(`Alert cannot be resolved from status "${existing.status}".`)
  }

  const resolvedAt = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('compliance_expiration_alerts')
    .update({
      status: 'resolved',
      resolved_by: args.resolvedBy,
      resolved_at: resolvedAt,
      resolution_note: note,
      updated_at: resolvedAt,
    })
    .eq('id', args.alertId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to resolve expiration alert: ${error?.message ?? 'Unknown error'}`)
  }

  const alert = mapExpirationAlertRow(data as Record<string, unknown>)

  await appendComplianceAuditEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    documentId: alert.documentId,
    eventType: 'expiration_alert_resolved',
    actorId: args.resolvedBy,
    actorRole: args.actorRole ?? null,
    eventPayload: {
      alert_id: alert.id,
      alert_type: alert.alertType,
      days_before_expiration: alert.daysBeforeExpiration,
      resolution_note: note,
      resolved_at: resolvedAt,
    },
  })

  return alert
}
