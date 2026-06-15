/**
 * GOV-2 portal data loader — fetches all four registries and assembles
 * the AiGovernancePortalRow view model for the /ai-governance page.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AiUseCaseRecord,
  AiValidationRecord,
  AiConfigurationRecord,
  AiHumanReviewRecord,
  AiGovernancePortalRow,
} from '@/lib/ai-governance/registry-types'

// ---------------------------------------------------------------------------
// Raw DB row types
// ---------------------------------------------------------------------------

type RawUseCase = {
  id: string
  module: string
  use_case_name: string
  purpose: string
  risk_level: string
  workflow_area: string
  human_review_required: boolean
  human_reviewer_role: string | null
  input_sources: string[]
  output_type: string
  current_status: string
  owner_role: string
  created_at: string
  updated_at: string
}

type RawValidation = {
  id: string
  use_case_id: string
  validation_name: string
  validation_scope: string
  sample_type: string
  expected_behavior: string
  observed_behavior: string | null
  sme_review_required: boolean
  sme_reviewer_role: string | null
  validation_result: string | null
  validation_artifact_path: string | null
  validated_at: string | null
  validated_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type RawConfig = {
  id: string
  use_case_id: string
  config_type: string
  config_name: string
  config_version: string
  change_reason: string
  previous_version: string | null
  effective_date: string
  retired_at: string | null
  validation_required: boolean
  validation_status: string
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type RawHumanReview = {
  id: string
  use_case_id: string
  module: string
  review_step: string
  reviewer_role: string
  is_required: boolean
  decision_options: string[]
  audit_event_table: string | null
  evidence_location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapUseCase(r: RawUseCase): AiUseCaseRecord {
  return {
    id: r.id,
    module: r.module,
    useCaseName: r.use_case_name,
    purpose: r.purpose,
    riskLevel: r.risk_level as AiUseCaseRecord['riskLevel'],
    workflowArea: r.workflow_area,
    humanReviewRequired: r.human_review_required,
    humanReviewerRole: r.human_reviewer_role,
    inputSources: r.input_sources,
    outputType: r.output_type,
    currentStatus: r.current_status as AiUseCaseRecord['currentStatus'],
    ownerRole: r.owner_role,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapValidation(r: RawValidation): AiValidationRecord {
  return {
    id: r.id,
    useCaseId: r.use_case_id,
    validationName: r.validation_name,
    validationScope: r.validation_scope,
    sampleType: r.sample_type,
    expectedBehavior: r.expected_behavior,
    observedBehavior: r.observed_behavior,
    smeReviewRequired: r.sme_review_required,
    smeReviewerRole: r.sme_reviewer_role,
    validationResult: r.validation_result as AiValidationRecord['validationResult'],
    validationArtifactPath: r.validation_artifact_path,
    validatedAt: r.validated_at,
    validatedBy: r.validated_by,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapConfig(r: RawConfig): AiConfigurationRecord {
  return {
    id: r.id,
    useCaseId: r.use_case_id,
    configType: r.config_type as AiConfigurationRecord['configType'],
    configName: r.config_name,
    configVersion: r.config_version,
    changeReason: r.change_reason,
    previousVersion: r.previous_version,
    effectiveDate: r.effective_date,
    retiredAt: r.retired_at,
    validationRequired: r.validation_required,
    validationStatus: r.validation_status as AiConfigurationRecord['validationStatus'],
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapHumanReview(r: RawHumanReview): AiHumanReviewRecord {
  return {
    id: r.id,
    useCaseId: r.use_case_id,
    module: r.module,
    reviewStep: r.review_step,
    reviewerRole: r.reviewer_role,
    isRequired: r.is_required,
    decisionOptions: r.decision_options,
    auditEventTable: r.audit_event_table,
    evidenceLocation: r.evidence_location,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

export async function loadGovernancePortal(
  supabase: SupabaseClient,
): Promise<AiGovernancePortalRow[]> {
  const [useCaseResult, validationResult, configResult, humanReviewResult] =
    await Promise.all([
      supabase
        .from('ai_use_case_registry')
        .select('*')
        .eq('current_status', 'active')
        .order('module', { ascending: true })
        .order('use_case_name', { ascending: true }),

      supabase
        .from('ai_validation_registry')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('ai_configuration_registry')
        .select('*')
        .is('retired_at', null)
        .order('effective_date', { ascending: false }),

      supabase
        .from('ai_human_review_registry')
        .select('*')
        .order('module', { ascending: true }),
    ])

  const useCases = ((useCaseResult.data ?? []) as RawUseCase[]).map(mapUseCase)
  const allValidations = ((validationResult.data ?? []) as RawValidation[]).map(mapValidation)
  const allConfigs = ((configResult.data ?? []) as RawConfig[]).map(mapConfig)
  const allReviews = ((humanReviewResult.data ?? []) as RawHumanReview[]).map(mapHumanReview)

  // Index by use_case_id for O(1) lookup
  const validationsByUcId = new Map<string, AiValidationRecord[]>()
  for (const v of allValidations) {
    if (!validationsByUcId.has(v.useCaseId)) validationsByUcId.set(v.useCaseId, [])
    validationsByUcId.get(v.useCaseId)!.push(v)
  }

  const configsByUcId = new Map<string, AiConfigurationRecord[]>()
  for (const c of allConfigs) {
    if (!configsByUcId.has(c.useCaseId)) configsByUcId.set(c.useCaseId, [])
    configsByUcId.get(c.useCaseId)!.push(c)
  }

  const reviewsByUcId = new Map<string, AiHumanReviewRecord[]>()
  for (const r of allReviews) {
    if (!reviewsByUcId.has(r.useCaseId)) reviewsByUcId.set(r.useCaseId, [])
    reviewsByUcId.get(r.useCaseId)!.push(r)
  }

  return useCases.map((uc) => {
    const validations = validationsByUcId.get(uc.id) ?? []
    const configs = configsByUcId.get(uc.id) ?? []
    const checkpoints = reviewsByUcId.get(uc.id) ?? []

    const latestValidation = validations[0] ?? null
    // Prefer the config with the most recent effective_date (already sorted desc)
    const activeConfig = configs[0] ?? null

    const hasValidationEvidence = validations.some(
      (v) => v.validationResult !== null && v.validationResult !== 'pending',
    )

    const missingHumanReviewCheckpoint =
      uc.humanReviewRequired && checkpoints.length === 0

    const openValidationGap =
      uc.currentStatus === 'active' &&
      validations.length > 0 &&
      validations.every((v) => v.validationResult === 'pending' || v.validationResult === null)

    return {
      useCase: uc,
      latestValidation,
      activeConfig,
      humanReviewCheckpoints: checkpoints,
      hasValidationEvidence,
      missingHumanReviewCheckpoint,
      openValidationGap,
    } satisfies AiGovernancePortalRow
  })
}
