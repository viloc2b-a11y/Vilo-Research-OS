/**
 * GOV-1 / OBS-2 — Governed workflow trace reference contract.
 * Traces and observability events MUST use workflow_key + effective_authority_level enums only.
 */

import {
  isWorkflowAuthorityLevel,
  type EffectiveAuthorityLevel,
  type WorkflowAuthorityLevel,
  type WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'

export type GovernedWorkflowTraceRefs = {
  /** Closed enum workflow key — never a display name or ad-hoc string at emit time. */
  workflowKey: WorkflowKey
  baseAuthorityLevel: WorkflowAuthorityLevel
  /** Closed enum — must match WORKFLOW_AUTHORITY_LEVELS, never free-text labels. */
  effectiveAuthorityLevel: EffectiveAuthorityLevel
}

const FREE_TEXT_AUTHORITY_PATTERN =
  /\b(assistive|human.required|system.enforced)\b/i

/**
 * Rejects observability payloads that carry human-readable authority labels instead of enums.
 */
export function assertGovernedTraceUsesEnumAuthority(input: {
  effectiveAuthorityLevel: string
  /** If present, these keys must not be used instead of effectiveAuthorityLevel. */
  forbiddenKeys?: string[]
  payload?: Record<string, unknown>
}): void {
  if (!isWorkflowAuthorityLevel(input.effectiveAuthorityLevel)) {
    throw new Error(
      `effective_authority_level must be a WORKFLOW_AUTHORITY_LEVEL enum value, got "${input.effectiveAuthorityLevel}"`,
    )
  }

  const forbidden = input.forbiddenKeys ?? [
    'authorityName',
    'authorityLabel',
    'authorityDisplayName',
    'authorityTierName',
    'authorityDescription',
  ]

  if (input.payload) {
    for (const key of forbidden) {
      if (key in input.payload && input.payload[key] != null) {
        throw new Error(
          `Governed trace must not use free-text authority field "${key}"; use workflow_key and effective_authority_level enums.`,
        )
      }
    }
  }
}

export function buildGovernedWorkflowTraceRefs(input: {
  workflowKey: WorkflowKey
  baseAuthorityLevel: WorkflowAuthorityLevel
  effectiveAuthorityLevel?: WorkflowAuthorityLevel
}): GovernedWorkflowTraceRefs {
  const effective = input.effectiveAuthorityLevel ?? input.baseAuthorityLevel
  assertGovernedTraceUsesEnumAuthority({ effectiveAuthorityLevel: effective })
  return {
    workflowKey: input.workflowKey,
    baseAuthorityLevel: input.baseAuthorityLevel,
    effectiveAuthorityLevel: effective,
  }
}

/**
 * Guard for replay / projection emitters that might accidentally serialize display strings.
 */
export function rejectFreeTextAuthorityValue(value: string, fieldName: string): void {
  if (isWorkflowAuthorityLevel(value)) return
  if (FREE_TEXT_AUTHORITY_PATTERN.test(value)) {
    throw new Error(
      `${fieldName} appears to be a free-text authority label ("${value}"). Use WORKFLOW_AUTHORITY_LEVEL enum values.`,
    )
  }
}
