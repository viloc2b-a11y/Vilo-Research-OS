export type ValidationStatus = 'clean' | 'warning' | 'incomplete' | 'blocked'

export type VisitRuntimeNote = {
  id: string
  text: string
  createdBy: string | null
  createdAt: string
}

export type VisitRuntimeAuditEntry = {
  id: string
  fieldLabel: string
  previousValue: string | null
  newValue: string | null
  changedBy: string | null
  changedAt: string
  eventType: string
  isCorrection: boolean
  isAddendum: boolean
}

export type VisitRuntimeValidationAlert = {
  id: string
  severity: 'info' | 'warning' | 'blocked'
  message: string
  fieldLabel?: string | null
}

export type VisitRuntimeToolbarModel = {
  procedureExecutionId: string
  responseSetId: string
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string
  isSigned: boolean
  signedAt: string | null
  signedBy: string | null
  isLocked: boolean
  fieldsDisabledAt: string | null
  fieldsDisabledBy: string | null
  fieldsDisabledReason: string | null
  sectionDisabledAt: string | null
  sectionDisabledBy: string | null
  sectionDisabledReason: string | null
  validationStatus: ValidationStatus
  updatedAt: string | null
  validationAlerts: VisitRuntimeValidationAlert[]
  missingRequiredCount: number
  unresolvedFindingCount: number
  unsignedSectionCount: number
  notes: VisitRuntimeNote[]
  auditEntries: VisitRuntimeAuditEntry[]
  pdfHref: string
}

export type VisitRuntimeActionState = {
  ok: boolean
  message: string | null
  requestId?: string
  validation?: Record<string, unknown>
}

export const INITIAL_VISIT_RUNTIME_ACTION_STATE: VisitRuntimeActionState = {
  ok: false,
  message: null,
}
