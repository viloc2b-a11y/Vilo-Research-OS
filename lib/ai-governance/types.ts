/**
 * Phase 16A-1 — AI governance foundation types (GOV-0).
 * Inventory and incident records only; no runtime AI execution.
 */

import type {
  AiIncidentSeverity,
  AiIncidentStatus,
  AiRiskTier,
  AiSystemStatus,
} from '@/lib/ai-governance/risk-tier'

export type AiSystemInventoryRecord = {
  id: string
  organizationId: string
  systemName: string
  systemType: string
  vendor: string | null
  modelName: string | null
  ownerRole: string
  useCase: string
  riskTier: AiRiskTier
  humanInLoopRequired: boolean
  phiAllowed: boolean
  status: AiSystemStatus
  /** Non-PHI configuration only — see validateMetadataNonPhi. */
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AiIncidentRecord = {
  id: string
  organizationId: string
  aiSystemId: string | null
  severity: AiIncidentSeverity
  incidentType: string
  description: string
  affectedEntityType: string | null
  affectedEntityId: string | null
  traceId: string | null
  status: AiIncidentStatus
  correctiveAction: string | null
  createdBy: string | null
  createdAt: string
  closedAt: string | null
}

export type AiSystemInventoryInput = {
  organizationId: string
  systemName: string
  systemType: string
  vendor?: string | null
  modelName?: string | null
  ownerRole: string
  useCase: string
  riskTier: AiRiskTier
  humanInLoopRequired?: boolean
  phiAllowed?: boolean
  status?: AiSystemStatus
  metadata?: Record<string, unknown>
}

export type AiSystemInventoryValidationResult =
  | { ok: true; normalized: Required<Pick<AiSystemInventoryInput, 'humanInLoopRequired' | 'phiAllowed'>> & { metadata: Record<string, unknown> } }
  | { ok: false; errors: string[] }
