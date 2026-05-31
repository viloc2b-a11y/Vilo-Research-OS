export type DispensationReviewExecutionMode =
  | 'real_time_required'
  | 'asynchronous_required'
  | 'optional'
  | 'not_required'

export type AdministrationStatus =
  | 'dispensed'
  | 'administered'
  | 'not_administered'
  | 'partially_administered'
  | 'administration_deviation'

export type DispensingCommandCenterAction =
  | 'Review Dispensation'
  | 'Review Due Today'
  | 'Review Overdue'
  | 'Waiver Requires Approval'

export type PharmacySubjectAssignmentRule = {
  assignmentRequired: boolean
  assignmentStrategy: string
  assignmentTiming: string
  randomizationDependency: string
  dispensingEligibilityRules: Record<string, unknown>
}

export type PharmacySubjectAssignmentInput = {
  organizationId: string
  studyId: string
  siteId?: string | null
  subjectId: string
  randomizationId?: string | null
  manualExceptionReason?: string | null
}

export type VisitLinkedDispensingInput = {
  organizationId: string
  studyId: string
  siteId?: string | null
  subjectId: string
  visitInstanceId: string
  procedureInstanceId: string
  subjectAssignmentId?: string | null
  kitId?: string | null
  lotId?: string | null
  supportingDocumentId?: string | null
  signatureId?: string | null
  maskedOperationalFacts?: Record<string, unknown>
}

export type AdministrationEventInput = {
  organizationId: string
  studyId: string
  siteId?: string | null
  subjectId: string
  visitInstanceId: string
  procedureInstanceId: string
  dispensationId?: string | null
  administrationStatus: AdministrationStatus
  administeredAt?: string | null
  supportingDocumentId?: string | null
  deviationReason?: string | null
  metadata?: Record<string, unknown>
}

export type DispensationReviewInput = {
  organizationId: string
  studyId: string
  siteId?: string | null
  subjectId: string
  visitInstanceId: string
  procedureInstanceId: string
  dispensationId: string
  executionMode: DispensationReviewExecutionMode
  dueAt?: string | null
  protocolBasis: string
  metadata?: Record<string, unknown>
}

export type DispensingCommandCenterItem = {
  subjectId: string
  visitInstanceId: string
  procedureInstanceId: string
  dispensationId: string
  reviewConfirmationId: string
  actionRequired: DispensingCommandCenterAction
  executionMode: DispensationReviewExecutionMode
  dueAt: string | null
}
