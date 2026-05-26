import type { SupabaseClient } from '@supabase/supabase-js'
import {
  daysUntilExpiration,
  mapExpirationAlertRow,
  type ExpirationAlertView,
} from './expiration-alert-types'

export type ListExpirationAlertsFilters = {
  organizationId: string
  status?: string[] | null
  documentId?: string | null
  limit?: number
}

export async function listExpirationAlerts(
  supabase: SupabaseClient,
  filters: ListExpirationAlertsFilters,
): Promise<ExpirationAlertView[]> {
  const statuses = filters.status ?? ['pending', 'escalated']

  let query = supabase
    .from('compliance_expiration_alerts')
    .select(
      `
      *,
      compliance_runtime_documents!inner (
        operational_display_name,
        document_classification,
        expiration_date
      )
    `,
    )
    .eq('organization_id', filters.organizationId)
    .in('status', statuses)
    .order('alert_date', { ascending: false })

  if (filters.documentId) {
    query = query.eq('document_id', filters.documentId)
  }
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const doc = row.compliance_runtime_documents as {
      operational_display_name: string
      document_classification: string
      expiration_date: string
    }
    const alert = mapExpirationAlertRow(row as Record<string, unknown>)
    const expirationDate = String(doc.expiration_date)
    return {
      ...alert,
      documentOperationalDisplayName: String(doc.operational_display_name),
      documentClassification: String(doc.document_classification),
      documentExpirationDate: expirationDate,
      daysRemaining: daysUntilExpiration(expirationDate),
    }
  })
}
