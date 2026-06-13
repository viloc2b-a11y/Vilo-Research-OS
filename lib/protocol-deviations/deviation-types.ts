export const DEVIATION_TYPE = {
  MISSED_VISIT: 'missed_visit',
  VISIT_WINDOW_VIOLATION: 'visit_window_violation',
  MISSED_PROCEDURE: 'missed_procedure',
  DELAYED_PROCEDURE: 'delayed_procedure',
  SUBJECT_NONCOMPLIANCE: 'subject_noncompliance',
  PROTOCOL_EXCEPTION: 'protocol_exception',
  SPONSOR_DIRECTED: 'sponsor_directed',
  OTHER: 'other',
} as const

export type DeviationType = (typeof DEVIATION_TYPE)[keyof typeof DEVIATION_TYPE]

export const DEVIATION_STATUS = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  CLOSED: 'closed',
} as const

export type DeviationStatus = (typeof DEVIATION_STATUS)[keyof typeof DEVIATION_STATUS]

export const DEVIATION_SEVERITY = {
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const

export type DeviationSeverity = (typeof DEVIATION_SEVERITY)[keyof typeof DEVIATION_SEVERITY]

export type ProtocolDeviationRow = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  deviationType: DeviationType
  status: DeviationStatus
  severity: DeviationSeverity
  description: string
  rootCause: string | null
  correctiveAction: string | null
  preventiveAction: string | null
  requiresSponsorNotification: boolean
  requiresIrbNotification: boolean
  openedAt: string
  closedAt: string | null
  createdBy: string
  updatedBy: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateDeviationInput = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  deviationType: DeviationType
  severity: DeviationSeverity
  description: string
  rootCause?: string | null
  correctiveAction?: string | null
  preventiveAction?: string | null
  requiresSponsorNotification?: boolean
  requiresIrbNotification?: boolean
  openedAt?: string
  metadata?: Record<string, unknown>
}

export type UpdateDeviationInput = {
  deviationType?: DeviationType
  status?: DeviationStatus
  severity?: DeviationSeverity
  description?: string
  rootCause?: string | null
  correctiveAction?: string | null
  preventiveAction?: string | null
  requiresSponsorNotification?: boolean
  requiresIrbNotification?: boolean
  closedAt?: string | null
  metadata?: Record<string, unknown>
}

export function mapProtocolDeviationRow(row: Record<string, unknown>): ProtocolDeviationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    subjectId: String(row.subject_id),
    visitId: row.visit_id != null ? String(row.visit_id) : null,
    deviationType: row.deviation_type as DeviationType,
    status: row.status as DeviationStatus,
    severity: row.severity as DeviationSeverity,
    description: String(row.description),
    rootCause: row.root_cause != null ? String(row.root_cause) : null,
    correctiveAction: row.corrective_action != null ? String(row.corrective_action) : null,
    preventiveAction: row.preventive_action != null ? String(row.preventive_action) : null,
    requiresSponsorNotification: Boolean(row.requires_sponsor_notification),
    requiresIrbNotification: Boolean(row.requires_irb_notification),
    openedAt: String(row.opened_at),
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    metadata: row.metadata as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
