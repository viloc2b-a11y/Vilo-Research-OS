/**
 * Role conflict policy lookup — detection only (no global blocking enforcement in pilot).
 */

import {
  findGlobalRoleConflictPolicy,
  ROLE_CONFLICT_RESOLUTION,
} from '@/lib/role-conflicts/constants'
import type {
  RoleConflictCheckInput,
  RoleConflictCheckResult,
  RoleConflictPolicyRow,
} from '@/lib/role-conflicts/types'

type PolicyDbRow = {
  id: string
  organization_id: string | null
  workflow_key: string
  conflict_type: string
  resolution: string
  justification_required: boolean
  regulated: boolean
  active: boolean
}

function mapPolicyRow(row: PolicyDbRow): RoleConflictPolicyRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowKey: row.workflow_key as RoleConflictPolicyRow['workflowKey'],
    conflictType: row.conflict_type as RoleConflictPolicyRow['conflictType'],
    resolution: row.resolution as RoleConflictPolicyRow['resolution'],
    justificationRequired: row.justification_required,
    regulated: row.regulated,
    active: row.active,
  }
}

function outcomeFromPolicy(
  policy: RoleConflictPolicyRow | null,
  selfConflict: boolean,
): RoleConflictCheckResult {
  if (!selfConflict || !policy || !policy.active) {
    return {
      conflictDetected: false,
      policy,
      resolution: null,
      justificationRequired: false,
      blocked: false,
      escalated: false,
    }
  }

  return {
    conflictDetected: true,
    policy,
    resolution: policy.resolution,
    justificationRequired: policy.justificationRequired,
    blocked: policy.resolution === ROLE_CONFLICT_RESOLUTION.BLOCKED,
    escalated: policy.resolution === ROLE_CONFLICT_RESOLUTION.ESCALATED,
  }
}

async function loadPolicyFromDb(
  input: RoleConflictCheckInput,
): Promise<RoleConflictPolicyRow | null> {
  if (!input.supabase) return null

  const { data: orgPolicy } = await input.supabase
    .from('role_conflict_policies')
    .select(
      'id, organization_id, workflow_key, conflict_type, resolution, justification_required, regulated, active',
    )
    .eq('organization_id', input.organizationId)
    .eq('workflow_key', input.workflowKey)
    .eq('conflict_type', input.conflictType)
    .eq('active', true)
    .maybeSingle()

  if (orgPolicy) return mapPolicyRow(orgPolicy as PolicyDbRow)

  const { data: globalPolicy } = await input.supabase
    .from('role_conflict_policies')
    .select(
      'id, organization_id, workflow_key, conflict_type, resolution, justification_required, regulated, active',
    )
    .is('organization_id', null)
    .eq('workflow_key', input.workflowKey)
    .eq('conflict_type', input.conflictType)
    .eq('active', true)
    .maybeSingle()

  if (globalPolicy) return mapPolicyRow(globalPolicy as PolicyDbRow)
  return null
}

export async function checkRoleConflict(
  input: RoleConflictCheckInput,
): Promise<RoleConflictCheckResult> {
  const dbPolicy = await loadPolicyFromDb(input)
  if (dbPolicy) {
    return outcomeFromPolicy(dbPolicy, input.selfConflict)
  }

  const seed = findGlobalRoleConflictPolicy(input.workflowKey, input.conflictType)
  if (!seed) {
    return outcomeFromPolicy(null, input.selfConflict)
  }

  const fallbackPolicy: RoleConflictPolicyRow = {
    id: 'seed',
    organizationId: null,
    workflowKey: seed.workflowKey,
    conflictType: seed.conflictType,
    resolution: seed.resolution,
    justificationRequired: seed.justificationRequired,
    regulated: true,
    active: true,
  }

  return outcomeFromPolicy(fallbackPolicy, input.selfConflict)
}
