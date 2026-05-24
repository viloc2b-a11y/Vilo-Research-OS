/**
 * Phase 16A-2.6 — Role conflict policy constants (mirrors migration seeds).
 */

import { WORKFLOW_KEY, type WorkflowKey } from '@/lib/governance/workflow-authority/constants'

export const ROLE_CONFLICT_TYPE = {
  SELF_REVIEW: 'self_review',
  SELF_SIGN: 'self_sign',
  DUAL_ROLE_VIOLATION: 'dual_role_violation',
} as const

export const ROLE_CONFLICT_TYPES = [
  ROLE_CONFLICT_TYPE.SELF_REVIEW,
  ROLE_CONFLICT_TYPE.SELF_SIGN,
  ROLE_CONFLICT_TYPE.DUAL_ROLE_VIOLATION,
] as const

export type RoleConflictType = (typeof ROLE_CONFLICT_TYPES)[number]

export const ROLE_CONFLICT_RESOLUTION = {
  BLOCKED: 'blocked',
  ALLOWED_WITH_JUSTIFICATION: 'allowed_with_justification',
  ESCALATED: 'escalated',
} as const

export const ROLE_CONFLICT_RESOLUTIONS = [
  ROLE_CONFLICT_RESOLUTION.BLOCKED,
  ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION,
  ROLE_CONFLICT_RESOLUTION.ESCALATED,
] as const

export type RoleConflictResolution = (typeof ROLE_CONFLICT_RESOLUTIONS)[number]

export type GlobalRoleConflictPolicySeed = {
  workflowKey: WorkflowKey
  conflictType: RoleConflictType
  resolution: RoleConflictResolution
  justificationRequired: boolean
}

/** Global seeds (organization_id IS NULL) — used for smoke and offline policy resolution fallback. */
export const GLOBAL_ROLE_CONFLICT_POLICIES: GlobalRoleConflictPolicySeed[] = [
  {
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    conflictType: ROLE_CONFLICT_TYPE.SELF_SIGN,
    resolution: ROLE_CONFLICT_RESOLUTION.BLOCKED,
    justificationRequired: true,
  },
  {
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    conflictType: ROLE_CONFLICT_TYPE.SELF_REVIEW,
    resolution: ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION,
    justificationRequired: true,
  },
  {
    workflowKey: WORKFLOW_KEY.QUERY_MANAGEMENT,
    conflictType: ROLE_CONFLICT_TYPE.SELF_REVIEW,
    resolution: ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION,
    justificationRequired: true,
  },
  {
    workflowKey: WORKFLOW_KEY.PROTOCOL_DEVIATION,
    conflictType: ROLE_CONFLICT_TYPE.SELF_REVIEW,
    resolution: ROLE_CONFLICT_RESOLUTION.ESCALATED,
    justificationRequired: true,
  },
  {
    workflowKey: WORKFLOW_KEY.AE_WORKFLOW,
    conflictType: ROLE_CONFLICT_TYPE.SELF_REVIEW,
    resolution: ROLE_CONFLICT_RESOLUTION.ESCALATED,
    justificationRequired: true,
  },
]

export function findGlobalRoleConflictPolicy(
  workflowKey: WorkflowKey,
  conflictType: RoleConflictType,
): GlobalRoleConflictPolicySeed | null {
  return (
    GLOBAL_ROLE_CONFLICT_POLICIES.find(
      (p) => p.workflowKey === workflowKey && p.conflictType === conflictType,
    ) ?? null
  )
}

export function roleConflictRequiresJustification(input: {
  resolution: RoleConflictResolution
  justificationRequired: boolean
  justification?: string | null
}): boolean {
  if (input.resolution !== ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION) {
    return false
  }
  if (!input.justificationRequired) return false
  const text = input.justification?.trim() ?? ''
  return text.length < 10
}
