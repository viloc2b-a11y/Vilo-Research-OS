/**
 * Phase 16A-1 — AI governance risk tiers, statuses, and validation helpers.
 */

import type { AiSystemInventoryInput, AiSystemInventoryValidationResult } from '@/lib/ai-governance/types'

export const AI_RISK_TIERS = ['low', 'medium', 'high', 'critical'] as const
export type AiRiskTier = (typeof AI_RISK_TIERS)[number]

export const AI_SYSTEM_STATUSES = ['draft', 'approved', 'active', 'paused', 'retired'] as const
export type AiSystemStatus = (typeof AI_SYSTEM_STATUSES)[number]

export const AI_INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type AiIncidentSeverity = (typeof AI_INCIDENT_SEVERITIES)[number]

export const AI_INCIDENT_STATUSES = ['open', 'investigating', 'mitigated', 'closed'] as const
export type AiIncidentStatus = (typeof AI_INCIDENT_STATUSES)[number]

/** Keys that must not appear in ai_system_inventory.metadata (PHI guardrail). */
export const METADATA_PHI_KEY_PATTERNS: readonly RegExp[] = [
  /^subject_/i,
  /^patient_/i,
  /mrn/i,
  /ssn/i,
  /date_of_birth/i,
  /\bdob\b/i,
  /phi_/i,
  /hipaa/i,
  /subject_identifier/i,
  /study_subject_id/i,
]

const PHI_KEY_LITERAL_BLOCKLIST = new Set([
  'subject_id',
  'patient_id',
  'patient_name',
  'subject_name',
  'mrn',
  'ssn',
  'date_of_birth',
  'dob',
])

export function isAiRiskTier(value: string): value is AiRiskTier {
  return (AI_RISK_TIERS as readonly string[]).includes(value)
}

export function isAiSystemStatus(value: string): value is AiSystemStatus {
  return (AI_SYSTEM_STATUSES as readonly string[]).includes(value)
}

export function isAiIncidentSeverity(value: string): value is AiIncidentSeverity {
  return (AI_INCIDENT_SEVERITIES as readonly string[]).includes(value)
}

export function isAiIncidentStatus(value: string): value is AiIncidentStatus {
  return (AI_INCIDENT_STATUSES as readonly string[]).includes(value)
}

/** high and critical inventory rows must keep human_in_loop_required true. */
export function riskTierRequiresHumanInLoop(riskTier: AiRiskTier): boolean {
  return riskTier === 'high' || riskTier === 'critical'
}

export function defaultPhiAllowed(): boolean {
  return false
}

export function defaultHumanInLoopRequired(_riskTier: AiRiskTier): boolean {
  return true
}

export function collectSuspiciousMetadataKeys(metadata: Record<string, unknown>): string[] {
  const issues: string[] = []
  const visit = (value: unknown, path: string) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        const fullPath = path ? `${path}.${key}` : key
        const normalizedKey = key.trim().toLowerCase()
        if (PHI_KEY_LITERAL_BLOCKLIST.has(normalizedKey)) {
          issues.push(fullPath)
        } else if (METADATA_PHI_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
          issues.push(fullPath)
        }
        visit(nested, fullPath)
      }
    }
  }
  visit(metadata, '')
  return issues
}

/**
 * metadata must be treated as non-PHI — rejects suspicious keys.
 */
export function validateMetadataNonPhi(metadata: Record<string, unknown>): string[] {
  return collectSuspiciousMetadataKeys(metadata)
}

export function validateAiSystemInventoryInput(
  input: AiSystemInventoryInput,
): AiSystemInventoryValidationResult {
  const errors: string[] = []

  if (!isAiRiskTier(input.riskTier)) {
    errors.push(`Invalid risk_tier: ${String(input.riskTier)}`)
  }

  const humanInLoopRequired =
    input.humanInLoopRequired ?? defaultHumanInLoopRequired(input.riskTier)
  const phiAllowed = input.phiAllowed ?? defaultPhiAllowed()
  const metadata = input.metadata ?? {}

  if (isAiRiskTier(input.riskTier) && riskTierRequiresHumanInLoop(input.riskTier) && !humanInLoopRequired) {
    errors.push(`${input.riskTier} risk_tier requires human_in_loop_required = true`)
  }

  if (phiAllowed && input.riskTier === 'critical') {
    errors.push('critical risk_tier should not allow phi_allowed = true under GOV-0 defaults')
  }

  const metadataIssues = validateMetadataNonPhi(metadata)
  if (metadataIssues.length > 0) {
    errors.push(
      `metadata must be non-PHI; suspicious keys: ${metadataIssues.slice(0, 5).join(', ')}`,
    )
  }

  if (input.status !== undefined && !isAiSystemStatus(input.status)) {
    errors.push(`Invalid status: ${String(input.status)}`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    normalized: {
      humanInLoopRequired,
      phiAllowed,
      metadata,
    },
  }
}
