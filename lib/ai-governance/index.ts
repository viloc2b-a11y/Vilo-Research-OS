/**
 * Phase 16A-1 — AI governance foundation (GOV-0).
 */

export type {
  AiIncidentRecord,
  AiSystemInventoryInput,
  AiSystemInventoryRecord,
  AiSystemInventoryValidationResult,
} from '@/lib/ai-governance/types'

export {
  AI_INCIDENT_SEVERITIES,
  AI_INCIDENT_STATUSES,
  AI_RISK_TIERS,
  AI_SYSTEM_STATUSES,
  METADATA_PHI_KEY_PATTERNS,
  collectSuspiciousMetadataKeys,
  defaultHumanInLoopRequired,
  defaultPhiAllowed,
  isAiIncidentSeverity,
  isAiIncidentStatus,
  isAiRiskTier,
  isAiSystemStatus,
  riskTierRequiresHumanInLoop,
  validateAiSystemInventoryInput,
  validateMetadataNonPhi,
} from '@/lib/ai-governance/risk-tier'

export type {
  AiIncidentSeverity,
  AiIncidentStatus,
  AiRiskTier,
  AiSystemStatus,
} from '@/lib/ai-governance/risk-tier'
