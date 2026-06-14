/**
 * Phase 7 — Financial runtime intelligence (derived from execution; not accounting).
 */

export type FinancialProcedureUnit = {
  procedureExecutionId: string | null
  procedureDefinitionId: string
  procedureCode: string
  procedureLabel: string
  billable: boolean
  isConditional: boolean
  isRequired: boolean
}

export type ExpectedFinancialState = {
  procedureCount: number
  billableProcedureCount: number
  requiredProcedureCount: number
  conditionalExpectedCount: number
  units: FinancialProcedureUnit[]
  protocolGraphRevision: number | null
}

export type ExecutedFinancialState = {
  procedureCompletedCount: number
  procedureBillableCompletedCount: number
  workflowExecutionCount: number
  sourceCaptureSubmittedCount: number
  safetyExecutionCount: number
  units: Array<FinancialProcedureUnit & { executionStatus: string }>
}

export type EarnedFinancialState = {
  procedureEarnedCount: number
  billableEarnedCount: number
  graphCompliantEarnedCount: number
  signableEarnedCount: number
  units: Array<
    FinancialProcedureUnit & {
      earned: boolean
      earnBlockers: string[]
    }
  >
}

export type RevenueLeakageKind =
  | 'executed_unsigned'
  | 'completed_missing_source'
  | 'completed_unresolved_findings'
  | 'blocked_governance'
  | 'blocked_safety'
  | 'blocked_protocol_graph'
  | 'unscheduled_burden'
  | 'repeat_procedure'
  | 'not_graph_compliant'

export type PaymentLifecycleStatus =
  | 'expected'
  | 'earned'
  | 'invoiced'
  | 'paid'
  | 'reverted'
  | 'disputed'
  | 'written_off'

export type FinancialRevenueComponentType =
  | 'visit_payment'
  | 'procedure_payment'
  | 'pass_through_cost'
  | 'patient_stipend'

export type FinancialRevenueComponent = {
  id: string
  componentType: FinancialRevenueComponentType
  lifecycleStatus: PaymentLifecycleStatus
  eligible: boolean
  quantity: number
  label: string
  detail: string
  procedureExecutionId?: string | null
  exclusionReason?: string | null
}

export type FinancialPaymentLifecycle = {
  subjectEnrollmentStatus: string | null
  screenFailure: boolean
  visitPaymentEligible: boolean
  visitPaymentExclusionReason: string | null
  expectedComponentCount: number
  earnedComponentCount: number
  invoiceableComponentCount: number
  components: FinancialRevenueComponent[]
}

export type RevenueLeakageItem = {
  id: string
  kind: RevenueLeakageKind
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail: string
  procedureExecutionId?: string | null
  estimatedBillableUnits?: number
}

export type ProcedureFinancialAttribution = {
  procedureExecutionId: string | null
  procedureDefinitionId: string
  procedureCode: string
  expected: boolean
  executed: boolean
  earned: boolean
  billable: boolean
  leakageKinds: RevenueLeakageKind[]
  earnBlockers: string[]
}

export type CoordinatorBurdenEconomics = {
  workflowDensity: number
  sourceBurdenUnits: number
  queryBurdenUnits: number
  safetyBurdenUnits: number
  rescheduleBurdenUnits: number
  totalBurdenCostScore: number
  burdenToEarnedRatio: number | null
}

export type UnscheduledRuntimeBurden = {
  isUnscheduled: boolean
  windowStatus: string | null
  missingScheduledDate: boolean
  outOfWindow: boolean
  burdenScore: number
  detail: string | null
}

export type AmendmentOperationalImpact = {
  activeGraphPublicationId: string | null
  graphRevision: number | null
  amendmentDeltaSummary: string | null
  nodeCountDelta: number | null
  edgeCountDelta: number | null
  operationalImpactScore: number
}

export type AmendmentVisitChange = {
  visitCode: string
  visitName: string
}

export type AmendmentVisitModification = {
  visitCode: string
  changes: string[]
}

export type AmendmentProcedureChange = {
  procedureCode: string
  procedureName: string
  visitCode: string
}

export type AmendmentDiff = {
  versionId: string
  previousVersionId: string
  graphRevision: number | null
  previousGraphRevision: number | null
  publishedAt: string | null
  amendmentType: string | null
  operationalImpactScore: number
  addedVisits: AmendmentVisitChange[]
  removedVisits: AmendmentVisitChange[]
  modifiedVisits: AmendmentVisitModification[]
  addedProcedures: AmendmentProcedureChange[]
  removedProcedures: AmendmentProcedureChange[]
  requiresTrainingReview: boolean
}

export type FinancialIntegritySafeguard = {
  id: string
  severity: 'warning' | 'error'
  label: string
  detail: string
}

export type VisitFinancialRuntime = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  computedAt: string
  financialVersion: number
  expected: ExpectedFinancialState
  executed: ExecutedFinancialState
  earned: EarnedFinancialState
  leakage: RevenueLeakageItem[]
  procedureAttributions: ProcedureFinancialAttribution[]
  coordinatorEconomics: CoordinatorBurdenEconomics
  unscheduledBurden: UnscheduledRuntimeBurden
  amendmentImpact: AmendmentOperationalImpact
  paymentLifecycle: FinancialPaymentLifecycle
  visitFinancialBurdenScore: number
  leakageScore: number
  earnedRateBasisPoints: number
  safeguards: FinancialIntegritySafeguard[]
  snapshot: Record<string, unknown>
}

export type SubjectFinancialRuntime = {
  studySubjectId: string
  organizationId: string
  studyId: string
  computedAt: string
  financialVersion: number
  expected: { procedureCount: number; billableProcedureCount: number }
  executed: { procedureCompletedCount: number }
  earned: { procedureEarnedCount: number; billableEarnedCount: number }
  leakage: RevenueLeakageItem[]
  coordinatorEconomics: CoordinatorBurdenEconomics
  unscheduledBurden: { visitCount: number; totalBurdenScore: number }
  amendmentImpact: AmendmentOperationalImpact
  leakageScore: number
  earnedRateBasisPoints: number
  safeguards: FinancialIntegritySafeguard[]
  snapshot: Record<string, unknown>
}
