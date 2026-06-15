/**
 * GOV-2 registry types — use case, validation, configuration, and human review.
 * Extends GOV-0 (types.ts) with platform-level governance registries.
 */

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type AiUseCaseRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AiUseCaseStatus = 'active' | 'retired' | 'under_review' | 'pending_validation'
export type AiValidationResult = 'pass' | 'fail' | 'partial' | 'pending'
export type AiConfigType = 'model' | 'prompt' | 'parser' | 'extractor' | 'automation_rule' | 'ruleset' | 'threshold'
export type AiConfigValidationStatus = 'not_required' | 'pending' | 'in_progress' | 'validated' | 'failed'

// ---------------------------------------------------------------------------
// 1. AI Use Case Registry
// ---------------------------------------------------------------------------

export type AiUseCaseRecord = {
  id: string
  module: string
  useCaseName: string
  purpose: string
  riskLevel: AiUseCaseRiskLevel
  workflowArea: string
  humanReviewRequired: boolean
  humanReviewerRole: string | null
  inputSources: string[]
  outputType: string
  currentStatus: AiUseCaseStatus
  ownerRole: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// 2. AI Validation Registry
// ---------------------------------------------------------------------------

export type AiValidationRecord = {
  id: string
  useCaseId: string
  validationName: string
  validationScope: string
  sampleType: string
  expectedBehavior: string
  observedBehavior: string | null
  smeReviewRequired: boolean
  smeReviewerRole: string | null
  validationResult: AiValidationResult | null
  validationArtifactPath: string | null
  validatedAt: string | null
  validatedBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// 3. AI Configuration Registry
// ---------------------------------------------------------------------------

export type AiConfigurationRecord = {
  id: string
  useCaseId: string
  configType: AiConfigType
  configName: string
  configVersion: string
  changeReason: string
  previousVersion: string | null
  effectiveDate: string
  retiredAt: string | null
  validationRequired: boolean
  validationStatus: AiConfigValidationStatus
  approvedBy: string | null
  approvedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// 4. AI Human Review Registry
// ---------------------------------------------------------------------------

export type AiHumanReviewRecord = {
  id: string
  useCaseId: string
  module: string
  reviewStep: string
  reviewerRole: string
  isRequired: boolean
  decisionOptions: string[]
  auditEventTable: string | null
  evidenceLocation: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Portal view model (used by /ai-governance page)
// ---------------------------------------------------------------------------

export type AiGovernancePortalRow = {
  useCase: AiUseCaseRecord
  latestValidation: AiValidationRecord | null
  activeConfig: AiConfigurationRecord | null
  humanReviewCheckpoints: AiHumanReviewRecord[]
  /** True when at least one validation record exists with result !== 'pending'. */
  hasValidationEvidence: boolean
  /** True when human_review_required but no human review checkpoint is defined. */
  missingHumanReviewCheckpoint: boolean
  /** Open validation gap: use case is active but all validations are pending. */
  openValidationGap: boolean
}

// ---------------------------------------------------------------------------
// Module closure check
// ---------------------------------------------------------------------------

export type ModuleClosureCheckResult = {
  moduleKey: string
  canClose: boolean
  blockers: string[]
  warnings: string[]
}
