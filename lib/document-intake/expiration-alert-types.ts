export const EXPIRATION_ALERT_THRESHOLDS = [30, 14, 7, 1, 0] as const

export type ExpirationAlertThreshold = (typeof EXPIRATION_ALERT_THRESHOLDS)[number]

export const EXPIRATION_ALERT_TYPE = {
  EXPIRATION_WARNING: 'expiration_warning',
  EXPIRED: 'expired',
} as const

export type ExpirationAlertType =
  (typeof EXPIRATION_ALERT_TYPE)[keyof typeof EXPIRATION_ALERT_TYPE]

export const EXPIRATION_ALERT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  ESCALATED: 'escalated',
} as const

export type ExpirationAlertStatus =
  (typeof EXPIRATION_ALERT_STATUS)[keyof typeof EXPIRATION_ALERT_STATUS]

export const EXPIRING_SOON_WINDOW_DAYS = 30

export const EXPIRATION_ALERT_TYPE_LABELS: Record<ExpirationAlertType, string> = {
  expiration_warning: 'Document expiring soon',
  expired: 'Expired document',
}

export const EXPIRATION_THRESHOLD_LABELS: Record<ExpirationAlertThreshold, string> = {
  30: '30 days remaining',
  14: '14 days remaining',
  7: '7 days remaining',
  1: '1 day remaining',
  0: 'Renewal needed',
}

export type ComplianceExpirationAlertRow = {
  id: string
  organizationId: string
  documentId: string
  alertType: ExpirationAlertType
  alertDate: string
  daysBeforeExpiration: ExpirationAlertThreshold
  status: ExpirationAlertStatus
  assignedRole: string | null
  assignedUserId: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  resolutionNote: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ExpirationAlertView = ComplianceExpirationAlertRow & {
  documentOperationalDisplayName: string
  documentClassification: string
  documentExpirationDate: string
  daysRemaining: number
}

/** Calendar-day difference from now (UTC) to expiration date. Negative if past due. */
export function daysUntilExpiration(expirationDateIso: string, now = new Date()): number {
  const exp = new Date(expirationDateIso)
  const startNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const startExp = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate())
  return Math.floor((startExp - startNow) / (24 * 60 * 60 * 1000))
}

/** Thresholds that should have an alert for the given days remaining (includes catch-up). */
export function expirationThresholdsDue(daysRemaining: number): ExpirationAlertThreshold[] {
  const due: ExpirationAlertThreshold[] = []
  for (const threshold of EXPIRATION_ALERT_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      due.push(threshold)
    }
  }
  return due
}

export function alertTypeForThreshold(threshold: ExpirationAlertThreshold): ExpirationAlertType {
  return threshold === 0 ? EXPIRATION_ALERT_TYPE.EXPIRED : EXPIRATION_ALERT_TYPE.EXPIRATION_WARNING
}

export function mapExpirationAlertRow(row: Record<string, unknown>): ComplianceExpirationAlertRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    documentId: String(row.document_id),
    alertType: row.alert_type as ExpirationAlertType,
    alertDate: String(row.alert_date),
    daysBeforeExpiration: row.days_before_expiration as ExpirationAlertThreshold,
    status: row.status as ExpirationAlertStatus,
    assignedRole: row.assigned_role ? String(row.assigned_role) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
