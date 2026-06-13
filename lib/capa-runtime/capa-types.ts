export const CAPA_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  UNDER_REVIEW: 'under_review',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CLOSED: 'closed',
} as const

export type CapaStatus = (typeof CAPA_STATUS)[keyof typeof CAPA_STATUS]

export const EFFECTIVENESS_RESULT = {
  PENDING: 'pending',
  PASS: 'pass',
  FAIL: 'fail',
  NOT_APPLICABLE: 'not_applicable',
} as const

export type EffectivenessResult = (typeof EFFECTIVENESS_RESULT)[keyof typeof EFFECTIVENESS_RESULT]

export type CapaActionRow = {
  id: string
  organizationId: string
  studyId: string
  deviationId: string
  capaStatus: CapaStatus
  ownerId: string | null
  rootCauseAnalysis: string | null
  correctiveAction: string
  preventiveAction: string | null
  dueDate: string | null
  completionDate: string | null
  effectivenessCheckRequired: boolean
  effectivenessCheckDate: string | null
  effectivenessCheckResult: EffectivenessResult | null
  effectivenessVerifiedBy: string | null
  effectivenessNotes: string | null
  closedBy: string | null
  closureNotes: string | null
  createdBy: string
  updatedBy: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateCapaActionInput = {
  organizationId: string
  studyId: string
  deviationId: string
  correctiveAction: string
  preventiveAction?: string | null
  rootCauseAnalysis?: string | null
  ownerId?: string | null
  dueDate?: string | null
  effectivenessCheckRequired?: boolean
  metadata?: Record<string, unknown>
}

export type UpdateCapaActionInput = {
  capaStatus?: CapaStatus
  ownerId?: string | null
  rootCauseAnalysis?: string | null
  correctiveAction?: string
  preventiveAction?: string | null
  dueDate?: string | null
  completionDate?: string | null
  effectivenessCheckRequired?: boolean
  effectivenessCheckDate?: string | null
  effectivenessCheckResult?: EffectivenessResult | null
  effectivenessVerifiedBy?: string | null
  effectivenessNotes?: string | null
  closedBy?: string | null
  closureNotes?: string | null
  metadata?: Record<string, unknown>
}

export function mapCapaActionRow(row: Record<string, unknown>): CapaActionRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    deviationId: String(row.deviation_id),
    capaStatus: row.capa_status as CapaStatus,
    ownerId: row.owner_id != null ? String(row.owner_id) : null,
    rootCauseAnalysis: row.root_cause_analysis != null ? String(row.root_cause_analysis) : null,
    correctiveAction: String(row.corrective_action),
    preventiveAction: row.preventive_action != null ? String(row.preventive_action) : null,
    dueDate: row.due_date != null ? String(row.due_date) : null,
    completionDate: row.completion_date != null ? String(row.completion_date) : null,
    effectivenessCheckRequired: Boolean(row.effectiveness_check_required),
    effectivenessCheckDate: row.effectiveness_check_date != null ? String(row.effectiveness_check_date) : null,
    effectivenessCheckResult: row.effectiveness_check_result as EffectivenessResult | null,
    effectivenessVerifiedBy: row.effectiveness_verified_by != null ? String(row.effectiveness_verified_by) : null,
    effectivenessNotes: row.effectiveness_notes != null ? String(row.effectiveness_notes) : null,
    closedBy: row.closed_by != null ? String(row.closed_by) : null,
    closureNotes: row.closure_notes != null ? String(row.closure_notes) : null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    metadata: row.metadata as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
